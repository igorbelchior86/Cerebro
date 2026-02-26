import { IdempotencyKeyStore } from '../../platform/queue-runtime.js';

describe('CP0 idempotency key primitive', () => {
  it('claims a key once and rejects duplicate claims', () => {
    const store = new IdempotencyKeyStore();

    expect(store.claim('idem:1')).toBe(true);
    expect(store.claim('idem:1')).toBe(false);
    expect(store.claim('idem:2')).toBe(true);
  });
});

