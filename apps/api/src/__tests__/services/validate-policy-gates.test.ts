import type { DiagnosisOutput, EvidencePack } from '@playbook-brain/types';
import { ValidatePolicyService } from '../../services/validate-policy.js';

function buildDiagnosis(): DiagnosisOutput {
  return {
    summary: 'VPN connectivity issue likely tied to endpoint tunnel negotiation.',
    top_hypotheses: [
      {
        rank: 1,
        hypothesis: 'VPN client cannot negotiate tunnel due to endpoint profile drift',
        confidence: 0.82,
        evidence: ['fact-ticket-T1', 'fact-signal-s1'],
        tests: ['Validate tunnel status', 'Re-run endpoint posture check'],
      },
    ],
    missing_data: [],
    recommended_actions: [{ action: 'Validate endpoint VPN profile and tunnel logs', risk: 'low' }],
    do_not_do: ['Do not restart production firewall without approval'],
  };
}

function buildPack(): EvidencePack {
  return {
    session_id: 's1',
    tenant_id: 'tenant-1',
    source_workspace: 'tenant:tenant-1',
    ticket: {
      id: 'T1',
      title: 'VPN down for user',
      description: 'Remote access is failing for user john@example.com',
      created_at: new Date().toISOString(),
      priority: 'High',
      queue: 'Service Desk',
      category: 'Support',
    },
    org: { id: 'org-1', name: 'Acme Corp' },
    signals: [
      {
        id: 's1',
        source: 'ninja',
        timestamp: new Date().toISOString(),
        type: 'health_warn',
        summary: 'VPN check failed',
      },
    ],
    related_cases: [],
    external_status: [],
    docs: [
      {
        id: 'd1',
        source: 'itglue',
        title: 'Fortinet VPN runbook',
        snippet: 'Standard tunnel recovery steps',
        relevance: 0.8,
      },
    ],
    entity_resolution: {
      extracted_entities: {
        person: ['John Example'],
        company: ['Acme Corp'],
        phone: [],
        email: ['john@example.com'],
        location: [],
        product_or_domain: ['fortinet'],
      },
      resolved_actor: {
        id: 'c-1',
        name: 'John Example',
        email: 'john@example.com',
        confidence: 'strong',
      },
      status: 'resolved',
    },
    evidence_digest: {
      facts_confirmed: [
        {
          id: 'fact-ticket-T1',
          fact: 'Ticket reports VPN failure',
          evidence_score: 1,
          evidence_refs: ['fact-ticket-T1'],
          source: 'ticket',
          tenant_id: 'tenant-1',
          org_id: 'org-1',
          source_workspace: 'tenant:tenant-1',
        },
        {
          id: 'fact-signal-s1',
          fact: 'VPN health check failed',
          evidence_score: 0.7,
          evidence_refs: ['fact-signal-s1'],
          source: 'ninjaone',
          tenant_id: 'tenant-1',
          org_id: 'org-1',
          source_workspace: 'tenant:tenant-1',
        },
      ],
      facts_conflicted: [],
      missing_critical: [],
      candidate_actions: [
        {
          action: 'Check Fortinet tunnel status and endpoint profile',
          evidence_refs: ['fact-ticket-T1', 'fact-signal-s1'],
        },
      ],
      tech_context_detected: ['fortinet', 'vpn'],
      sources_consulted_by_facet: {
        base: ['itglue', 'ninjaone'],
      },
      rejected_evidence: [],
      capability_verification: {
        required: false,
        device_match_strong: true,
        model_spec_confirmed: true,
      },
    },
    capability_verification: {
      required: false,
      device_match_strong: true,
      model_spec_confirmed: true,
    },
    evidence_rules: {
      require_evidence_for_claims: true,
      no_destructive_steps_without_gating: true,
    },
    prepared_at: new Date().toISOString(),
  };
}

describe('validate policy quality gates', () => {
  it('blocks playbook generation when actor is unresolved', () => {
    const service = new ValidatePolicyService();
    const pack = buildPack();
    pack.entity_resolution = {
      extracted_entities: pack.entity_resolution!.extracted_entities,
      actor_candidates: [{ id: 'c-1', name: 'John Example', score: 0.6, score_breakdown: { exact_name: 0.4, email: 0.2, phone: 0, company_normalized: 0 } }],
      status: 'ambiguous',
      disambiguation_question: 'Confirm if actor is John Example',
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.status).toBe('needs_more_info');
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('named_entity_unresolved');
  });

  it('blocks capability tickets when verification is incomplete', () => {
    const service = new ValidatePolicyService();
    const pack = buildPack();
    pack.capability_verification = {
      required: true,
      device_match_strong: false,
      model_spec_confirmed: false,
      device_match_reason: 'device not resolved',
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.status).toBe('needs_more_info');
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('capability_verification_incomplete');
  });

  it('approves when quality gates and coverage pass', () => {
    const service = new ValidatePolicyService();
    const result = service.validate(buildDiagnosis(), buildPack());

    expect(result.status).toBe('approved');
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.violations.find((v) => v.type === 'quality_gate')).toBeUndefined();
  });
});
