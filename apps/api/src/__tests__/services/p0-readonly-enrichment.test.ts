import { InMemoryP0TrustStore } from '../../services/p0-trust-store.js';
import {
  P0ReadOnlyEnrichmentService,
  ReadOnlyIntegrationMutationError,
} from '../../services/p0-readonly-enrichment.js';

describe('P0ReadOnlyEnrichmentService', () => {
  it('normalizes read-only context/evidence with provenance for all four integrations', async () => {
    const store = new InMemoryP0TrustStore();
    const service = new P0ReadOnlyEnrichmentService({ store });

    const envelope = await service.buildContextEnvelope({
      tenantId: 'tenant-1',
      ticketId: 'T-100',
      correlation: { trace_id: 'trace-100' },
      providers: {
        itglue: {
          adapterVersion: 'itg-v1',
          raw: {
            org_id: 'org-1',
            org_name: 'Acme',
            configs: [{ id: 'c1' }],
            assets: [{ id: 'a1' }],
            documents_raw: [{ id: 'd1', attributes: { name: 'VPN Runbook' } }],
          },
        },
        ninjaone: {
          adapterVersion: 'ninja-v1',
          raw: {
            org_id: 'n-1',
            org_name: 'Acme',
            devices: [{ id: 1 }],
            alerts: [{ id: 'na1', message: 'Disk alert', severity: 'high' }],
          },
        },
        sentinelone: {
          adapterVersion: 's1-v1',
          raw: {
            account: 'Acme SOC',
            alerts: [{ id: 's1a', type: 'malware', description: 'Malware blocked', severity: 'critical' }],
          },
        },
        check_point: {
          adapterVersion: 'cp-v1',
          raw: {
            gateway: 'gw-1',
            incidents: [{ id: 'cp1', type: 'firewall', summary: 'Blocked outbound C2', severity: 'high' }],
          },
        },
      },
    });

    expect(envelope.policy.mode).toBe('read_only');
    expect(envelope.cards.map((c) => c.source)).toEqual(
      expect.arrayContaining(['IT Glue', 'Ninja', 'SentinelOne', 'Check Point'])
    );
    expect(envelope.evidence.length).toBeGreaterThanOrEqual(4);
    expect(envelope.provenance.sources.every((p) => !!p.source && !!p.fetched_at)).toBe(true);
    expect(envelope.degraded_mode).toBeUndefined();
    expect(store.listAudits({ tenantId: 'tenant-1', actionPrefix: 'enrichment.read' }).length).toBe(4);
  });

  it('rejects mutation path for read-only integrations and audits the rejection', async () => {
    const store = new InMemoryP0TrustStore();
    const service = new P0ReadOnlyEnrichmentService({ store });

    let error: unknown;
    try {
      await service.rejectMutation({
        source: 'sentinelone',
        tenantId: 'tenant-1',
        ticketId: 'T-200',
        payload: { action: 'isolate-device' },
      });
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(ReadOnlyIntegrationMutationError);
    const typed = error as ReadOnlyIntegrationMutationError;
    expect(typed.source).toBe('sentinelone');
    const audits = store.listAudits({ tenantId: 'tenant-1', actionPrefix: 'integration.mutate' });
    expect(audits).toHaveLength(1);
    expect(audits[0]!.result).toBe('rejected');
    expect(audits[0]!.reason).toBe('read_only_enforcement');
  });

  it('degrades gracefully on partial enrichment failures without breaking envelope generation', async () => {
    const service = new P0ReadOnlyEnrichmentService({ store: new InMemoryP0TrustStore() });

    const envelope = await service.buildContextEnvelope({
      tenantId: 'tenant-1',
      ticketId: 'T-300',
      providers: {
        itglue: { raw: { org_name: 'Acme', docs: [] } },
        sentinelone: {
          fetch: async () => {
            throw new Error('timeout contacting sentinelone');
          },
        },
      },
    });

    expect(envelope.cards.map((c) => c.source)).toContain('IT Glue');
    expect(envelope.degraded_mode?.core_ticket_handling_preserved).toBe(true);
    expect(envelope.degraded_mode?.partial_failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'sentinelone', retryable: true }),
      ])
    );
  });
});
