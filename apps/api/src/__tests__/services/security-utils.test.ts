import {
  createRelayState,
  hashOpaqueToken,
  normalizeEmail,
  parseRelayState,
} from '../../services/identity/security-utils.js';

describe('security-utils', () => {
  const prev = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret-for-security-utils';
  });

  afterAll(() => {
    process.env.JWT_SECRET = prev;
  });

  test('normalizes emails to lower-case and trim', () => {
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
  });

  test('hashOpaqueToken is deterministic for the same token', () => {
    const token = 'abc123';
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
  });

  test('relay state signs and verifies payload', () => {
    const relay = createRelayState({
      tenantId: 'tenant-1',
      providerKey: 'okta',
      nonce: 'n-1',
      samlRequestId: 'req-1',
      issuedAt: Date.now(),
    });
    const parsed = parseRelayState(relay);
    expect(parsed).not.toBeNull();
    expect(parsed?.tenantId).toBe('tenant-1');
    expect(parsed?.providerKey).toBe('okta');
    expect(parsed?.samlRequestId).toBe('req-1');
  });

  test('relay state tampering is rejected', () => {
    const relay = createRelayState({
      tenantId: 'tenant-1',
      providerKey: 'okta',
      nonce: 'n-1',
      samlRequestId: 'req-1',
      issuedAt: Date.now(),
    });
    const tampered = `${relay.slice(0, -2)}zz`;
    expect(parseRelayState(tampered)).toBeNull();
  });
});

