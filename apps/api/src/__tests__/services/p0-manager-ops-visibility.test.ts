import type { ManagerQueueSnapshotItem } from '@cerebro/types';
import { P0ManagerOpsVisibilityService } from '../../services/ai/p0-manager-ops-visibility.js';
import type { TrustAIDecisionRecord, TrustAuditRecord } from '../../services/domain/p0-trust-contracts.js';

function buildDecision(input: Partial<TrustAIDecisionRecord> & { decision_id: string; ticket_id: string }): TrustAIDecisionRecord {
  return {
    decision_id: input.decision_id,
    tenant_id: input.tenant_id ?? 'tenant-1',
    ticket_id: input.ticket_id,
    decision_type: input.decision_type ?? 'triage',
    suggestion: input.suggestion ?? {
      suggestion_only: true,
      summary: 'Test suggestion',
      recommended_actions: [],
      do_not_do: [],
    },
    confidence: input.confidence ?? 0.8,
    rationale: input.rationale ?? 'grounded rationale',
    signals_used: input.signals_used ?? [{ source: 'ninja', ref: 'signal:s1' }],
    provenance_refs: input.provenance_refs ?? [{ source: 'ai_model', fetched_at: new Date().toISOString(), prompt_version: 'p1', model_version: 'm1' }],
    hitl_status: input.hitl_status ?? 'not_required',
    prompt_version: input.prompt_version ?? 'p1',
    model_version: input.model_version ?? 'm1',
    timestamp: input.timestamp ?? new Date().toISOString(),
    correlation: input.correlation ?? { ticket_id: input.ticket_id, trace_id: `trace-${input.ticket_id}` },
    policy_gate: input.policy_gate ?? { outcome: 'pass', reasons: [] },
  };
}

function buildAudit(input: Partial<TrustAuditRecord> & { audit_id: string }): TrustAuditRecord {
  return {
    audit_id: input.audit_id,
    tenant_id: input.tenant_id ?? 'tenant-1',
    actor: input.actor ?? { type: 'system', id: 'test', origin: 'scheduler' },
    action: input.action ?? 'ai.decision.create',
    target: input.target ?? { type: 'ai_decision_record', id: 'd1' },
    result: input.result ?? 'success',
    ...(input.reason ? { reason: input.reason } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
    correlation: input.correlation ?? { ticket_id: 'T-1', trace_id: 'trace-1' },
    metadata: input.metadata ?? {},
  };
}

describe('P0ManagerOpsVisibilityService', () => {
  it('builds queue/SLA + AI/audit visibility snapshot with QA sampling', () => {
    const service = new P0ManagerOpsVisibilityService();
    const queueItems: ManagerQueueSnapshotItem[] = [
      { ticket_id: 'T-1', queue: 'Service Desk', sla_status: 'healthy', age_minutes: 12 },
      { ticket_id: 'T-2', queue: 'Service Desk', sla_status: 'breached', age_minutes: 180 },
      { ticket_id: 'T-3', queue: 'Security', sla_status: 'at_risk', age_minutes: 70 },
    ];
    const aiDecisions = [
      buildDecision({ decision_id: 'd1', ticket_id: 'T-1', confidence: 0.88, hitl_status: 'not_required' }),
      buildDecision({ decision_id: 'd2', ticket_id: 'T-2', confidence: 0.62, hitl_status: 'pending' }),
      buildDecision({ decision_id: 'd3', ticket_id: 'T-3', confidence: 0.67, hitl_status: 'pending' }),
    ];
    const audits = [
      buildAudit({ audit_id: 'a1', result: 'success' }),
      buildAudit({ audit_id: 'a2', result: 'rejected', reason: 'read_only_enforcement', action: 'integration.mutate.sentinelone' }),
    ];

    const snapshot = service.buildSnapshot({
      tenantId: 'tenant-1',
      queueItems,
      aiDecisions,
      auditRecords: audits,
      sampleSize: 2,
    });

    expect(snapshot.queue_sla.total_tickets).toBe(3);
    expect(snapshot.queue_sla.by_queue.find((q) => q.queue === 'Service Desk')?.breached).toBe(1);
    expect(snapshot.ai_audit.pending_hitl).toBe(2);
    expect(snapshot.automation_audit.read_only_rejections).toBe(1);
    expect(snapshot.qa_sampling.sample_size).toBe(2);
    expect(snapshot.qa_sampling.tickets[0]!.reason).toMatch(/HITL pending|SLA breached/);
    expect(snapshot.integrity_checks.ok).toBe(true);
  });

  it('flags integrity issues for incomplete/cross-tenant records', () => {
    const service = new P0ManagerOpsVisibilityService();
    const snapshot = service.buildSnapshot({
      tenantId: 'tenant-1',
      queueItems: [{ ticket_id: 'T-1', queue: 'Service Desk', sla_status: 'healthy' }],
      aiDecisions: [
        buildDecision({
          decision_id: 'd-bad',
          ticket_id: 'T-X',
          tenant_id: 'tenant-2',
          prompt_version: '',
          model_version: '',
          rationale: '',
          signals_used: [],
          correlation: { ticket_id: 'T-OTHER', trace_id: 'trace-bad' },
        }),
      ],
      auditRecords: [buildAudit({ audit_id: 'a-bad', tenant_id: 'tenant-2' })],
      sampleSize: 5,
    });

    expect(snapshot.integrity_checks.ok).toBe(false);
    expect(snapshot.integrity_checks.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ai_decision_cross_tenant'),
        expect.stringContaining('ai_decision_missing_model_linkage'),
        expect.stringContaining('ai_decision_incomplete_auditability'),
        expect.stringContaining('ai_decision_ticket_correlation_mismatch'),
      ])
    );
  });

  it('flags queue coverage mismatch when visibility snapshot input omits an AI-reviewed ticket (expected conditional)', () => {
    const service = new P0ManagerOpsVisibilityService();
    const snapshot = service.buildSnapshot({
      tenantId: 'tenant-1',
      queueItems: [{ ticket_id: 'T-QUEUE-1', queue: 'Service Desk', sla_status: 'healthy' }],
      aiDecisions: [buildDecision({ decision_id: 'd-missing', ticket_id: 'VAL-H-S1-001', hitl_status: 'pending', confidence: 0.58 })],
      auditRecords: [],
      sampleSize: 5,
    });

    expect(snapshot.qa_sampling.tickets.some((t) => t.ticket_id === 'VAL-H-S1-001')).toBe(true);
    expect(snapshot.integrity_checks.ok).toBe(false);
    expect(snapshot.integrity_checks.issues).toEqual(
      expect.arrayContaining([expect.stringContaining('ai_decision_not_in_queue_snapshot:d-missing')]),
    );
  });
});
