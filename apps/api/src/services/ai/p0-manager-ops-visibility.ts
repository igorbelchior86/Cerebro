import type {
  ManagerQueueSnapshotItem,
  ManagerVisibilitySnapshot,
} from '@cerebro/types';
import type { TrustAIDecisionRecord, TrustAuditRecord } from '../domain/p0-trust-contracts.js';

export interface BuildManagerVisibilityInput {
  tenantId: string;
  queueItems: ManagerQueueSnapshotItem[];
  aiDecisions: TrustAIDecisionRecord[];
  auditRecords: TrustAuditRecord[];
  sampleSize?: number;
}

export class P0ManagerOpsVisibilityService {
  buildSnapshot(input: BuildManagerVisibilityInput): ManagerVisibilitySnapshot {
    const generatedAt = new Date().toISOString();
    const queueByName = new Map<string, ManagerVisibilitySnapshot['queue_sla']['by_queue'][number]>();

    for (const item of input.queueItems) {
      const queue = String(item.queue || 'Unknown');
      const row = queueByName.get(queue) || {
        queue,
        total: 0,
        healthy: 0,
        at_risk: 0,
        breached: 0,
        unknown: 0,
      };
      row.total += 1;
      row[item.sla_status] += 1;
      queueByName.set(queue, row);
    }

    const decisions = input.aiDecisions.filter((d) => d.tenant_id === input.tenantId);
    const audits = input.auditRecords.filter((a) => a.tenant_id === input.tenantId);
    const avgConfidence =
      decisions.length > 0
        ? Number((decisions.reduce((acc, d) => acc + Number(d.confidence || 0), 0) / decisions.length).toFixed(3))
        : 0;

    const qaTickets = this.buildQASample({
      queueItems: input.queueItems,
      aiDecisions: decisions,
      sampleSize: input.sampleSize ?? 10,
    });
    const integrityIssues = this.validateIntegrity({
      tenantId: input.tenantId,
      queueItems: input.queueItems,
      aiDecisions: input.aiDecisions,
      auditRecords: input.auditRecords,
    });

    return {
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      queue_sla: {
        total_tickets: input.queueItems.length,
        by_queue: Array.from(queueByName.values()).sort((a, b) => b.total - a.total || a.queue.localeCompare(b.queue)),
      },
      ai_audit: {
        total_decisions: decisions.length,
        pending_hitl: decisions.filter((d) => d.hitl_status === 'pending').length,
        avg_confidence: avgConfidence,
        by_decision_type: decisions.reduce<Record<string, number>>((acc, d) => {
          acc[d.decision_type] = (acc[d.decision_type] || 0) + 1;
          return acc;
        }, {}),
      },
      automation_audit: {
        total_records: audits.length,
        rejected_actions: audits.filter((a) => a.result === 'rejected').length,
        read_only_rejections: audits.filter((a) => a.reason === 'read_only_enforcement').length,
        recent: audits.slice(0, 20),
      },
      qa_sampling: {
        sample_size: qaTickets.length,
        tickets: qaTickets,
      },
      integrity_checks: {
        ok: integrityIssues.length === 0,
        issues: integrityIssues,
      },
    };
  }

  private buildQASample(input: {
    queueItems: ManagerQueueSnapshotItem[];
    aiDecisions: TrustAIDecisionRecord[];
    sampleSize: number;
  }): ManagerVisibilitySnapshot['qa_sampling']['tickets'] {
    const queueByTicket = new Map(input.queueItems.map((q) => [q.ticket_id, q]));
    const candidates = input.aiDecisions.map((d) => {
      const queue = queueByTicket.get(d.ticket_id);
      const reasons: string[] = [];
      if (d.hitl_status === 'pending') reasons.push('HITL pending');
      if (Number(d.confidence || 0) < 0.7) reasons.push('Low confidence');
      if (queue?.sla_status === 'at_risk' || queue?.sla_status === 'breached') reasons.push(`SLA ${queue.sla_status}`);
      if (reasons.length === 0) reasons.push('Random QA sample');
      return {
        ticket_id: d.ticket_id,
        reason: reasons.join(' + '),
        confidence: d.confidence,
        hitl_status: d.hitl_status,
        sla_status: queue?.sla_status,
        sortKey:
          (d.hitl_status === 'pending' ? 100 : 0) +
          ((queue?.sla_status === 'breached') ? 50 : (queue?.sla_status === 'at_risk' ? 20 : 0)) +
          (d.confidence < 0.7 ? 10 : 0) -
          d.confidence,
      };
    });

    return candidates
      .sort((a, b) => b.sortKey - a.sortKey || a.ticket_id.localeCompare(b.ticket_id))
      .slice(0, Math.max(1, Math.min(50, input.sampleSize)))
      .map(({ sortKey: _sortKey, ...rest }) => ({
        ticket_id: rest.ticket_id,
        reason: rest.reason,
        confidence: rest.confidence,
        hitl_status: rest.hitl_status,
        ...(rest.sla_status ? { sla_status: rest.sla_status } : {}),
      }));
  }

  validateIntegrity(input: {
    tenantId: string;
    queueItems: ManagerQueueSnapshotItem[];
    aiDecisions: TrustAIDecisionRecord[];
    auditRecords: TrustAuditRecord[];
  }): string[] {
    const issues: string[] = [];
    const queueTickets = new Set(input.queueItems.map((q) => q.ticket_id));
    for (const decision of input.aiDecisions) {
      if (decision.tenant_id !== input.tenantId) issues.push(`ai_decision_cross_tenant:${decision.decision_id}`);
      if (!decision.prompt_version || !decision.model_version) issues.push(`ai_decision_missing_model_linkage:${decision.decision_id}`);
      if (!decision.rationale || !decision.signals_used?.length) issues.push(`ai_decision_incomplete_auditability:${decision.decision_id}`);
      if (decision.correlation?.ticket_id && decision.correlation.ticket_id !== decision.ticket_id) {
        issues.push(`ai_decision_ticket_correlation_mismatch:${decision.decision_id}`);
      }
      if (queueTickets.size > 0 && !queueTickets.has(decision.ticket_id)) {
        issues.push(`ai_decision_not_in_queue_snapshot:${decision.decision_id}`);
      }
    }
    for (const audit of input.auditRecords) {
      if (audit.tenant_id !== input.tenantId) issues.push(`audit_cross_tenant:${audit.audit_id}`);
      if (!audit.correlation) issues.push(`audit_missing_correlation:${audit.audit_id}`);
      if (!audit.timestamp) issues.push(`audit_missing_timestamp:${audit.audit_id}`);
    }
    return Array.from(new Set(issues));
  }
}
