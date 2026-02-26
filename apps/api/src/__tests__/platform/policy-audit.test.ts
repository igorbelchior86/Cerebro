import { tenantContext } from '../../lib/tenantContext.js';
import { AuditTrailService, InMemoryAuditSink } from '../../platform/audit-trail.js';
import { ReadOnlyIntegrationMutationError } from '../../platform/errors.js';
import { enforceIntegrationMutationPolicy, ensureIntegrationMutationAllowed } from '../../platform/policy.js';

const actor = { type: 'user', id: 'u1', role: 'tech', origin: 'api' } as const;

describe('CP0 integration launch policy guardrail + audit', () => {
  it('allows Autotask mutation policy checks', async () => {
    const sink = new InMemoryAuditSink();
    const audit = new AuditTrailService(sink);

    await tenantContext.run(
      { tenantId: 'tenant-1', traceId: 'trace-1', requestId: 'req-1', bypassRLS: false },
      async () => {
        const result = await enforceIntegrationMutationPolicy(
          {
            tenant_id: 'tenant-1',
            integration: 'autotask',
            actor,
            action: 'update_ticket',
            correlation: { trace_id: 'trace-1', request_id: 'req-1' },
          },
          audit,
        );
        expect(result.allowed).toBe(true);
      },
    );

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]?.result).toBe('success');
    expect(sink.records[0]?.target.integration).toBe('autotask');
  });

  it('rejects non-Autotask mutation attempts with typed error and audit record', async () => {
    const sink = new InMemoryAuditSink();
    const audit = new AuditTrailService(sink);

    await tenantContext.run(
      { tenantId: 'tenant-1', traceId: 'trace-2', requestId: 'req-2', bypassRLS: false },
      async () => {
        expect(() =>
          ensureIntegrationMutationAllowed({
            tenant_id: 'tenant-1',
            integration: 'itglue',
            actor,
            action: 'delete_secret_thing',
            correlation: { trace_id: 'trace-2', request_id: 'req-2' },
          }),
        ).toThrow(ReadOnlyIntegrationMutationError);

        const result = await enforceIntegrationMutationPolicy(
          {
            tenant_id: 'tenant-1',
            integration: 'ninja',
            actor,
            action: 'update_device',
            correlation: { trace_id: 'trace-2', request_id: 'req-2' },
          },
          audit,
        );

        expect(result.allowed).toBe(false);
        if (!result.allowed) {
          expect(result.error).toBeInstanceOf(ReadOnlyIntegrationMutationError);
          expect(result.audit.result).toBe('rejected');
          expect(result.audit.reason).toContain('read-only');
        }
      },
    );

    expect(sink.records).toHaveLength(1);
    expect(sink.records[0]?.result).toBe('rejected');
    expect(sink.records[0]?.correlation.trace_id).toBe('trace-2');
  });
});

