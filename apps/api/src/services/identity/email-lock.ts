import type { PoolClient } from 'pg';
import { transaction } from '../../db/index.js';
import { normalizeEmail } from './security-utils.js';

const IDENTITY_EMAIL_LOCK_NAMESPACE = 41023;

export class IdentityEmailConflictError extends Error {
  normalizedEmail: string;

  constructor(email: string) {
    super('Email already registered');
    this.name = 'IdentityEmailConflictError';
    this.normalizedEmail = normalizeEmail(email);
  }
}

export async function withIdentityEmailTransaction<T>(
  email: string,
  work: (client: PoolClient, normalizedEmail: string) => Promise<T>,
): Promise<T> {
  const normalizedEmail = normalizeEmail(email);
  return transaction(async (client) => {
    // Serialize global identity creation by normalized email to avoid duplicate accounts across tenants.
    await client.query(
      'SELECT pg_advisory_xact_lock($1, hashtext($2))',
      [IDENTITY_EMAIL_LOCK_NAMESPACE, normalizedEmail],
    );
    return work(client, normalizedEmail);
  });
}

export async function assertGlobalEmailAvailable(
  client: Pick<PoolClient, 'query'>,
  normalizedEmail: string,
): Promise<void> {
  const existing = await client.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(trim(email)) = $1 LIMIT 1',
    [normalizedEmail],
  );
  if (existing.rows[0]) {
    throw new IdentityEmailConflictError(normalizedEmail);
  }
}

export { IDENTITY_EMAIL_LOCK_NAMESPACE };
