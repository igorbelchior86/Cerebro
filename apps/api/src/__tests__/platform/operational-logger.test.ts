import { operationalLogger, observabilityRuntime } from '../../lib/operational-logger.js';
import { tenantContext } from '../../lib/tenantContext.js';

describe('operationalLogger', () => {
  it('emits structured logs with correlation fields from async context', async () => {
    const infoLogs: Array<{ event: string; data: Record<string, unknown> | undefined }> = [];
    const errorLogs: Array<{ event: string; data: Record<string, unknown> | undefined }> = [];

    const originalInfo = observabilityRuntime.logs.info.bind(observabilityRuntime.logs);
    const originalError = observabilityRuntime.logs.error.bind(observabilityRuntime.logs);
    observabilityRuntime.logs.info = (event, data) => {
      infoLogs.push({ event, data });
    };
    observabilityRuntime.logs.error = (event, data) => {
      errorLogs.push({ event, data });
    };

    try {
      await tenantContext.run(
        {
          tenantId: 'tenant-test',
          traceId: 'trace-test',
          ticketId: 'T20260302.0001',
          requestId: 'req-test',
        },
        async () => {
          operationalLogger.info('test.info', { module: 'tests.operational-logger' });
          operationalLogger.error(
            'test.error',
            new Error('boom'),
            { module: 'tests.operational-logger' }
          );
        }
      );
    } finally {
      observabilityRuntime.logs.info = originalInfo;
      observabilityRuntime.logs.error = originalError;
    }

    expect(infoLogs).toHaveLength(1);
    expect(errorLogs).toHaveLength(1);
    expect(infoLogs[0]?.data?.tenant_id).toBe('tenant-test');
    expect(infoLogs[0]?.data?.ticket_id).toBe('T20260302.0001');
    expect(infoLogs[0]?.data?.trace_id).toBe('trace-test');
    expect(errorLogs[0]?.data?.tenant_id).toBe('tenant-test');
    expect(errorLogs[0]?.data?.ticket_id).toBe('T20260302.0001');
    expect(errorLogs[0]?.data?.trace_id).toBe('trace-test');
    expect(errorLogs[0]?.data?.error_message).toBe('boom');
  });
});
