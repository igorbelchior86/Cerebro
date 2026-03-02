import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { InMemoryP0TrustStore } from '../../services/domain/p0-trust-store.js';
import type { TrustAIDecisionRecord, TrustAuditRecord } from '../../services/domain/p0-trust-contracts.js';

function buildAudit(): TrustAuditRecord {
  return {
    audit_id: 'audit-1',
    tenant_id: 'tenant-1',
    actor: { type: 'system', id: 'tester', origin: 'scheduler' },
    action: 'test.audit',
    target: { type: 'test', id: '1' },
    result: 'success',
    timestamp: '2026-02-26T12:00:00.000Z',
    correlation: { trace_id: 'trace-1', ticket_id: 'T-1' },
    metadata: { x: 1 },
  };
}

function buildDecision(): TrustAIDecisionRecord {
  return {
    decision_id: 'decision-1',
    tenant_id: 'tenant-1',
    ticket_id: 'T-1',
    decision_type: 'triage',
    suggestion: { suggestion_only: true, summary: 'Test', recommended_actions: [], do_not_do: [] },
    confidence: 0.9,
    rationale: 'grounded',
    signals_used: [{ source: 'ninja', ref: 'signal:s1' }],
    provenance_refs: [{ source: 'ai_model', fetched_at: '2026-02-26T12:00:00.000Z', prompt_version: 'p1', model_version: 'm1' }],
    hitl_status: 'not_required',
    prompt_version: 'p1',
    model_version: 'm1',
    timestamp: '2026-02-26T12:00:00.000Z',
    correlation: { trace_id: 'trace-1', ticket_id: 'T-1' },
    policy_gate: { outcome: 'pass', reasons: [] },
  };
}

describe('InMemoryP0TrustStore durability', () => {
  it('restores audit and AI decision records after reload when file backing is enabled', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cerebro-p0-trust-'));
    const filePath = join(dir, 'trust-store.json');
    try {
      const store1 = new InMemoryP0TrustStore({ persistenceFilePath: filePath });
      store1.recordAudit(buildAudit());
      store1.recordAIDecision(buildDecision());

      const store2 = new InMemoryP0TrustStore({ persistenceFilePath: filePath });
      expect(store2.listAudits({ tenantId: 'tenant-1' })).toHaveLength(1);
      expect(store2.listAIDecisions({ tenantId: 'tenant-1' })).toHaveLength(1);
      expect(store2.listAIDecisions({ tenantId: 'tenant-1' })[0]?.signals_used[0]).toEqual(
        expect.objectContaining({ source: 'ninja', ref: 'signal:s1' })
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

