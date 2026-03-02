import crypto from 'crypto';

type RelayStatePayload = {
  tenantId: string;
  providerKey: string;
  nonce: string;
  samlRequestId: string;
  issuedAt: number;
};

function authSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return secret;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return crypto
    .createHmac('sha256', authSecret())
    .update(token)
    .digest('hex');
}

export function createRelayState(payload: RelayStatePayload): string {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json, 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', authSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function parseRelayState(value: string): RelayStatePayload | null {
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const body = parts[0];
  const sig = parts[1];
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac('sha256', authSecret())
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RelayStatePayload;
  if (!payload?.tenantId || !payload?.providerKey || !payload?.nonce || !payload?.samlRequestId) {
    return null;
  }
  return payload;
}
