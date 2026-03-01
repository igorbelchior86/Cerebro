import type { CP0AiDecisionRecord, DiagnosisOutput, EvidencePack, ValidationOutput } from '@cerebro/types';
import { P0AiTriageAssistService } from '../../services/p0-ai-triage-assist.js';
import { InMemoryP0TrustStore } from '../../services/p0-trust-store.js';

function buildPack(priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium'): EvidencePack {
  return {
    session_id: 's1',
    tenant_id: 'tenant-1',
    source_workspace: 'tenant:tenant-1',
    ticket: {
      id: 'T-1',
      title: 'VPN unstable',
      description: 'User reports VPN instability',
      created_at: new Date().toISOString(),
      priority,
      queue: 'Service Desk',
      category: 'Support',
    },
    org: { id: 'org-1', name: 'Acme' },
    signals: [
      { id: 'sig-1', source: 'ninja', timestamp: new Date().toISOString(), type: 'alert', summary: 'VPN check failed' },
    ],
    related_cases: [],
    external_status: [],
    docs: [{ id: 'doc-1', source: 'itglue', title: 'VPN runbook', snippet: 'Check tunnel', relevance: 0.9 }],
    source_findings: [
      { source: 'ninjaone', queried: true, matched: true, summary: 'Device alert found', details: ['VPN failed'] },
      { source: 'itglue', queried: true, matched: true, summary: 'Runbook found', details: ['VPN runbook'] },
    ],
    evidence_rules: { require_evidence_for_claims: true, no_destructive_steps_without_gating: true },
    prepared_at: new Date().toISOString(),
  };
}

function buildDiagnosis(confidence = 0.82): DiagnosisOutput {
  return {
    summary: 'Likely endpoint VPN profile drift.',
    top_hypotheses: [
      {
        rank: 1,
        hypothesis: 'Endpoint VPN profile drift',
        confidence,
        calibrated_confidence: confidence,
        evidence: ['signal:sig-1'],
        tests: ['Check VPN profile'],
        confidence_explanation: ['grounded_in_ninja_and_itglue'],
      },
    ],
    missing_data: [],
    recommended_actions: [{ action: 'Validate VPN profile on endpoint', risk: 'low' }],
    do_not_do: ['Do not restart firewall without approval'],
  };
}

function buildValidation(status: ValidationOutput['status'] = 'approved'): ValidationOutput {
  return {
    status,
    violations: [],
    required_questions: status === 'approved' ? [] : ['Confirm endpoint ownership'],
    required_fixes: [],
    safe_to_generate_playbook: true,
    blocking_reasons: status === 'approved' ? [] : ['named_entity_unresolved'],
  };
}

describe('P0AiTriageAssistService', () => {
  it('creates auditable suggestion-first AI decision record with versions and provenance', () => {
    const store = new InMemoryP0TrustStore();
    const service = new P0AiTriageAssistService({ store });

    const { decision, drafts } = service.buildSuggestionDecision({
      tenantId: 'tenant-1',
      ticketId: 'T-1',
      pack: buildPack('Medium'),
      diagnosis: buildDiagnosis(0.84),
      validation: buildValidation('approved'),
      promptVersion: 'prompt-v1',
      modelVersion: 'model-v1',
      correlation: { trace_id: 'trace-1', job_id: 'job-1' },
    });

    expect(decision.suggestion.suggestion_only).toBe(true);
    expect(decision.confidence).toBeCloseTo(0.84, 3);
    expect(decision.rationale).toContain('Confidence: 0.84');
    expect(decision.prompt_version).toBe('prompt-v1');
    expect(decision.model_version).toBe('model-v1');
    expect(decision.provenance_refs.some((p) => p.source === 'ai_model')).toBe(true);
    expect(decision.signals_used).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'ninja', ref: 'signal:sig-1' }),
        expect.objectContaining({ source: 'itglue', ref: 'doc:doc-1' }),
      ])
    );
    const cp0View: CP0AiDecisionRecord = decision;
    expect(cp0View.signals_used.length).toBeGreaterThan(0);
    expect(drafts.summary_md).toContain('AI Triage Summary');
    expect(drafts.handoff_md).toContain('Operator validation checklist');
    expect(store.listAIDecisions({ tenantId: 'tenant-1' })).toHaveLength(1);
    expect(store.listAudits({ tenantId: 'tenant-1', actionPrefix: 'ai.decision' })).toHaveLength(1);
  });

  it('triggers HITL when confidence is below threshold', () => {
    const service = new P0AiTriageAssistService({
      config: { hitlConfidenceThreshold: 0.7 },
      store: new InMemoryP0TrustStore(),
    });

    const { decision } = service.buildSuggestionDecision({
      tenantId: 'tenant-1',
      ticketId: 'T-1',
      pack: buildPack('Medium'),
      diagnosis: buildDiagnosis(0.52),
      validation: buildValidation('approved'),
      promptVersion: 'prompt-v1',
      modelVersion: 'model-v1',
    });

    expect(decision.hitl_status).toBe('pending');
    expect(decision.policy_gate.outcome).toBe('hitl_required');
    expect(decision.policy_gate.reasons).toContain('confidence_below_0.7');
  });

  it('triggers HITL for policy-sensitive cases (high priority / validation)', () => {
    const service = new P0AiTriageAssistService({ store: new InMemoryP0TrustStore() });
    const diagnosis = buildDiagnosis(0.9);
    diagnosis.recommended_actions = [{ action: 'Modify core firewall policy', risk: 'high' }];

    const { decision } = service.buildSuggestionDecision({
      tenantId: 'tenant-1',
      ticketId: 'T-1',
      pack: buildPack('High'),
      diagnosis,
      validation: buildValidation('needs_more_info'),
      promptVersion: 'prompt-v2',
      modelVersion: 'model-v2',
    });

    expect(decision.hitl_status).toBe('pending');
    expect(decision.policy_gate.reasons).toEqual(
      expect.arrayContaining(['priority_high', 'validation_needs_more_info', 'high_risk_action_present'])
    );
  });
});
