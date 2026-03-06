import { v4 as uuidv4 } from 'uuid';
import type {
  ContextCard,
  ContextEvidenceRecord,
  P0ReadonlyIntegrationSource,
  TicketContextEnvelopeP0,
} from '@cerebro/types';
import type { InMemoryP0TrustStore } from './domain/p0-trust-store.js';
import type { TrustActorRef, TrustAuditRecord, TrustCorrelationRefs } from './domain/p0-trust-contracts.js';

type JsonRecord = Record<string, unknown>;

type ProviderPayload = {
  raw?: unknown;
  fetch?: () => Promise<unknown>;
  adapterVersion?: string;
};

export interface BuildReadonlyContextInput {
  tenantId: string;
  ticketId: string;
  correlation?: TrustCorrelationRefs;
  providers: Partial<Record<P0ReadonlyIntegrationSource, ProviderPayload>>;
  actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string };
}

export class ReadOnlyIntegrationMutationError extends Error {
  source: P0ReadonlyIntegrationSource;
  auditId: string | undefined;

  constructor(source: P0ReadonlyIntegrationSource, message: string, auditId?: string) {
    super(message);
    this.name = 'ReadOnlyIntegrationMutationError';
    this.source = source;
    this.auditId = auditId;
  }
}

export class P0ReadOnlyEnrichmentService {
  private readonly store: InMemoryP0TrustStore | undefined;

  constructor(input?: { store?: InMemoryP0TrustStore }) {
    this.store = input?.store;
  }

  async buildContextEnvelope(input: BuildReadonlyContextInput): Promise<TicketContextEnvelopeP0> {
    const generatedAt = new Date().toISOString();
    const baseCorrelation = this.normalizeCorrelation(input.correlation, input.ticketId);
    const cards: ContextCard[] = [];
    const evidence: ContextEvidenceRecord[] = [];
    const sourceProvenance: TicketContextEnvelopeP0['provenance']['sources'] = [];
    const partialFailures: NonNullable<TicketContextEnvelopeP0['degraded_mode']>['partial_failures'] = [];

    const orderedSources: P0ReadonlyIntegrationSource[] = ['itglue', 'ninjaone', 'sentinelone', 'check_point'];
    for (const source of orderedSources) {
      const provider = input.providers[source];
      if (!provider) continue;

      try {
        const payload = provider.raw !== undefined ? provider.raw : await provider.fetch?.();
        const normalized = this.normalizeSource(source, payload, provider.adapterVersion, generatedAt);
        cards.push(normalized.card);
        evidence.push(...normalized.evidence);
        sourceProvenance.push(normalized.card.provenance);
        this.store?.recordAudit(this.audit({
          tenantId: input.tenantId,
          ...(input.actor ? { actor: input.actor } : {}),
          action: `enrichment.read.${source}`,
          targetType: 'integration_context',
          targetId: input.ticketId,
          result: 'success',
          correlation: baseCorrelation,
          metadata: { evidence_count: normalized.evidence.length, card_status: normalized.card.status },
        }));
      } catch (error) {
        const message = (error as Error)?.message || String(error);
        partialFailures.push({
          source,
          error: message,
          retryable: !/auth|forbidden|unauthorized|invalid/i.test(message),
        });
        sourceProvenance.push({
          source,
          fetched_at: generatedAt,
          ...(provider.adapterVersion ? { adapter_version: provider.adapterVersion } : {}),
          meta: { status: 'error', message },
        });
        this.store?.recordAudit(this.audit({
          tenantId: input.tenantId,
          ...(input.actor ? { actor: input.actor } : {}),
          action: `enrichment.read.${source}`,
          targetType: 'integration_context',
          targetId: input.ticketId,
          result: 'failure',
          reason: 'partial_enrichment_failure',
          correlation: baseCorrelation,
          metadata: { error: message },
        }));
      }
    }

    return {
      ticket_id: input.ticketId,
      tenant_id: input.tenantId,
      cards,
      evidence,
      provenance: {
        generated_at: generatedAt,
        sources: sourceProvenance,
      },
      policy: {
        mode: 'read_only',
        enforced_sources: ['itglue', 'ninjaone', 'sentinelone', 'check_point'],
        enforcement: 'explicit_reject_and_audit',
      },
      correlation: {
        ...baseCorrelation,
      },
      ...(partialFailures.length > 0
        ? {
          degraded_mode: {
            partial_failures: partialFailures,
            core_ticket_handling_preserved: true,
          },
        }
        : {}),
    };
  }

  async rejectMutation(input: {
    source: P0ReadonlyIntegrationSource;
    tenantId: string;
    ticketId?: string;
    correlation?: TrustCorrelationRefs;
    actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string };
    payload?: unknown;
  }): Promise<never> {
    const record = this.audit({
      tenantId: input.tenantId,
      ...(input.actor ? { actor: input.actor } : {}),
      action: `integration.mutate.${input.source}`,
      targetType: 'integration_mutation',
      ...(input.ticketId ? { targetId: input.ticketId } : {}),
      result: 'rejected',
      reason: 'read_only_enforcement',
      correlation: this.normalizeCorrelation(input.correlation, input.ticketId),
      metadata: {
        source: input.source,
        launch_policy: 'READ_ONLY',
        payload_keys: input.payload && typeof input.payload === 'object' ? Object.keys(input.payload as Record<string, unknown>) : [],
      },
    });
    const saved = this.store?.recordAudit(record) || record;
    throw new ReadOnlyIntegrationMutationError(
      input.source,
      `Mutation path rejected for ${input.source}: integration is READ_ONLY in P0`,
      saved.audit_id,
    );
  }

  private normalizeSource(
    source: P0ReadonlyIntegrationSource,
    raw: unknown,
    adapterVersion: string | undefined,
    fetchedAt: string,
  ): { card: ContextCard; evidence: ContextEvidenceRecord[] } {
    const provenanceBase = {
      fetched_at: fetchedAt,
      adapter_version: adapterVersion || 'p0-v1',
    };
    const data = this.asRecord(raw);

    if (source === 'itglue') {
      const orgName = String(data.org_name || data.organization_name || 'Unknown org');
      const docs = this.asArray(data.documents_raw || data.docs);
      const configs = this.asArray(data.configs || data.configurations);
      const assets = this.asArray(data.assets);
      return {
        card: {
          source: 'IT Glue',
          kind: 'context_card',
          title: `IT Glue context (${orgName})`,
          summary: `Read-only documentation and asset context for ${orgName}`,
          status: 'ok',
          mode: 'read_only',
          fields: {
            organization: orgName,
            org_id: data.org_id || null,
            configs_count: configs.length,
            assets_count: assets.length,
            docs_count: docs.length,
          },
          provenance: { source: 'itglue', ...provenanceBase, record_ids: docs.slice(0, 10).map((doc) => String(doc.id || '')) },
        },
        evidence: docs.slice(0, 10).map((doc, idx) => ({
          id: `itglue-doc-${idx}-${String(doc.id || uuidv4())}`,
          source: 'IT Glue',
          type: 'document',
          summary: String(this.asRecord(doc.attributes).name || doc.name || 'IT Glue document'),
          observed_at: fetchedAt,
          provenance: { source: 'itglue', ...provenanceBase, record_ids: [String(doc.id || '')] },
        })),
      };
    }

    if (source === 'ninjaone') {
      const devices = this.asArray(data.devices);
      const alerts = this.asArray(data.alerts);
      const orgName = String(data.org_name || data.organization_name || 'Unknown org');
      return {
        card: {
          source: 'Ninja',
          kind: 'context_card',
          title: `Ninja endpoint context (${orgName})`,
          summary: 'Read-only endpoint and alert telemetry',
          status: 'ok',
          mode: 'read_only',
          fields: {
            organization: orgName,
            org_id: data.org_id || data.organization_id || null,
            devices_count: devices.length,
            alerts_count: alerts.length,
          },
          provenance: { source: 'ninjaone', ...provenanceBase },
        },
        evidence: alerts.slice(0, 10).map((alert, idx) => {
          const severity = this.normalizeSeverity(alert.severity);
          return {
            id: `ninja-alert-${idx}-${String(alert.id || uuidv4())}`,
            source: 'Ninja' as const,
            type: 'alert',
            summary: String(alert.message || alert.subject || 'Ninja alert'),
            ...(severity ? { severity } : {}),
            observed_at: this.asIso(alert.createdAt || alert.timestamp) || fetchedAt,
            provenance: { source: 'ninjaone', ...provenanceBase, record_ids: [String(alert.id || '')] },
          };
        }),
      };
    }

    if (source === 'sentinelone') {
      const alerts = this.asArray(data.alerts || data.threats || data.incidents);
      return {
        card: {
          source: 'SentinelOne',
          kind: 'context_card',
          title: 'SentinelOne security context',
          summary: 'Read-only endpoint security detections and posture',
          status: alerts.length > 0 ? 'ok' : 'partial',
          mode: 'read_only',
          fields: {
            alerts_count: alerts.length,
            account: data.account || data.site || null,
          },
          provenance: { source: 'sentinelone', ...provenanceBase },
        },
        evidence: alerts.slice(0, 20).map((alert, idx) => {
          const severity = this.normalizeSeverity(alert.severity);
          return {
            id: `s1-${idx}-${String(alert.id || alert.threatId || uuidv4())}`,
            source: 'SentinelOne' as const,
            type: String(alert.type || 'security_alert'),
            summary: String(alert.description || alert.name || 'SentinelOne alert'),
            ...(severity ? { severity } : {}),
            observed_at: this.asIso(alert.createdAt || alert.detectedAt) || fetchedAt,
            provenance: { source: 'sentinelone', ...provenanceBase, record_ids: [String(alert.id || '')] },
          };
        }),
      };
    }

    const incidents = this.asArray(data.incidents || data.events || data.logs);
    return {
      card: {
        source: 'Check Point',
        kind: 'context_card',
        title: 'Check Point security context',
        summary: 'Read-only firewall/security incidents and event evidence',
        status: incidents.length > 0 ? 'ok' : 'partial',
        mode: 'read_only',
        fields: {
          incidents_count: incidents.length,
          gateway: data.gateway || data.management || null,
        },
        provenance: { source: 'check_point', ...provenanceBase },
      },
      evidence: incidents.slice(0, 20).map((incident, idx) => {
        const severity = this.normalizeSeverity(incident.severity);
        return {
          id: `cp-${idx}-${String(incident.id || uuidv4())}`,
          source: 'Check Point' as const,
          type: String(incident.type || 'security_event'),
          summary: String(incident.summary || incident.description || 'Check Point event'),
          ...(severity ? { severity } : {}),
          observed_at: this.asIso(incident.timestamp || incident.created_at) || fetchedAt,
          provenance: { source: 'check_point', ...provenanceBase, record_ids: [String(incident.id || '')] },
        };
      }),
    };
  }

  private audit(input: {
    tenantId: string;
    actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string };
    action: string;
    targetType: string;
    targetId?: string;
    result: TrustAuditRecord['result'];
    reason?: string;
    correlation?: TrustCorrelationRefs;
    metadata?: Record<string, unknown>;
  }): TrustAuditRecord {
    return {
      audit_id: uuidv4(),
      tenant_id: input.tenantId,
      actor: this.normalizeActor(input.actor),
      action: input.action,
      target: {
        type: input.targetType,
        ...(input.targetId ? { id: input.targetId } : {}),
      },
      result: input.result,
      ...(input.reason ? { reason: input.reason } : {}),
      timestamp: new Date().toISOString(),
      correlation: this.normalizeCorrelation(input.correlation, input.targetId),
      metadata: input.metadata || {},
    };
  }

  private normalizeActor(actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string }): TrustActorRef {
    const type = actor?.type || 'system';
    return {
      type,
      id: String(actor?.id || 'p0-readonly-enrichment'),
      origin: type === 'user' ? 'api' : 'integration',
    };
  }

  private normalizeCorrelation(correlation?: TrustCorrelationRefs, ticketId?: string) {
    return {
      trace_id: String(correlation?.trace_id || uuidv4()),
      ...(correlation?.request_id ? { request_id: String(correlation.request_id) } : {}),
      ...(correlation?.job_id ? { job_id: String(correlation.job_id) } : {}),
      ...(correlation?.command_id ? { command_id: String(correlation.command_id) } : {}),
      ...(ticketId ? { ticket_id: ticketId } : {}),
    };
  }

  private asArray(value: unknown): JsonRecord[] {
    return Array.isArray(value) ? value.map((item) => this.asRecord(item)) : [];
  }

  private asRecord(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : {};
  }

  private asIso(value: unknown): string | null {
    if (!value) return null;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  private normalizeSeverity(value: unknown): ContextEvidenceRecord['severity'] {
    const s = String(value || '').toLowerCase();
    if (s.includes('crit')) return 'critical';
    if (s.includes('high')) return 'high';
    if (s.includes('med')) return 'medium';
    if (s.includes('low')) return 'low';
    return undefined;
  }
}
