import { readJsonFileSafe, writeJsonFileAtomic } from '../read-models/runtime-json-file.js';
import type { TrustAIDecisionRecord, TrustAuditRecord } from './p0-trust-contracts.js';

export class InMemoryP0TrustStore {
  private auditRecords: TrustAuditRecord[] = [];
  private aiDecisionRecords: TrustAIDecisionRecord[] = [];
  private readonly persistenceFilePath: string | undefined;

  constructor(input?: { persistenceFilePath?: string }) {
    this.persistenceFilePath = input?.persistenceFilePath;
    this.loadPersistedState();
  }

  private loadPersistedState(): void {
    if (!this.persistenceFilePath) return;
    const snapshot = readJsonFileSafe<{
      audits?: TrustAuditRecord[];
      ai_decisions?: TrustAIDecisionRecord[];
    }>(this.persistenceFilePath);
    if (!snapshot) return;
    this.auditRecords = Array.isArray(snapshot.audits) ? snapshot.audits : [];
    this.aiDecisionRecords = Array.isArray(snapshot.ai_decisions) ? snapshot.ai_decisions : [];
  }

  private persistState(): void {
    if (!this.persistenceFilePath) return;
    writeJsonFileAtomic(this.persistenceFilePath, {
      audits: this.auditRecords,
      ai_decisions: this.aiDecisionRecords,
    });
  }

  recordAudit(record: TrustAuditRecord): TrustAuditRecord {
    this.auditRecords.unshift(record);
    this.auditRecords = this.auditRecords.slice(0, 1000);
    this.persistState();
    return record;
  }

  recordAIDecision(record: TrustAIDecisionRecord): TrustAIDecisionRecord {
    this.aiDecisionRecords.unshift(record);
    this.aiDecisionRecords = this.aiDecisionRecords.slice(0, 1000);
    this.persistState();
    return record;
  }

  listAudits(input?: { tenantId?: string; limit?: number; actionPrefix?: string }): TrustAuditRecord[] {
    const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
    return this.auditRecords
      .filter((r) => !input?.tenantId || r.tenant_id === input.tenantId)
      .filter((r) => !input?.actionPrefix || r.action.startsWith(input.actionPrefix))
      .slice(0, limit);
  }

  listAIDecisions(input?: { tenantId?: string; limit?: number }): TrustAIDecisionRecord[] {
    const limit = Math.max(1, Math.min(200, Number(input?.limit ?? 50)));
    return this.aiDecisionRecords
      .filter((r) => !input?.tenantId || r.tenant_id === input.tenantId)
      .slice(0, limit);
  }

  reset(): void {
    this.auditRecords = [];
    this.aiDecisionRecords = [];
    this.persistState();
  }
}

export const p0TrustStore = new InMemoryP0TrustStore({
  persistenceFilePath: process.env.P0_TRUST_STORE_FILE || `${process.cwd()}/.run/p0-trust-store.json`,
});
