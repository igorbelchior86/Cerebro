import { queryOne } from '../../db/index.js';

const DEFAULT_TENANT_SLUG_RETRY_LIMIT = 8;

type TenantRow = { id: string };

export async function uniqueTenantSlug(base: string): Promise<string> {
  for (let i = 0; ; i += 1) {
    const slug = i === 0 ? base : `${base}-${i}`;
    const existing = await queryOne<TenantRow>('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (!existing) return slug;
  }
}

export function isTenantSlugConflict(error: unknown): boolean {
  const candidate = (error || {}) as { code?: unknown; constraint?: unknown; detail?: unknown };
  const code = String(candidate.code || '').trim();
  if (code !== '23505') return false;
  const constraint = String(candidate.constraint || '').trim().toLowerCase();
  const detail = String(candidate.detail || '').toLowerCase();
  return constraint === 'tenants_slug_key' || detail.includes('(slug)=');
}

export async function withRetriedTenantSlug<T>(
  base: string,
  work: (slug: string) => Promise<T>,
  maxAttempts = DEFAULT_TENANT_SLUG_RETRY_LIMIT,
): Promise<{ slug: string; result: T }> {
  let slug = await uniqueTenantSlug(base);
  for (let attempt = 0; ; attempt += 1) {
    try {
      return {
        slug,
        result: await work(slug),
      };
    } catch (error) {
      if (!isTenantSlugConflict(error) || attempt >= maxAttempts) {
        throw error;
      }
      slug = await uniqueTenantSlug(base);
    }
  }
}
