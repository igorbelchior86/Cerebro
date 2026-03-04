// ─────────────────────────────────────────────────────────────
// Autotask Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { AutotaskClient } from '../../../clients/index.js';
import { query, queryOne, withTryAdvisoryLock } from '../../../db/index.js';
import { pgStore } from '../../adapters/email/pg-store.js';
import { triageOrchestrator } from '../../orchestration/triage-orchestrator.js';
import { classifyQueueError } from '../../../platform/errors.js';
import { tenantContext } from '../../../lib/tenantContext.js';
import { buildTenantCacheKey, buildTenantDomainTag, distributedCache } from '../../cache/distributed-cache.js';
import type { AutotaskTicket } from '@cerebro/types';

const router: ExpressRouter = Router();

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

type SidebarTicketRow = {
  id: string;
  ticket_id: string;
  ticket_number?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  ticket_status_value?: string | number;
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  title?: string;
  description?: string;
  company?: string;
  requester?: string;
  org?: string;
  site?: string;
  created_at?: string;
  queue?: string;
  queue_name?: string;
  queue_id?: number;
};

const ticketFieldKeys = [
  'queue',
  'priority',
  'status',
  'issueType',
  'subIssueType',
  'serviceLevelAgreement',
] as const;

type TicketFieldKey = (typeof ticketFieldKeys)[number];

const TICKET_FIELD_OPTIONS_CACHE_TTL_MS = 30_000;
const ticketFieldOptionCache = new Map<TicketFieldKey, { expiresAt: number; data: unknown[] }>();
const SIDEBAR_TICKETS_CACHE_TTL_MS = 5_000;
const SIDEBAR_TICKETS_LOCK_NAMESPACE = 41024;
const SIDEBAR_TICKETS_LOCK_WAIT_TIMEOUT_MS = 2_500;
const SIDEBAR_TICKETS_LOCK_RETRY_INTERVAL_MS = 200;
const SIDEBAR_TICKETS_RATE_LIMIT_COOLDOWN_MS = 15_000;
const sidebarTicketsCache = new Map<string, {
  expiresAt: number;
  payload: { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number };
}>();
const sidebarTicketsInFlight = new Map<string, Promise<{ rows: SidebarTicketRow[]; queueId: number; lookbackHours: number }>>();
const sidebarTicketsRateLimitCooldown = new Map<string, number>();
const SIDEBAR_ENRICHMENT_CACHE_TTL_MS = 60_000;
const SIDEBAR_ENRICHMENT_CONCURRENCY_LIMIT = 4;
const sidebarEnrichmentNameCache = new Map<string, { expiresAt: number; name: string }>();
const sidebarEnrichmentInFlight = new Map<string, Promise<string>>();

// Lazy client — only created when a request arrives; avoids startup crash if env vars are absent.
function getClient() {
  const code = process.env.AUTOTASK_API_INTEGRATION_CODE;
  const user = process.env.AUTOTASK_USERNAME;
  const secret = process.env.AUTOTASK_SECRET;
  if (!code || !user || !secret) return null;
  return new AutotaskClient({
    apiIntegrationCode: code,
    username: user,
    secret,
    ...(process.env.AUTOTASK_ZONE_URL ? { zoneUrl: process.env.AUTOTASK_ZONE_URL } : {}),
  });
}

async function getTenantScopedClient(tenantIdFromRequest?: string | null): Promise<AutotaskClient | null> {
  const tenantId = String(tenantIdFromRequest || tenantContext.getStore()?.tenantId || '').trim();
  try {
    if (tenantId) {
      const row = await queryOne<{ credentials: AutotaskCreds }>(
        'SELECT credentials FROM integration_credentials WHERE tenant_id = $1 AND service = $2 LIMIT 1',
        [tenantId, 'autotask']
      );
      const creds = row?.credentials;
      if (creds?.apiIntegrationCode && creds?.username && creds?.secret) {
        return new AutotaskClient({
          apiIntegrationCode: creds.apiIntegrationCode,
          username: creds.username,
          secret: creds.secret,
          ...(creds.zoneUrl ? { zoneUrl: creds.zoneUrl } : {}),
        });
      }
      return null;
    }
  } catch {
    // Fall back to env-based client below.
  }
  if (tenantId) return null;
  return getClient();
}

function parseIntParam(value: unknown, fallback: number, { min, max }: { min: number; max: number }) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeSearchTerm(value: unknown): string {
  return String(value ?? '').trim().replace(/'/g, "''");
}

function resolveTenantScope(tenantIdFromRequest?: string | null): string {
  return String(tenantIdFromRequest || tenantContext.getStore()?.tenantId || 'global')
    .trim()
    .toLowerCase();
}

function metadataTag(tenantScope: string): string {
  return buildTenantDomainTag({ tenantId: tenantScope, domain: 'autotask_metadata' });
}

function searchTag(tenantScope: string): string {
  return buildTenantDomainTag({ tenantId: tenantScope, domain: 'autotask_search' });
}

function classifyAutotaskReadDegradedReason(error: unknown): 'rate_limited' | 'provider_error' {
  return classifyQueueError(error).code === 'RATE_LIMIT' ? 'rate_limited' : 'provider_error';
}

function classifySidebarTicketsDegradedReason(error: unknown): 'rate_limited' | 'provider_error' | null {
  const classification = classifyQueueError(error);
  const reason = String(classification.reason || '').toLowerCase();
  if (classification.code === 'RATE_LIMIT') return 'rate_limited';
  if (classification.code === 'TIMEOUT' || classification.code === 'DEPENDENCY') return 'provider_error';
  if (classification.code === 'UNKNOWN') {
    if (
      reason.includes('thread threshold') ||
      reason.includes('too many requests') ||
      reason.includes('429') ||
      reason.includes('rate limit')
    ) {
      return 'rate_limited';
    }
    if (reason.includes('autotask api error')) {
      return 'provider_error';
    }
  }
  return null;
}

async function loadCachedReadOnlyArray(
  key: TicketFieldKey,
  loader: () => Promise<unknown[]>
): Promise<{ data: unknown[]; degradedReason?: 'rate_limited' | 'provider_error' }> {
  const cached = ticketFieldOptionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { data: cached.data };
  }

  try {
    const data = await loader();
    ticketFieldOptionCache.set(key, {
      expiresAt: Date.now() + TICKET_FIELD_OPTIONS_CACHE_TTL_MS,
      data,
    });
    return { data };
  } catch (error) {
    const stale = cached?.data;
    return {
      data: Array.isArray(stale) ? stale : [],
      degradedReason: classifyAutotaskReadDegradedReason(error),
    };
  }
}

const MAX_ATTACHMENT_BYTES = 7 * 1024 * 1024;

function toBase64Payload(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return raw.replace(/^data:[^;]+;base64,/i, '').trim();
}

function estimateBase64DecodedSize(data: string): number {
  if (!data) return 0;
  const len = data.length;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

function stringifyStructuredSearch(filter: Array<Record<string, unknown>>, maxRecords: number): string {
  return JSON.stringify({
    MaxRecords: maxRecords,
    filter,
  });
}

function hashToPositiveInt32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

function buildSidebarTicketsCacheKey(input: {
  tenantScope: string;
  queueId: number;
  maxRecords: number;
  lookbackHours: number;
}): string {
  return [
    'sidebar_tickets',
    input.tenantScope.trim().toLowerCase(),
    String(input.queueId),
    String(input.maxRecords),
    String(input.lookbackHours),
  ].join(':');
}

function readCachedSidebarTickets(cacheKey: string): { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number } | null {
  const cached = sidebarTicketsCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    sidebarTicketsCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
}

function readSidebarTicketsStale(cacheKey: string): { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number } | null {
  const cached = sidebarTicketsCache.get(cacheKey);
  return cached?.payload || null;
}

function writeCachedSidebarTickets(
  cacheKey: string,
  payload: { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number }
) {
  sidebarTicketsCache.set(cacheKey, {
    expiresAt: Date.now() + SIDEBAR_TICKETS_CACHE_TTL_MS,
    payload,
  });
}

function readSidebarTicketsRateLimitCooldown(cacheKey: string): number | null {
  const cooldownUntil = sidebarTicketsRateLimitCooldown.get(cacheKey);
  if (!cooldownUntil) return null;
  if (cooldownUntil <= Date.now()) {
    sidebarTicketsRateLimitCooldown.delete(cacheKey);
    return null;
  }
  return cooldownUntil;
}

function setSidebarTicketsRateLimitCooldown(cacheKey: string) {
  sidebarTicketsRateLimitCooldown.set(cacheKey, Date.now() + SIDEBAR_TICKETS_RATE_LIMIT_COOLDOWN_MS);
}

function clearSidebarTicketsRateLimitCooldown(cacheKey: string) {
  sidebarTicketsRateLimitCooldown.delete(cacheKey);
}

function mapAutotaskStatusToSidebar(statusValue: unknown): SidebarTicketRow['status'] {
  const normalized = String(statusValue ?? '').trim().toLowerCase();
  if (!normalized) return 'pending';
  if (/(complete|completed|closed|done|resolved)/.test(normalized)) return 'completed';
  if (/(fail|error)/.test(normalized)) return 'failed';
  if (/(progress|processing|assigned|working)/.test(normalized)) return 'processing';
  return 'pending';
}

function mapAutotaskPriority(priorityValue: unknown): 'P1' | 'P2' | 'P3' | 'P4' {
  const numeric = Number(priorityValue);
  if (numeric === 1) return 'P1';
  if (numeric === 2) return 'P2';
  if (numeric === 3) return 'P3';
  if (numeric === 4) return 'P4';
  return 'P3';
}

function sortTicketsByCreateDateDesc(a: AutotaskTicket, b: AutotaskTicket): number {
  const at = new Date(String((a as any)?.createDate || 0)).getTime();
  const bt = new Date(String((b as any)?.createDate || 0)).getTime();
  const delta = (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  if (delta !== 0) return delta;
  return String((b as any)?.ticketNumber || b.id || '').localeCompare(String((a as any)?.ticketNumber || a.id || ''));
}

function buildSidebarEnrichmentKey(
  tenantId: string | null | undefined,
  kind: 'company' | 'contact',
  id: number
): string {
  const tenantScope = String(tenantId || '').trim() || 'env';
  return `${tenantScope}:${kind}:${id}`;
}

function readSidebarEnrichmentName(key: string): string | null {
  const cached = sidebarEnrichmentNameCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    sidebarEnrichmentNameCache.delete(key);
    return null;
  }
  return cached.name;
}

function writeSidebarEnrichmentName(key: string, name: string) {
  if (!name) return;
  sidebarEnrichmentNameCache.set(key, {
    expiresAt: Date.now() + SIDEBAR_ENRICHMENT_CACHE_TTL_MS,
    name,
  });
}

async function getOrCreateSidebarEnrichmentName(
  key: string,
  loader: () => Promise<string>
): Promise<string> {
  const cached = readSidebarEnrichmentName(key);
  if (cached) return cached;
  const inFlight = sidebarEnrichmentInFlight.get(key);
  if (inFlight) return inFlight;

  const pending = (async () => {
    try {
      const name = String((await loader()) || '').trim();
      writeSidebarEnrichmentName(key, name);
      return name;
    } finally {
      sidebarEnrichmentInFlight.delete(key);
    }
  })();

  sidebarEnrichmentInFlight.set(key, pending);
  return pending;
}

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.floor(limit));
  const results: Array<PromiseSettledResult<R>> = [];
  for (let index = 0; index < items.length; index += safeLimit) {
    const batch = items.slice(index, index + safeLimit);
    const settled = await Promise.allSettled(batch.map((item) => mapper(item)));
    results.push(...settled);
  }
  return results;
}

async function getQueueCatalogMap(client: AutotaskClient): Promise<Map<number, string>> {
  const queues = await client.getTicketQueues();
  const map = new Map<number, string>();
  for (const q of queues) {
    const id = Number(q.id);
    const label = String(q.label || '').trim();
    if (Number.isFinite(id) && label) map.set(id, label);
  }
  return map;
}

async function resolveTicketOrgRequesterFallbacks(
  client: AutotaskClient,
  tickets: AutotaskTicket[],
  tenantId?: string | null
): Promise<{ companyNameById: Map<number, string>; requesterNameByContactId: Map<number, string> }> {
  const companyIds = new Set<number>();
  const contactIds = new Set<number>();

  for (const ticket of tickets) {
    const raw = ticket as any;
    const companyName = String(raw.companyName || raw.company || '').trim();
    const requesterName = String(raw.contactName || raw.requesterName || '').trim();
    const companyId = Number(raw.companyID);
    const contactId = Number(raw.contactID);
    if (!companyName && Number.isFinite(companyId)) companyIds.add(companyId);
    if (!requesterName && Number.isFinite(contactId)) contactIds.add(contactId);
  }

  const companyNameById = new Map<number, string>();
  const requesterNameByContactId = new Map<number, string>();

  const [companyResults, contactResults] = await Promise.all([
    mapWithConcurrencyLimit(
      Array.from(companyIds.values()),
      SIDEBAR_ENRICHMENT_CONCURRENCY_LIMIT,
      async (id) => {
        const key = buildSidebarEnrichmentKey(tenantId, 'company', id);
        const name = await getOrCreateSidebarEnrichmentName(key, async () => {
          const row = await client.getCompany(id);
          return String((row as any)?.companyName || (row as any)?.name || '').trim();
        });
        return { id, name };
      }
    ),
    mapWithConcurrencyLimit(
      Array.from(contactIds.values()),
      SIDEBAR_ENRICHMENT_CONCURRENCY_LIMIT,
      async (id) => {
        const key = buildSidebarEnrichmentKey(tenantId, 'contact', id);
        const name = await getOrCreateSidebarEnrichmentName(key, async () => {
          const row = await client.getContact(id);
          const first = String((row as any)?.firstName || '').trim();
          const last = String((row as any)?.lastName || '').trim();
          const fallback = `${first} ${last}`.trim();
          return String((row as any)?.fullName || (row as any)?.displayName || fallback).trim();
        });
        return { id, name };
      }
    ),
  ]);

  for (const result of companyResults) {
    if (result.status !== 'fulfilled') continue;
    if (!result.value.name) continue;
    companyNameById.set(result.value.id, result.value.name);
  }
  for (const result of contactResults) {
    if (result.status !== 'fulfilled') continue;
    if (!result.value.name) continue;
    requesterNameByContactId.set(result.value.id, result.value.name);
  }

  return { companyNameById, requesterNameByContactId };
}

function toSidebarTicketFromAutotask(
  ticket: AutotaskTicket,
  queueLabelMap: Map<number, string>,
  companyNameById: Map<number, string>,
  requesterNameByContactId: Map<number, string>
): SidebarTicketRow {
  const raw = ticket as any;
  const internalId = String(raw.id ?? '').trim();
  const ticketNumber = String(raw.ticketNumber || '').trim();
  const displayId = ticketNumber || internalId;
  const queueId = Number(raw.queueID);
  const companyId = Number(raw.companyID);
  const contactId = Number(raw.contactID);
  const queueName = Number.isFinite(queueId) ? String(queueLabelMap.get(queueId) || '').trim() : '';
  const companyName = String(raw.companyName || raw.company || '').trim()
    || (Number.isFinite(companyId) ? String(companyNameById.get(companyId) || '').trim() : '');
  const requesterName = String(raw.contactName || raw.requesterName || '').trim()
    || (Number.isFinite(contactId) ? String(requesterNameByContactId.get(contactId) || '').trim() : '');

  return {
    id: internalId || displayId,
    ticket_id: displayId,
    ...(ticketNumber ? { ticket_number: ticketNumber } : {}),
    status: mapAutotaskStatusToSidebar(raw.status),
    ...(raw.status !== undefined && raw.status !== null ? { ticket_status_value: raw.status } : {}),
    priority: mapAutotaskPriority(raw.priority),
    ...(raw.title ? { title: String(raw.title) } : {}),
    ...(raw.description ? { description: String(raw.description) } : {}),
    ...(companyName ? { company: companyName, org: companyName } : {}),
    ...(requesterName ? { requester: requesterName } : {}),
    ...(raw.createDate ? { created_at: String(raw.createDate) } : {}),
    ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
    ...(queueName ? { queue: queueName, queue_name: queueName } : {}),
  };
}

function buildAutotaskTicketSearch(options: {
  maxRecords: number;
  queueId?: number;
  createDateAfterIso?: string;
}): string {
  const filter = [
    ...(typeof options.queueId === 'number'
      ? [{ op: 'eq', field: 'queueID', value: options.queueId }]
      : []),
    ...(options.createDateAfterIso
      ? [{ op: 'gt', field: 'createDate', value: options.createDateAfterIso }]
      : []),
  ];
  return JSON.stringify({ MaxRecords: options.maxRecords, filter });
}

async function fetchSidebarTicketsPayload(input: {
  client: AutotaskClient;
  maxRecords: number;
  queueId: number;
  lookbackHours: number;
  tenantId?: string | null | undefined;
}): Promise<{ rows: SidebarTicketRow[]; queueId: number; lookbackHours: number }> {
  const createDateAfterIso = input.lookbackHours > 0
    ? new Date(Date.now() - input.lookbackHours * 60 * 60 * 1000).toISOString()
    : undefined;
  const search = buildAutotaskTicketSearch({
    maxRecords: input.maxRecords,
    queueId: input.queueId,
    ...(createDateAfterIso ? { createDateAfterIso } : {}),
  });
  const [tickets, queueLabelMap] = await Promise.all([
    input.client.searchTickets(search, input.maxRecords, 0),
    getQueueCatalogMap(input.client).catch(() => new Map<number, string>()),
  ]);
  const { companyNameById, requesterNameByContactId } = await resolveTicketOrgRequesterFallbacks(
    input.client,
    tickets,
    input.tenantId
  );
  const rows = tickets
    .slice()
    .sort(sortTicketsByCreateDateDesc)
    .map((ticket) => toSidebarTicketFromAutotask(ticket, queueLabelMap, companyNameById, requesterNameByContactId));
  return {
    rows,
    queueId: input.queueId,
    lookbackHours: input.lookbackHours,
  };
}

async function waitForSidebarTicketsCache(
  cacheKey: string,
  timeoutMs: number
): Promise<{ rows: SidebarTicketRow[]; queueId: number; lookbackHours: number } | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const cached = readCachedSidebarTickets(cacheKey);
    if (cached) return cached;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

async function loadSidebarTicketsUnderAdvisoryLock(input: {
  cacheKey: string;
  lockKey: number;
  client: AutotaskClient;
  maxRecords: number;
  queueId: number;
  lookbackHours: number;
  tenantId?: string | null | undefined;
}): Promise<{ acquired: false } | { acquired: true; payload: { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number } }> {
  const lockResult = await withTryAdvisoryLock(
    SIDEBAR_TICKETS_LOCK_NAMESPACE,
    input.lockKey,
    async () => {
      const lockCached = readCachedSidebarTickets(input.cacheKey);
      if (lockCached) return lockCached;
      const computed = await fetchSidebarTicketsPayload({
        client: input.client,
        maxRecords: input.maxRecords,
        queueId: input.queueId,
        lookbackHours: input.lookbackHours,
        tenantId: input.tenantId,
      });
      writeCachedSidebarTickets(input.cacheKey, computed);
      return computed;
    }
  );
  if (!lockResult.acquired) return { acquired: false };
  return { acquired: true, payload: lockResult.result };
}

async function loadSidebarTicketsWithCoordination(input: {
  cacheKey: string;
  lockKey: number;
  client: AutotaskClient;
  maxRecords: number;
  queueId: number;
  lookbackHours: number;
  tenantId?: string | null | undefined;
}): Promise<{ rows: SidebarTicketRow[]; queueId: number; lookbackHours: number }> {
  const cached = readCachedSidebarTickets(input.cacheKey);
  if (cached) return cached;

  const inFlight = sidebarTicketsInFlight.get(input.cacheKey);
  if (inFlight) return inFlight;

  const requestPromise = (async () => {
    const secondCached = readCachedSidebarTickets(input.cacheKey);
    if (secondCached) return secondCached;

    try {
      const coordinationDeadline = Date.now() + SIDEBAR_TICKETS_LOCK_WAIT_TIMEOUT_MS;
      while (Date.now() < coordinationDeadline) {
        const lockLoad = await loadSidebarTicketsUnderAdvisoryLock(input);
        if (lockLoad.acquired) return lockLoad.payload;

        const cachedAfterMiss = readCachedSidebarTickets(input.cacheKey);
        if (cachedAfterMiss) return cachedAfterMiss;

        const remainingMs = coordinationDeadline - Date.now();
        if (remainingMs <= 0) break;
        const waitedCache = await waitForSidebarTicketsCache(
          input.cacheKey,
          Math.min(remainingMs, SIDEBAR_TICKETS_LOCK_RETRY_INTERVAL_MS)
        );
        if (waitedCache) return waitedCache;
      }
    } catch (error) {
      // Provider throttling/dependency failures must not trigger a second immediate upstream retry.
      if (classifySidebarTicketsDegradedReason(error)) {
        throw error;
      }
      // Lock coordination failures can still fall back to direct provider read.
    }

    const computed = await fetchSidebarTicketsPayload({
      client: input.client,
      maxRecords: input.maxRecords,
      queueId: input.queueId,
      lookbackHours: input.lookbackHours,
      tenantId: input.tenantId,
    });
    writeCachedSidebarTickets(input.cacheKey, computed);
    return computed;
  })();

  sidebarTicketsInFlight.set(input.cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    sidebarTicketsInFlight.delete(input.cacheKey);
  }
}

async function getExistingTicketCoverageMap(ticketIds: string[]) {
  if (ticketIds.length === 0) return new Map<string, { inProcessed: boolean; inSessions: boolean; inSsot: boolean }>();
  const rows = await query<{
    ticket_id: string;
    in_processed: boolean;
    in_sessions: boolean;
    in_ssot: boolean;
  }>(
    `WITH keys AS (SELECT unnest($1::text[]) AS ticket_id)
     SELECT k.ticket_id,
            EXISTS (SELECT 1 FROM tickets_processed tp WHERE tp.id = k.ticket_id) AS in_processed,
            EXISTS (SELECT 1 FROM triage_sessions ts WHERE ts.ticket_id = k.ticket_id) AS in_sessions,
            EXISTS (SELECT 1 FROM ticket_ssot s WHERE s.ticket_id = k.ticket_id) AS in_ssot
     FROM keys k`,
    [ticketIds]
  );
  return new Map(rows.map((r) => [r.ticket_id, {
    inProcessed: Boolean(r.in_processed),
    inSessions: Boolean(r.in_sessions),
    inSsot: Boolean(r.in_ssot),
  }]));
}

function resolvePicklistLabel(options: Array<{ id: number; label: string }>, rawValue: unknown): string | null {
  const numeric = Number(rawValue);
  if (Number.isFinite(numeric)) {
    const match = options.find((option) => option.id === numeric);
    if (match) return match.label;
  }
  const text = String(rawValue ?? '').trim();
  return text || null;
}

/**
 * GET /autotask/ticket/:id
 * Get ticket by ID (read-only)
 */
router.get('/ticket/:id', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const ticketId = parseInt(req.params.id, 10);
    const ticket = await client.getTicket(ticketId);
    res.json({
      success: true,
      data: ticket,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/tickets/search
 * Search tickets (read-only)
 */
router.get('/tickets/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const filter = req.query.filter as string;
    if (!filter) {
      res.status(400).json({ error: 'filter query parameter is required' });
      return;
    }
    const tickets = await client.searchTickets(filter);
    res.json({
      success: true,
      data: tickets,
      count: tickets.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/device/:id
 * Get device by ID (read-only)
 */
router.get('/device/:id', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const deviceId = parseInt(req.params.id, 10);
    const device = await client.getDevice(deviceId);
    res.json({
      success: true,
      data: device,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/company/:companyId/devices
 * Get all devices for a company (read-only)
 */
router.get('/company/:companyId/devices', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const companyId = parseInt(req.params.companyId, 10);
    const devices = await client.getDevicesByCompany(companyId);
    res.json({
      success: true,
      data: devices,
      count: devices.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/ticket/:id/notes
 * Get ticket notes (read-only)
 */
router.get('/ticket/:id/notes', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) { res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' }); return; }
    const requestedRef = String(req.params.id || '').trim();
    if (!requestedRef) {
      res.status(400).json({ error: 'ticket reference required' });
      return;
    }

    let ticketId = Number.NaN;
    if (/^\d+$/.test(requestedRef)) {
      ticketId = Number.parseInt(requestedRef, 10);
    } else {
      const ticket = await client.getTicketByTicketNumber(requestedRef);
      ticketId = Number((ticket as any)?.id);
    }
    if (!Number.isFinite(ticketId)) {
      res.status(404).json({ error: `Ticket ${requestedRef} not found` });
      return;
    }

    const notes = await client.getTicketNotes(ticketId);
    res.json({
      success: true,
      data: notes,
      count: notes.length,
      ticket_lookup: {
        requested_ref: requestedRef,
        resolved_ticket_id: ticketId,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ticket-field-options', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }
    const tenantScope = resolveTenantScope(req.auth?.tid);

    const requestedField = String(req.query.field || '').trim();
    const fieldLoaders = {
      queue: () => client.getTicketQueues(),
      priority: () => client.getTicketPriorityOptions(),
      status: () => client.getTicketStatusOptions(),
      issueType: () => client.getTicketIssueTypeOptions(),
      subIssueType: () => client.getTicketSubIssueTypeOptions(),
      serviceLevelAgreement: () => client.getTicketServiceLevelAgreementOptions(),
    } as const;

    if (requestedField) {
      if (!(requestedField in fieldLoaders)) {
        res.status(400).json({ error: 'Unsupported ticket field options request' });
        return;
      }
      const cacheKey = buildTenantCacheKey({
        tenantId: tenantScope,
        domain: 'autotask',
        resource: `ticket_field_options_${requestedField}`,
        params: { field: requestedField },
      });
      const cached = await distributedCache.getOrLoad({
        key: cacheKey,
        resource: 'autotask_ticket_field_options',
        tags: [metadataTag(tenantScope)],
        ttlMs: 15 * 60 * 1000,
        staleMs: 2 * 60 * 60 * 1000,
        negativeTtlMs: 30 * 1000,
        loader: async () => {
          const loader = fieldLoaders[requestedField as TicketFieldKey];
          const result = await loadCachedReadOnlyArray(requestedField as TicketFieldKey, loader);
          return {
            data: result.data,
            count: result.data.length,
            field: requestedField,
            ...(result.degradedReason
              ? { degraded: { provider: 'Autotask', reason: result.degradedReason } }
              : {}),
          };
        },
      });
      res.json({
        success: true,
        ...cached.value,
        cache: cached.meta,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'ticket_field_options',
      params: { field: 'all' },
    });
    const cached = await distributedCache.getOrLoad({
      key: cacheKey,
      resource: 'autotask_ticket_field_options',
      tags: [metadataTag(tenantScope)],
      ttlMs: 15 * 60 * 1000,
      staleMs: 2 * 60 * 60 * 1000,
      loader: async () => {
        const queueResult = await loadCachedReadOnlyArray('queue', fieldLoaders.queue);
        const priorityResult = await loadCachedReadOnlyArray('priority', fieldLoaders.priority);
        const statusResult = await loadCachedReadOnlyArray('status', fieldLoaders.status);
        const issueTypeResult = await loadCachedReadOnlyArray('issueType', fieldLoaders.issueType);
        const subIssueTypeResult = await loadCachedReadOnlyArray('subIssueType', fieldLoaders.subIssueType);
        const serviceLevelAgreementResult = await loadCachedReadOnlyArray(
          'serviceLevelAgreement',
          fieldLoaders.serviceLevelAgreement
        );

        const degraded = [
          queueResult,
          priorityResult,
          statusResult,
          issueTypeResult,
          subIssueTypeResult,
          serviceLevelAgreementResult,
        ].some((result) => Boolean(result.degradedReason));

        return {
          data: {
            queue: queueResult.data,
            priority: priorityResult.data,
            status: statusResult.data,
            issueType: issueTypeResult.data,
            subIssueType: subIssueTypeResult.data,
            serviceLevelAgreement: serviceLevelAgreementResult.data,
          },
          ...(degraded
            ? { degraded: { provider: 'Autotask', reason: 'read_only_provider_unavailable_or_rate_limited' } }
            : {}),
        };
      },
    });

    res.json({
      success: true,
      ...cached.value,
      cache: cached.meta,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ticket-draft-defaults', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }
    const tenantScope = resolveTenantScope(req.auth?.tid);
    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'ticket_draft_defaults',
      params: {},
    });
    let data: unknown = null;
    let cacheMeta: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const cached = await distributedCache.getOrLoad<unknown>({
        key: cacheKey,
        resource: 'autotask_ticket_draft_defaults',
        tags: [metadataTag(tenantScope)],
        ttlMs: 15 * 60 * 1000,
        staleMs: 2 * 60 * 60 * 1000,
        loader: async () => client.getTicketDraftDefaults(),
      });
      data = cached.value;
      cacheMeta = cached.meta;
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }
    res.json({
      success: true,
      data,
      ...(cacheMeta ? { cache: cacheMeta } : {}),
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/queues
 * List real queue options from Autotask Tickets.queueID picklist
 */
router.get('/queues', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }
    const tenantScope = resolveTenantScope(req.auth?.tid);
    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'queues',
      params: {},
    });
    let rows: unknown[] = [];
    let cacheMeta: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const cached = await distributedCache.getOrLoad<unknown[]>({
        key: cacheKey,
        resource: 'autotask_queues',
        tags: [metadataTag(tenantScope)],
        ttlMs: 10 * 60 * 1000,
        staleMs: 2 * 60 * 60 * 1000,
        negativeTtlMs: 30 * 1000,
        loader: async () => client.getTicketQueues(),
      });
      rows = Array.isArray(cached.value) ? cached.value : [];
      cacheMeta = cached.meta;
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }
    if (degradedReason && rows.length === 0 && !cacheMeta) {
      res.status(503).json({
        error: 'Queue catalog unavailable',
        degraded: { provider: 'Autotask', reason: degradedReason },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: rows,
      count: rows.length,
      ...(cacheMeta ? { cache: cacheMeta } : {}),
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/companies/search
 * Read-only company search for UI selectors.
 */
router.get('/companies/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const tenantScope = resolveTenantScope(req.auth?.tid);
    const normalizedQuery = q.toLowerCase();
    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'companies_search',
      params: { q: normalizedQuery, limit },
    });
    let finalData: Array<{ id: number; name: string }> = [];
    let cacheMeta: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const cached = await distributedCache.getOrLoad<Array<{ id: number; name: string }>>({
        key: cacheKey,
        resource: 'autotask_companies_search',
        tags: [searchTag(tenantScope)],
        ttlMs: 90 * 1000,
        staleMs: 10 * 60 * 1000,
        negativeTtlMs: 30 * 1000,
        loader: async () => {
          const filter = q
            ? [{ op: 'contains', field: 'companyName', value: q }]
            : [{ op: 'eq', field: 'isActive', value: true }];
          const rows = await client.searchCompanies(
            stringifyStructuredSearch(filter, limit),
            limit
          );
          return rows
            .map((row) => {
              const id = Number((row as any)?.id);
              const name = String((row as any)?.companyName || '').trim();
              const isActiveRaw = (row as any)?.isActive;
              const isInactiveRaw = (row as any)?.isInactive;
              const isActive = typeof isActiveRaw === 'boolean'
                ? isActiveRaw
                : typeof isInactiveRaw === 'boolean'
                  ? !isInactiveRaw
                  : false;
              if (!Number.isFinite(id) || !name) return null;
              return { id, name, isActive };
            })
            .filter((item) => {
              if (!item) return false;
              const isRefreshException = item.name.toLowerCase().includes('refresh');
              return item.isActive || isRefreshException;
            })
            .map((item) => item ? ({ id: item.id, name: item.name }) : null)
            .filter((item): item is { id: number; name: string } => Boolean(item))
            .slice(0, limit);
        },
      });
      finalData = cached.value;
      cacheMeta = cached.meta;
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(cacheMeta ? { cache: cacheMeta } : {}),
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/contacts/search
 * Read-only contact search for UI selectors.
 */
router.get('/contacts/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const maybeCompanyId = Number.parseInt(String(req.query.companyId ?? ''), 10);
    const companyId = Number.isFinite(maybeCompanyId) ? maybeCompanyId : null;
    const tenantScope = resolveTenantScope(req.auth?.tid);
    const normalizedQuery = q.toLowerCase();
    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'contacts_search',
      params: { companyId, q: normalizedQuery, limit },
    });
    let finalData: Array<{
      id: number;
      name: string;
      companyId?: number;
      email?: string;
    }> = [];
    let cacheMeta: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const cached = await distributedCache.getOrLoad<Array<{
        id: number;
        name: string;
        companyId?: number;
        email?: string;
      }>>({
        key: cacheKey,
        resource: 'autotask_contacts_search',
        tags: [searchTag(tenantScope)],
        ttlMs: 90 * 1000,
        staleMs: 10 * 60 * 1000,
        negativeTtlMs: 30 * 1000,
        loader: async () => {
          const filter: Array<Record<string, unknown>> = [];
          if (companyId !== null) filter.push({ op: 'eq', field: 'companyID', value: companyId });
          const rows = await client.searchContacts(stringifyStructuredSearch(filter, limit), limit);
          return rows
            .map((row) => {
              const id = Number((row as any)?.id);
              const firstName = String((row as any)?.firstName || '').trim();
              const lastName = String((row as any)?.lastName || '').trim();
              const fullName = `${firstName} ${lastName}`.trim();
              const name = fullName || String((row as any)?.displayName || '').trim();
              const rowCompanyId = Number((row as any)?.companyID);
              if (!Number.isFinite(id) || !name) return null;
              return {
                id,
                name,
                ...(Number.isFinite(rowCompanyId) ? { companyId: rowCompanyId } : {}),
                ...(typeof (row as any)?.emailAddress === 'string'
                  ? { email: String((row as any).emailAddress).trim() }
                  : {}),
              };
            })
            .filter((item) => {
              if (!item) return false;
              if (!q) return true;
              const needle = q.toLowerCase();
              return item.name.toLowerCase().includes(needle) || String(item.email || '').toLowerCase().includes(needle);
            })
            .filter((item): item is { id: number; name: string; companyId?: number; email?: string } => Boolean(item));
        },
      });
      finalData = cached.value;
      cacheMeta = cached.meta;
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(cacheMeta ? { cache: cacheMeta } : {}),
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/resources/search
 * Read-only technician/resource search for assignment UX.
 */
router.get('/resources/search', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const q = sanitizeSearchTerm(req.query.q);
    const limit = parseIntParam(req.query.limit, 25, { min: 1, max: 100 });
    const tenantScope = resolveTenantScope(req.auth?.tid);
    const normalizedQuery = q.toLowerCase();
    const cacheKey = buildTenantCacheKey({
      tenantId: tenantScope,
      domain: 'autotask',
      resource: 'resources_search',
      params: { q: normalizedQuery, limit },
    });
    let finalData: Array<{ id: number; name: string; email?: string }> = [];
    let cacheMeta: unknown;
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    try {
      const cached = await distributedCache.getOrLoad<Array<{ id: number; name: string; email?: string }>>({
        key: cacheKey,
        resource: 'autotask_resources_search',
        tags: [searchTag(tenantScope)],
        ttlMs: 90 * 1000,
        staleMs: 10 * 60 * 1000,
        negativeTtlMs: 30 * 1000,
        loader: async () => {
          const providerLimit = q ? Math.max(limit, 100) : limit;
          const filter: Array<Record<string, unknown>> = [{ op: 'eq', field: 'isActive', value: true }];
          const rows = await client.searchResources(stringifyStructuredSearch(filter, providerLimit), providerLimit);
          const data = rows
            .map((row) => {
              const id = Number((row as any)?.id);
              const defaultRoleId = Number((row as any)?.defaultServiceDeskRoleID);
              const firstName = String((row as any)?.firstName || '').trim();
              const lastName = String((row as any)?.lastName || '').trim();
              const fullName = `${firstName} ${lastName}`.trim();
              const name = fullName || String((row as any)?.userName || '').trim();
              // Assignment flow requires a valid default service desk role for the resource.
              if (!Number.isFinite(id) || !name || !Number.isFinite(defaultRoleId)) return null;
              return {
                id,
                name,
                ...(typeof (row as any)?.email === 'string' ? { email: String((row as any).email).trim() } : {}),
              };
            })
            .filter((item) => {
              if (!item) return false;
              if (!q) return true;
              const needle = q.toLowerCase();
              return item.name.toLowerCase().includes(needle) || String(item.email || '').toLowerCase().includes(needle);
            })
            .filter((item): item is { id: number; name: string; email?: string } => Boolean(item));
          return data.slice(0, limit);
        },
      });
      finalData = cached.value;
      cacheMeta = cached.meta;
    } catch (error) {
      degradedReason = classifyAutotaskReadDegradedReason(error);
    }

    res.json({
      success: true,
      data: finalData,
      count: finalData.length,
      ...(cacheMeta ? { cache: cacheMeta } : {}),
      ...(degradedReason
        ? { degraded: { provider: 'Autotask', reason: degradedReason } }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /autotask/sidebar-tickets
 * Direct queue-backed ticket list for Global sidebar mode (bypasses Cerebro pipeline coverage limits).
 */
router.get('/sidebar-tickets', async (req, res, next) => {
  try {
    const tenantScope = String(req.auth?.tid || tenantContext.getStore()?.tenantId || 'global').trim().toLowerCase();
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const maxRecords = parseIntParam(req.query.limit, 75, { min: 1, max: 200 });
    const queueIdRaw = String(req.query.queueId ?? '').trim();
    const queueId = Number.parseInt(queueIdRaw, 10);
    const hasQueueId = Number.isFinite(queueId);
    if (!hasQueueId) {
      res.status(400).json({ error: 'queueId query parameter is required for direct sidebar tickets' });
      return;
    }
    const lookbackHours = parseIntParam(req.query.lookbackHours, 24 * 30, { min: 1, max: 24 * 365 });
    const cacheKey = buildSidebarTicketsCacheKey({
      tenantScope,
      queueId,
      maxRecords,
      lookbackHours,
    });
    const activeCooldownUntil = readSidebarTicketsRateLimitCooldown(cacheKey);
    if (activeCooldownUntil) {
      const cooldownPayload = readSidebarTicketsStale(cacheKey) || {
        rows: [],
        queueId,
        lookbackHours,
      };
      res.json({
        success: true,
        data: cooldownPayload.rows,
        count: cooldownPayload.rows.length,
        source: 'autotask_direct',
        queueId: cooldownPayload.queueId,
        lookbackHours: cooldownPayload.lookbackHours,
        degraded: {
          provider: 'Autotask',
          reason: 'rate_limited',
          cooldownUntil: new Date(activeCooldownUntil).toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    const lockKey = hashToPositiveInt32(cacheKey);
    let payload: { rows: SidebarTicketRow[]; queueId: number; lookbackHours: number };
    let degradedReason: 'rate_limited' | 'provider_error' | undefined;
    let cooldownUntilIso: string | undefined;
    try {
      payload = await loadSidebarTicketsWithCoordination({
        cacheKey,
        lockKey,
        client,
        maxRecords,
        queueId,
        lookbackHours,
        tenantId: req.auth?.tid,
      });
      clearSidebarTicketsRateLimitCooldown(cacheKey);
    } catch (error) {
      degradedReason = classifySidebarTicketsDegradedReason(error) || undefined;
      if (!degradedReason) throw error;
      if (degradedReason === 'rate_limited') {
        setSidebarTicketsRateLimitCooldown(cacheKey);
        const cooldownUntil = readSidebarTicketsRateLimitCooldown(cacheKey);
        cooldownUntilIso = cooldownUntil ? new Date(cooldownUntil).toISOString() : undefined;
      }
      payload = readSidebarTicketsStale(cacheKey) || {
        rows: [],
        queueId,
        lookbackHours,
      };
    }

    res.json({
      success: true,
      data: payload.rows,
      count: payload.rows.length,
      source: 'autotask_direct',
      queueId: payload.queueId,
      lookbackHours: payload.lookbackHours,
      ...(degradedReason
        ? {
          degraded: {
            provider: 'Autotask',
            reason: degradedReason,
            ...(cooldownUntilIso ? { cooldownUntil: cooldownUntilIso } : {}),
          },
        }
        : {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /autotask/backfill-recent
 * Seed/reconcile recent Autotask tickets into Cerebro pipeline tables for sidebar coverage.
 */
router.post('/backfill-recent', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const lookbackHours = parseIntParam(req.body?.lookbackHours, 24, { min: 1, max: 24 * 30 });
    const maxRecords = parseIntParam(req.body?.maxTickets, 100, { min: 1, max: 200 });
    const maybeQueueId = Number.parseInt(String(req.body?.queueId ?? ''), 10);
    const queueId = Number.isFinite(maybeQueueId) ? maybeQueueId : undefined;
    const runPipeline = Boolean(req.body?.runPipeline);
    const dryRun = Boolean(req.body?.dryRun);

    const createDateAfterIso = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const search = buildAutotaskTicketSearch({
      maxRecords,
      ...(typeof queueId === 'number' ? { queueId } : {}),
      createDateAfterIso,
    });
    const tickets = (await client.searchTickets(search, maxRecords, 0))
      .slice()
      .sort(sortTicketsByCreateDateDesc);

    const ticketKeys = tickets.map((ticket) => String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim()).filter(Boolean);
    const coverage = await getExistingTicketCoverageMap(ticketKeys);

    const missing = tickets.filter((ticket) => {
      const key = String((ticket as any)?.ticketNumber || (ticket as any)?.id || '').trim();
      const hit = coverage.get(key);
      return !(hit?.inProcessed || hit?.inSessions || hit?.inSsot);
    });

    let seededProcessed = 0;
    let pipelineTriggered = 0;
    const pipelineErrors: Array<{ ticket_id: string; error: string }> = [];

    for (const ticket of missing) {
      const raw = ticket as any;
      const ticketKey = String(raw.ticketNumber || raw.id || '').trim();
      if (!ticketKey) continue;

      if (!dryRun) {
        await pgStore.saveProcessedTicket({
          id: ticketKey,
          title: String(raw.title || '').trim() || `Autotask Ticket ${ticketKey}`,
          description: String(raw.description || '').trim(),
          company: String(raw.companyName || raw.company || '').trim() || null,
          requester: String(raw.contactName || raw.requesterName || 'Autotask').trim() || 'Autotask',
          source: 'autotask',
          status: 'open',
          rawBody: String(raw.description || '').trim(),
          isReply: false,
          createdAt: String(raw.createDate || new Date().toISOString()),
        });
        seededProcessed += 1;
      }

      if (runPipeline && !dryRun) {
        try {
          await triageOrchestrator.runPipeline(ticketKey, undefined, 'autotask');
          pipelineTriggered += 1;
        } catch (err: any) {
          pipelineErrors.push({ ticket_id: ticketKey, error: String(err?.message || err || 'unknown error') });
        }
      }
    }

    res.json({
      success: true,
      data: {
        lookbackHours,
        maxTickets: maxRecords,
        ...(typeof queueId === 'number' ? { queueId } : {}),
        dryRun,
        runPipeline,
        scanned: tickets.length,
        missingCoverage: missing.length,
        seededProcessed,
        pipelineTriggered,
        pipelineErrorsCount: pipelineErrors.length,
        sampleMissing: missing.slice(0, 10).map((ticket) => ({
          id: (ticket as any)?.id ?? null,
          ticketNumber: (ticket as any)?.ticketNumber ?? null,
          queueID: (ticket as any)?.queueID ?? null,
          title: (ticket as any)?.title ?? null,
        })),
        ...(pipelineErrors.length > 0 ? { pipelineErrors: pipelineErrors.slice(0, 10) } : {}),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /autotask/ticket/:ticketId/context
 * Write-safe ticket context update (company/contact + optional ticket metadata) + local SSOT persistence.
 */
router.patch('/ticket/:ticketId/context', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId is required' });
      return;
    }

    const maybeCompanyId = Number.parseInt(String(req.body?.companyId ?? req.body?.companyID ?? ''), 10);
    const maybeContactId = Number.parseInt(String(req.body?.contactId ?? req.body?.contactID ?? ''), 10);
    const maybePriorityId = Number.parseInt(String(req.body?.priorityId ?? req.body?.priorityID ?? req.body?.priority ?? ''), 10);
    const maybeIssueTypeId = Number.parseInt(String(req.body?.issueTypeId ?? req.body?.issueType ?? ''), 10);
    const maybeSubIssueTypeId = Number.parseInt(String(req.body?.subIssueTypeId ?? req.body?.subIssueType ?? ''), 10);
    const maybeServiceLevelAgreementId = Number.parseInt(String(req.body?.serviceLevelAgreementId ?? req.body?.serviceLevelAgreementID ?? req.body?.sla ?? ''), 10);
    const companyId = Number.isFinite(maybeCompanyId) ? maybeCompanyId : null;
    const contactId = Number.isFinite(maybeContactId) ? maybeContactId : null;
    const priorityId = Number.isFinite(maybePriorityId) ? maybePriorityId : null;
    const issueTypeId = Number.isFinite(maybeIssueTypeId) ? maybeIssueTypeId : null;
    const subIssueTypeId = Number.isFinite(maybeSubIssueTypeId) ? maybeSubIssueTypeId : null;
    const serviceLevelAgreementId = Number.isFinite(maybeServiceLevelAgreementId) ? maybeServiceLevelAgreementId : null;
    if (
      companyId === null &&
      contactId === null &&
      priorityId === null &&
      issueTypeId === null &&
      subIssueTypeId === null &&
      serviceLevelAgreementId === null
    ) {
      res.status(400).json({ error: 'At least one supported field is required' });
      return;
    }

    const patch: Record<string, unknown> = {};
    if (companyId !== null) {
      patch.companyID = companyId;
      // Company change can invalidate legacy companyLocation/contact links on the ticket.
      patch.companyLocationID = null;
      if (contactId === null) {
        patch.contactID = null;
      }
    }
    if (contactId !== null) patch.contactID = contactId;
    if (priorityId !== null) patch.priority = priorityId;
    if (issueTypeId !== null) patch.issueType = issueTypeId;
    if (subIssueTypeId !== null) patch.subIssueType = subIssueTypeId;
    if (serviceLevelAgreementId !== null) patch.serviceLevelAgreementID = serviceLevelAgreementId;
    await client.updateTicket(ticketId, patch);

    const ticket = /^\d+$/.test(ticketId)
      ? await client.getTicket(Number(ticketId))
      : await client.getTicketByTicketNumber(ticketId);

    const authoritativeCompanyId = Number((ticket as any)?.companyID);
    const authoritativeContactId = Number((ticket as any)?.contactID);
    const company = Number.isFinite(authoritativeCompanyId)
      ? await client.getCompany(authoritativeCompanyId).catch(() => null)
      : null;
    const contact = Number.isFinite(authoritativeContactId)
      ? await client.getContact(authoritativeContactId).catch(() => null)
      : null;
    const authoritativePriorityId = Number((ticket as any)?.priority);
    const authoritativeIssueTypeId = Number((ticket as any)?.issueType);
    const authoritativeSubIssueTypeId = Number((ticket as any)?.subIssueType);
    const authoritativeServiceLevelAgreementId = Number((ticket as any)?.serviceLevelAgreementID);

    const [priorityOptions, issueTypeOptions, subIssueTypeOptions, serviceLevelAgreementOptions] = await Promise.all([
      client.getTicketPriorityOptions().catch(() => []),
      client.getTicketIssueTypeOptions().catch(() => []),
      client.getTicketSubIssueTypeOptions().catch(() => []),
      client.getTicketServiceLevelAgreementOptions().catch(() => []),
    ]);

    const authoritativePriorityLabel = resolvePicklistLabel(priorityOptions, (ticket as any)?.priority);
    const authoritativeIssueTypeLabel = resolvePicklistLabel(issueTypeOptions, (ticket as any)?.issueType);
    const authoritativeSubIssueTypeLabel = resolvePicklistLabel(subIssueTypeOptions, (ticket as any)?.subIssueType);
    const authoritativeServiceLevelAgreementLabel = resolvePicklistLabel(serviceLevelAgreementOptions, (ticket as any)?.serviceLevelAgreementID);

    const ticketKey = String((ticket as any)?.ticketNumber || ticketId).trim();
    const existingSsot = await queryOne<{ payload: any }>(
      `SELECT payload FROM ticket_ssot WHERE ticket_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [ticketKey]
    );
    const latestSession = await queryOne<{ id: string }>(
      `SELECT id FROM triage_sessions WHERE ticket_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [ticketKey]
    );

    const nextPayload = {
      ...(existingSsot?.payload || {}),
      ...(company && String((company as any)?.companyName || '').trim()
        ? { company: String((company as any)?.companyName || '').trim() }
        : {}),
      ...(contact && `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim()
        ? { requester_name: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() }
        : {}),
      autotask_authoritative: {
        ...((existingSsot?.payload?.autotask_authoritative || {}) as Record<string, unknown>),
        ticket_number: String((ticket as any)?.ticketNumber || ticketKey),
        ticket_id_numeric: Number.isFinite(Number((ticket as any)?.id)) ? Number((ticket as any)?.id) : null,
        company_id: Number.isFinite(authoritativeCompanyId) ? authoritativeCompanyId : null,
        company_name: String((company as any)?.companyName || '').trim() || null,
        contact_id: Number.isFinite(authoritativeContactId) ? authoritativeContactId : null,
        contact_name: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() || null,
        contact_email: String((contact as any)?.emailAddress || '').trim() || null,
        priority_id: Number.isFinite(authoritativePriorityId) ? authoritativePriorityId : null,
        priority_label: authoritativePriorityLabel,
        issue_type_id: Number.isFinite(authoritativeIssueTypeId) ? authoritativeIssueTypeId : null,
        issue_type_label: authoritativeIssueTypeLabel,
        sub_issue_type_id: Number.isFinite(authoritativeSubIssueTypeId) ? authoritativeSubIssueTypeId : null,
        sub_issue_type_label: authoritativeSubIssueTypeLabel,
        service_level_agreement_id: Number.isFinite(authoritativeServiceLevelAgreementId) ? authoritativeServiceLevelAgreementId : null,
        service_level_agreement_label: authoritativeServiceLevelAgreementLabel,
      },
    };

    await query(
      `INSERT INTO ticket_ssot (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET
         session_id = EXCLUDED.session_id,
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [ticketKey, latestSession?.id ?? null, JSON.stringify(nextPayload)]
    );

    res.json({
      success: true,
      data: {
        ticketId: ticketKey,
        companyId: Number.isFinite(authoritativeCompanyId) ? authoritativeCompanyId : null,
        companyName: String((company as any)?.companyName || '').trim() || null,
        contactId: Number.isFinite(authoritativeContactId) ? authoritativeContactId : null,
        contactName: `${String((contact as any)?.firstName || '').trim()} ${String((contact as any)?.lastName || '').trim()}`.trim() || null,
        contactEmail: String((contact as any)?.emailAddress || '').trim() || null,
        priorityId: Number.isFinite(authoritativePriorityId) ? authoritativePriorityId : null,
        priorityLabel: authoritativePriorityLabel,
        issueTypeId: Number.isFinite(authoritativeIssueTypeId) ? authoritativeIssueTypeId : null,
        issueTypeLabel: authoritativeIssueTypeLabel,
        subIssueTypeId: Number.isFinite(authoritativeSubIssueTypeId) ? authoritativeSubIssueTypeId : null,
        subIssueTypeLabel: authoritativeSubIssueTypeLabel,
        serviceLevelAgreementId: Number.isFinite(authoritativeServiceLevelAgreementId) ? authoritativeServiceLevelAgreementId : null,
        serviceLevelAgreementLabel: authoritativeServiceLevelAgreementLabel,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /autotask/ticket/:ticketId/attachments
 * Upload regular ticket attachments to Autotask (TicketAttachments entity).
 */
router.post('/ticket/:ticketId/attachments', async (req, res, next) => {
  try {
    const client = await getTenantScopedClient(req.auth?.tid);
    if (!client) {
      res.status(503).json({ error: 'Integration not configured. Add credentials in Settings → Connections.' });
      return;
    }

    const ticketId = String(req.params.ticketId || '').trim();
    if (!ticketId) {
      res.status(400).json({ error: 'ticketId is required' });
      return;
    }

    const body = (req.body || {}) as {
      files?: Array<{
        fileName?: string;
        contentType?: string;
        dataBase64?: string;
        title?: string;
      }>;
    };

    const files = Array.isArray(body.files) ? body.files : [];
    if (files.length === 0) {
      res.status(400).json({ error: 'files[] is required' });
      return;
    }

    const results: Array<{
      fileName: string;
      uploaded: boolean;
      attachmentId?: string;
      error?: string;
    }> = [];

    for (const file of files) {
      const fileName = String(file?.fileName || '').trim();
      const contentType = String(file?.contentType || 'application/octet-stream').trim();
      const dataBase64 = toBase64Payload(file?.dataBase64);
      const estimatedSize = estimateBase64DecodedSize(dataBase64);

      if (!fileName || !dataBase64) {
        results.push({ fileName: fileName || 'unknown', uploaded: false, error: 'fileName and dataBase64 are required' });
        continue;
      }
      if (estimatedSize > MAX_ATTACHMENT_BYTES) {
        results.push({
          fileName,
          uploaded: false,
          error: `file exceeds max size (${MAX_ATTACHMENT_BYTES} bytes)`,
        });
        continue;
      }

      try {
        const created = await client.createTicketAttachment(ticketId, {
          title: String(file?.title || fileName).trim(),
          fileName,
          contentType,
          dataBase64,
        });
        results.push({
          fileName,
          uploaded: true,
          attachmentId: String((created as any)?.id || (created as any)?.item?.id || ''),
        });
      } catch (err) {
        results.push({
          fileName,
          uploaded: false,
          error: (err as Error)?.message || 'upload failed',
        });
      }
    }

    const failed = results.filter((r) => !r.uploaded);
    res.status(failed.length > 0 ? 207 : 200).json({
      success: failed.length === 0,
      data: {
        ticketId,
        uploadedCount: results.filter((r) => r.uploaded).length,
        failedCount: failed.length,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
