import type { AIDecisionRecord, P0AuditRecord } from '@playbook-brain/types';

export class InMemoryP0TrustStore {
  private auditRecords: P0AuditRecord[] = [];
  private aiDecisionRecords: AIDecisionRecord[] = [];

  recordAudit(record: P0AuditRecord): P0AuditRecord {
    this.auditRecords.unshift(record);
    this.auditRecords = this.auditRecords.slice(0, 1000);
    return record;
  }

  recordAIDecision(record: AIDecisionRecord): AIDecisionRecord {
    this.aiDecisionRecords.unshift(record);
    this.aiDecisionRecords = this.aiDecisionRecords.slice(0, 1000);
    return record;
  }

  listAudits(input?: { tenantId?: string; limit?: number; actionPrefix?: string }): P0AuditRecord[] {
    const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
    return this.auditRecords
      .filter((r) => !input?.tenantId || r.tenant_id === input.tenantId)
      .filter((r) => !input?.actionPrefix || r.action.startsWith(input.actionPrefix))
      .slice(0, limit);
  }

  listAIDecisions(input?: { tenantId?: string; limit?: number }): AIDecisionRecord[] {
    const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
    return this.aiDecisionRecords
      .filter((r) => !input?.tenantId || r.tenant_id === input.tenantId)
      .slice(0, limit);
  }

  reset(): void {
    this.auditRecords = [];
    this.aiDecisionRecords = [];
  }
}

export const p0TrustStore = new InMemoryP0TrustStore();

