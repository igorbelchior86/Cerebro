import { classifyQueueError } from '../../platform/errors.js';

describe('integration error queue classification', () => {
  it('maps integration rate_limit to queue retry', () => {
    const classified = classifyQueueError({
      kind: 'integration_client_error',
      code: 'rate_limit',
      retryable: true,
      message: 'ninjaone GET /api/v2/devices failed with 429 Too Many Requests',
    });

    expect(classified).toEqual({
      code: 'RATE_LIMIT',
      disposition: 'retry',
      reason: 'ninjaone GET /api/v2/devices failed with 429 Too Many Requests',
    });
  });

  it('maps integration auth to queue dlq', () => {
    const classified = classifyQueueError({
      kind: 'integration_client_error',
      code: 'auth',
      retryable: false,
      message: 'itglue GET /organizations failed with 401 Unauthorized',
    });

    expect(classified).toEqual({
      code: 'AUTH',
      disposition: 'dlq',
      reason: 'itglue GET /organizations failed with 401 Unauthorized',
    });
  });
});
