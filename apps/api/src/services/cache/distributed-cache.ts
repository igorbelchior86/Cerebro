import { createClient } from 'redis';
import { operationalLogger } from '../../lib/operational-logger.js';

type CacheRecord<T> = {
  value: T;
  createdAt: number;
  freshUntil: number;
  staleUntil: number;
};

type CacheSource = 'redis' | 'memory' | 'live';

export type CacheReadMeta = {
  resource: string;
  scope: 'tenant';
  version: string;
  hit: boolean;
  stale: boolean;
  ageMs: number;
  source: CacheSource;
  bypassed: boolean;
};

export type CacheReadResult<T> = {
  value: T;
  meta: CacheReadMeta;
};

export type CacheReadOptions<T> = {
  key: string;
  resource: string;
  tags?: string[];
  ttlMs: number;
  staleMs?: number;
  lockTtlMs?: number;
  jitterRatio?: number;
  negativeTtlMs?: number;
  maxPayloadBytes?: number;
  allowStaleOnError?: boolean;
  loader: () => Promise<T>;
  canCacheValue?: (value: T) => boolean;
};

type CircuitState = {
  failures: number[];
  openUntil: number;
};

type RawCacheHit = {
  raw: string;
  source: Exclude<CacheSource, 'live'>;
  bypassed: boolean;
};

type RedisClientHandle = ReturnType<typeof createClient>;

const REDIS_KEY_PREFIX = 'cerebro:cache:';
const REDIS_TAG_PREFIX = 'cerebro:cache:tag:';
const REDIS_LOCK_PREFIX = 'cerebro:cache:lock:';
const DEFAULT_STALE_MS = 60_000;
const DEFAULT_LOCK_TTL_MS = 2_000;
const DEFAULT_JITTER_RATIO = 0.1;
const DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1024;
const CIRCUIT_WINDOW_MS = 10_000;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30_000;
const WAIT_ON_LOCK_MS = 75;
const WAIT_ON_LOCK_ATTEMPTS = 3;

function nowMs(): number {
  return Date.now();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashFnv1a32(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  return false;
}

function addTtlJitter(ttlMs: number, jitterRatio: number): number {
  const safeRatio = Math.max(0, Math.min(0.5, jitterRatio));
  if (safeRatio === 0) return ttlMs;
  const delta = Math.floor(ttlMs * safeRatio);
  if (delta <= 0) return ttlMs;
  const signed = Math.floor(Math.random() * ((delta * 2) + 1)) - delta;
  return Math.max(100, ttlMs + signed);
}

function toRedisKey(key: string): string {
  return `${REDIS_KEY_PREFIX}${key}`;
}

function toRedisTagKey(tag: string): string {
  return `${REDIS_TAG_PREFIX}${tag}`;
}

function toRedisLockKey(key: string): string {
  return `${REDIS_LOCK_PREFIX}${key}`;
}

class MemoryCacheBackend {
  private records = new Map<string, { value: string; expiresAt: number }>();
  private tags = new Map<string, Set<string>>();
  private locks = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    const item = this.records.get(key);
    if (!item) return null;
    if (item.expiresAt <= nowMs()) {
      this.records.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.records.set(key, {
      value,
      expiresAt: nowMs() + Math.max(100, ttlMs),
    });
  }

  async del(key: string): Promise<void> {
    this.records.delete(key);
  }

  async sAdd(tag: string, key: string): Promise<void> {
    const set = this.tags.get(tag) || new Set<string>();
    set.add(key);
    this.tags.set(tag, set);
  }

  async sMembers(tag: string): Promise<string[]> {
    return Array.from(this.tags.get(tag) || []);
  }

  async delTag(tag: string): Promise<void> {
    this.tags.delete(tag);
  }

  async acquireLock(lockKey: string, ttlMs: number): Promise<boolean> {
    const current = this.locks.get(lockKey);
    const now = nowMs();
    if (current && current > now) return false;
    this.locks.set(lockKey, now + Math.max(100, ttlMs));
    return true;
  }

  async releaseLock(lockKey: string): Promise<void> {
    this.locks.delete(lockKey);
  }
}

class RedisCacheBackend {
  private client: RedisClientHandle | null = null;
  private connectPromise: Promise<RedisClientHandle | null> | null = null;

  private get redisUrl(): string {
    return String(process.env.CACHE_REDIS_URL || process.env.REDIS_URL || '').trim();
  }

  private redisEnabled(): boolean {
    const provider = String(process.env.CACHE_PROVIDER || 'redis').trim().toLowerCase();
    return provider === 'redis' && Boolean(this.redisUrl);
  }

  private async connect(): Promise<RedisClientHandle | null> {
    if (!this.redisEnabled()) return null;
    if (this.client?.isOpen) return this.client;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      try {
        const client = createClient({
          url: this.redisUrl,
          socket: {
            connectTimeout: Number(process.env.CACHE_REDIS_CONNECT_TIMEOUT_MS || 2_000),
            reconnectStrategy: (retries) => {
              if (retries > 5) return false;
              return Math.min(500 + (retries * 250), 2_000);
            },
          },
        });
        client.on('error', (error) => {
          operationalLogger.warn('cache.redis.client_error', {
            module: 'services.cache.distributed-cache',
            error_message: String((error as any)?.message || error || 'unknown'),
          });
        });
        await client.connect();
        this.client = client;
        return client;
      } catch (error) {
        operationalLogger.warn('cache.redis.connect_failed', {
          module: 'services.cache.distributed-cache',
          error_message: String((error as any)?.message || error || 'unknown'),
        });
        this.client = null;
        return null;
      } finally {
        this.connectPromise = null;
      }
    })();

    return this.connectPromise;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.connect();
    if (!client) return null;
    return client.get(key);
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    const client = await this.connect();
    if (!client) throw new Error('redis_unavailable');
    await client.set(key, value, { PX: Math.max(100, ttlMs) });
  }

  async del(key: string): Promise<void> {
    const client = await this.connect();
    if (!client) return;
    await client.del(key);
  }

  async sAdd(tag: string, key: string): Promise<void> {
    const client = await this.connect();
    if (!client) throw new Error('redis_unavailable');
    await client.sAdd(tag, key);
  }

  async sMembers(tag: string): Promise<string[]> {
    const client = await this.connect();
    if (!client) throw new Error('redis_unavailable');
    return client.sMembers(tag);
  }

  async delTag(tag: string): Promise<void> {
    const client = await this.connect();
    if (!client) return;
    await client.del(tag);
  }

  async acquireLock(lockKey: string, ttlMs: number): Promise<boolean> {
    const client = await this.connect();
    if (!client) return false;
    const result = await client.set(lockKey, '1', { PX: Math.max(100, ttlMs), NX: true });
    return result === 'OK';
  }

  async releaseLock(lockKey: string): Promise<void> {
    const client = await this.connect();
    if (!client) return;
    await client.del(lockKey);
  }
}

class CircuitBreaker {
  private states = new Map<string, CircuitState>();

  shouldBypass(resource: string): boolean {
    const state = this.states.get(resource);
    if (!state) return false;
    if (state.openUntil <= nowMs()) return false;
    return true;
  }

  recordFailure(resource: string): void {
    const now = nowMs();
    const state = this.states.get(resource) || { failures: [], openUntil: 0 };
    state.failures = state.failures.filter((ts) => now - ts <= CIRCUIT_WINDOW_MS);
    state.failures.push(now);
    if (state.failures.length >= CIRCUIT_THRESHOLD) {
      state.openUntil = now + CIRCUIT_OPEN_MS;
    }
    this.states.set(resource, state);
  }

  recordSuccess(resource: string): void {
    const state = this.states.get(resource);
    if (!state) return;
    this.states.set(resource, {
      failures: [],
      openUntil: 0,
    });
  }
}

export class DistributedCacheService {
  private readonly memory = new MemoryCacheBackend();
  private readonly redis = new RedisCacheBackend();
  private readonly breaker = new CircuitBreaker();
  private readonly inFlight = new Map<string, Promise<CacheReadResult<any>>>();
  private readonly statsInternal = {
    hits: 0,
    misses: 0,
    staleServed: 0,
    lockAcquired: 0,
    lockContended: 0,
  };

  async stats() {
    return {
      ...this.statsInternal,
    };
  }

  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = toRedisTagKey(tag);
    const members = await this.getTagMembers(tagKey);
    if (members.length === 0) {
      await this.safeDeleteTag(tagKey);
      return 0;
    }
    let deleted = 0;
    const chunkSize = 100;
    for (let i = 0; i < members.length; i += chunkSize) {
      const chunk = members.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (key) => {
        await this.safeDeleteRecord(key, 'cache_invalidation');
      }));
      deleted += chunk.length;
    }
    await this.safeDeleteTag(tagKey);
    return deleted;
  }

  async getOrLoad<T>(input: CacheReadOptions<T>): Promise<CacheReadResult<T>> {
    const staleMs = Math.max(0, input.staleMs ?? DEFAULT_STALE_MS);
    const lockTtlMs = Math.max(250, input.lockTtlMs ?? DEFAULT_LOCK_TTL_MS);
    const jitterRatio = input.jitterRatio ?? DEFAULT_JITTER_RATIO;
    const maxPayloadBytes = input.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
    const now = nowMs();

    const cached = await this.readCacheRecord<T>(input.key, input.resource);
    if (cached) {
      const parsed = this.parseCacheRecord<T>(cached.raw);
      if (parsed && parsed.staleUntil > now) {
        const stale = parsed.freshUntil <= now;
        this.statsInternal.hits += 1;
        if (stale) {
          this.statsInternal.staleServed += 1;
          void this.refreshInBackground({
            ...input,
            staleMs,
            lockTtlMs,
            jitterRatio,
            maxPayloadBytes,
          });
        }
        return {
          value: parsed.value,
          meta: {
            resource: input.resource,
            scope: 'tenant',
            version: 'v1',
            hit: true,
            stale,
            ageMs: Math.max(0, now - parsed.createdAt),
            source: cached.source,
            bypassed: cached.bypassed,
          },
        };
      }
      await this.safeDeleteRecord(toRedisKey(input.key), input.resource);
    }

    this.statsInternal.misses += 1;
    return this.withLocalSingleflight(input.key, async () => {
      const secondRead = await this.readCacheRecord<T>(input.key, input.resource);
      if (secondRead) {
        const secondParsed = this.parseCacheRecord<T>(secondRead.raw);
        if (secondParsed && secondParsed.staleUntil > nowMs()) {
          const stale = secondParsed.freshUntil <= nowMs();
          this.statsInternal.hits += 1;
          if (stale) this.statsInternal.staleServed += 1;
          return {
            value: secondParsed.value,
            meta: {
              resource: input.resource,
              scope: 'tenant',
              version: 'v1',
              hit: true,
              stale,
              ageMs: Math.max(0, nowMs() - secondParsed.createdAt),
              source: secondRead.source,
              bypassed: secondRead.bypassed,
            },
          };
        }
      }

      const lockKey = toRedisLockKey(input.key);
      const lockAcquired = await this.acquireLock(lockKey, lockTtlMs, input.resource);
      if (!lockAcquired) {
        this.statsInternal.lockContended += 1;
        for (let i = 0; i < WAIT_ON_LOCK_ATTEMPTS; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, WAIT_ON_LOCK_MS));
          const read = await this.readCacheRecord<T>(input.key, input.resource);
          const parsed = read ? this.parseCacheRecord<T>(read.raw) : null;
          if (parsed && parsed.staleUntil > nowMs()) {
            const stale = parsed.freshUntil <= nowMs();
            this.statsInternal.hits += 1;
            if (stale) this.statsInternal.staleServed += 1;
            return {
              value: parsed.value,
              meta: {
                resource: input.resource,
                scope: 'tenant',
                version: 'v1',
                hit: true,
                stale,
                ageMs: Math.max(0, nowMs() - parsed.createdAt),
                source: read?.source || 'memory',
                bypassed: Boolean(read?.bypassed),
              },
            };
          }
        }
      } else {
        this.statsInternal.lockAcquired += 1;
      }

      try {
        const loadedValue = await input.loader();
        const canCache = input.canCacheValue ? input.canCacheValue(loadedValue) : true;
        const shouldNegativeCache = isValueEmpty(loadedValue) && Number.isFinite(input.negativeTtlMs);
        const effectiveFreshTtlMs = shouldNegativeCache
          ? Math.max(100, Number(input.negativeTtlMs))
          : Math.max(100, input.ttlMs);
        const freshTtlWithJitter = addTtlJitter(effectiveFreshTtlMs, jitterRatio);
        const createdAt = nowMs();
        const record: CacheRecord<T> = {
          value: loadedValue,
          createdAt,
          freshUntil: createdAt + freshTtlWithJitter,
          staleUntil: createdAt + freshTtlWithJitter + staleMs,
        };
        const serialized = JSON.stringify(record);
        const bytes = Buffer.byteLength(serialized, 'utf8');
        if (canCache && bytes <= maxPayloadBytes) {
          await this.writeRecord(input.key, serialized, Math.max(100, record.staleUntil - createdAt), input.tags || [], input.resource);
        }

        return {
          value: loadedValue,
          meta: {
            resource: input.resource,
            scope: 'tenant',
            version: 'v1',
            hit: false,
            stale: false,
            ageMs: 0,
            source: 'live',
            bypassed: this.breaker.shouldBypass(input.resource),
          },
        };
      } catch (error) {
        const staleFallback = await this.readCacheRecord<T>(input.key, input.resource);
        const staleParsed = staleFallback ? this.parseCacheRecord<T>(staleFallback.raw) : null;
        if (input.allowStaleOnError !== false && staleParsed && staleParsed.staleUntil > nowMs()) {
          this.statsInternal.staleServed += 1;
          return {
            value: staleParsed.value,
            meta: {
              resource: input.resource,
              scope: 'tenant',
              version: 'v1',
              hit: true,
              stale: true,
              ageMs: Math.max(0, nowMs() - staleParsed.createdAt),
              source: staleFallback?.source || 'memory',
              bypassed: Boolean(staleFallback?.bypassed),
            },
          };
        }
        throw error;
      } finally {
        if (lockAcquired) {
          await this.releaseLock(lockKey, input.resource);
        }
      }
    });
  }

  private async refreshInBackground<T>(input: CacheReadOptions<T> & {
    staleMs: number;
    lockTtlMs: number;
    jitterRatio: number;
    maxPayloadBytes: number;
  }): Promise<void> {
    const refreshKey = `refresh:${input.key}`;
    if (this.inFlight.has(refreshKey)) return;
    const task = (async () => {
      const lockKey = toRedisLockKey(input.key);
      const lockAcquired = await this.acquireLock(lockKey, input.lockTtlMs, input.resource);
      if (!lockAcquired) return;
      try {
        const value = await input.loader();
        const canCache = input.canCacheValue ? input.canCacheValue(value) : true;
        const shouldNegativeCache = isValueEmpty(value) && Number.isFinite(input.negativeTtlMs);
        const effectiveFreshTtlMs = shouldNegativeCache
          ? Math.max(100, Number(input.negativeTtlMs))
          : Math.max(100, input.ttlMs);
        const freshTtlWithJitter = addTtlJitter(effectiveFreshTtlMs, input.jitterRatio);
        const createdAt = nowMs();
        const record: CacheRecord<T> = {
          value,
          createdAt,
          freshUntil: createdAt + freshTtlWithJitter,
          staleUntil: createdAt + freshTtlWithJitter + input.staleMs,
        };
        const serialized = JSON.stringify(record);
        const bytes = Buffer.byteLength(serialized, 'utf8');
        if (canCache && bytes <= input.maxPayloadBytes) {
          await this.writeRecord(input.key, serialized, Math.max(100, record.staleUntil - createdAt), input.tags || [], input.resource);
        }
      } catch (error) {
        operationalLogger.warn('cache.refresh.background_failed', {
          module: 'services.cache.distributed-cache',
          resource: input.resource,
          key: input.key,
          error_message: String((error as any)?.message || error || 'unknown'),
        });
      } finally {
        await this.releaseLock(lockKey, input.resource);
      }
    })();
    this.inFlight.set(refreshKey, task as Promise<any>);
    try {
      await task;
    } finally {
      this.inFlight.delete(refreshKey);
    }
  }

  private withLocalSingleflight<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const inFlight = this.inFlight.get(key) as Promise<T> | undefined;
    if (inFlight) return inFlight;
    const task = loader()
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, task as Promise<any>);
    return task;
  }

  private parseCacheRecord<T>(raw: string): CacheRecord<T> | null {
    try {
      const parsed = JSON.parse(raw) as CacheRecord<T>;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        typeof parsed.createdAt !== 'number' ||
        typeof parsed.freshUntil !== 'number' ||
        typeof parsed.staleUntil !== 'number'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async readCacheRecord<T>(key: string, resource: string): Promise<RawCacheHit | null> {
    const redisKey = toRedisKey(key);
    const bypassed = this.breaker.shouldBypass(resource);

    if (!bypassed) {
      try {
        const raw = await this.redis.get(redisKey);
        if (raw !== null) {
          this.breaker.recordSuccess(resource);
          return { raw, source: 'redis', bypassed: false };
        }
      } catch (error) {
        this.breaker.recordFailure(resource);
        operationalLogger.warn('cache.redis.read_failed', {
          module: 'services.cache.distributed-cache',
          resource,
          key,
          error_message: String((error as any)?.message || error || 'unknown'),
        });
      }
    }

    const fallbackRaw = await this.memory.get(redisKey);
    if (fallbackRaw !== null) {
      return { raw: fallbackRaw, source: 'memory', bypassed };
    }
    return null;
  }

  private async writeRecord(key: string, raw: string, ttlMs: number, tags: string[], resource: string): Promise<void> {
    const redisKey = toRedisKey(key);
    const bypassed = this.breaker.shouldBypass(resource);
    if (!bypassed) {
      try {
        await this.redis.set(redisKey, raw, ttlMs);
        for (const tag of tags) {
          await this.redis.sAdd(toRedisTagKey(tag), redisKey);
        }
        this.breaker.recordSuccess(resource);
        return;
      } catch (error) {
        this.breaker.recordFailure(resource);
        operationalLogger.warn('cache.redis.write_failed', {
          module: 'services.cache.distributed-cache',
          resource,
          key,
          error_message: String((error as any)?.message || error || 'unknown'),
        });
      }
    }

    await this.memory.set(redisKey, raw, ttlMs);
    for (const tag of tags) {
      await this.memory.sAdd(toRedisTagKey(tag), redisKey);
    }
  }

  private async safeDeleteRecord(redisKey: string, resource: string): Promise<void> {
    const bypassed = this.breaker.shouldBypass(resource);
    if (!bypassed) {
      try {
        await this.redis.del(redisKey);
        this.breaker.recordSuccess(resource);
      } catch (error) {
        this.breaker.recordFailure(resource);
      }
    }
    await this.memory.del(redisKey);
  }

  private async getTagMembers(tagKey: string): Promise<string[]> {
    try {
      const redisMembers = await this.redis.sMembers(tagKey);
      if (redisMembers.length > 0) return redisMembers;
    } catch {
      // ignore and fallback
    }
    return this.memory.sMembers(tagKey);
  }

  private async safeDeleteTag(tagKey: string): Promise<void> {
    try {
      await this.redis.delTag(tagKey);
    } catch {
      // ignore and fallback
    }
    await this.memory.delTag(tagKey);
  }

  private async acquireLock(lockKey: string, ttlMs: number, resource: string): Promise<boolean> {
    const bypassed = this.breaker.shouldBypass(resource);
    if (!bypassed) {
      try {
        const acquired = await this.redis.acquireLock(lockKey, ttlMs);
        if (acquired) return true;
      } catch (error) {
        this.breaker.recordFailure(resource);
      }
    }
    return this.memory.acquireLock(lockKey, ttlMs);
  }

  private async releaseLock(lockKey: string, resource: string): Promise<void> {
    const bypassed = this.breaker.shouldBypass(resource);
    if (!bypassed) {
      try {
        await this.redis.releaseLock(lockKey);
      } catch {
        // ignore and fallback
      }
    }
    await this.memory.releaseLock(lockKey);
  }
}

export function buildTenantCacheKey(input: {
  env?: string;
  tenantId: string;
  domain: string;
  resource: string;
  version?: string;
  params?: Record<string, unknown>;
}): string {
  const env = String(input.env || process.env.NODE_ENV || 'dev').trim().toLowerCase();
  const tenantId = String(input.tenantId || 'unknown').trim().toLowerCase();
  const domain = String(input.domain || 'general').trim().toLowerCase();
  const resource = String(input.resource || 'value').trim().toLowerCase();
  const version = String(input.version || 'v1').trim().toLowerCase();
  const fingerprint = hashFnv1a32(stableStringify(input.params || {}));
  return `${env}:${tenantId}:${domain}:${resource}:${version}:${fingerprint}`;
}

export function buildTenantDomainTag(input: { tenantId: string; domain: string }): string {
  const tenantId = String(input.tenantId || 'unknown').trim().toLowerCase();
  const domain = String(input.domain || 'general').trim().toLowerCase();
  return `tenant:${tenantId}:domain:${domain}`;
}

export const distributedCache = new DistributedCacheService();
