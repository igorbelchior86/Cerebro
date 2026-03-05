import { queryOne } from '../../db/index.js';
import { normalizeEmail } from './security-utils.js';

const DEFAULT_PLATFORM_MASTER_EMAIL = 'admin@cerebro.local';

function resolvePlatformMasterEmail(): string {
  return normalizeEmail(process.env.PLATFORM_MASTER_EMAIL || DEFAULT_PLATFORM_MASTER_EMAIL);
}

export function isPlatformMasterEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(String(email || ''));
  if (!normalized) return false;
  return normalized === resolvePlatformMasterEmail();
}

export async function canUseEnvCredentialsForUser(userId: string | null | undefined): Promise<boolean> {
  const actorId = String(userId || '').trim();
  if (!actorId) return false;
  try {
    const row = await queryOne<{ email: string | null }>(
      'SELECT email FROM users WHERE id = $1 LIMIT 1',
      [actorId]
    );
    return isPlatformMasterEmail(row?.email || null);
  } catch {
    return false;
  }
}
