import type { DiagnosisOutput, EvidencePack } from '@cerebro/types';
import { ValidatePolicyService } from '../../services/domain/validate-policy.js';

function buildField(value: unknown, status: 'confirmed' | 'inferred' | 'unknown' | 'conflict' = 'confirmed') {
  return {
    value,
    status,
    confidence: status === 'unknown' ? 0 : status === 'inferred' ? 0.65 : 1,
    source_system: 'test',
    observed_at: new Date().toISOString(),
    round: 1,
  };
}

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
  it('strict profile blocks playbook generation when actor is unresolved', () => {
    const service = new ValidatePolicyService({ profile: 'strict' });
    const pack = buildPack();
    pack.entity_resolution = {
      extracted_entities: pack.entity_resolution!.extracted_entities,
      actor_candidates: [{ id: 'c-1', name: 'John Example', score: 0.6, score_breakdown: { exact_name: 0.4, email: 0.2, phone: 0, company_normalized: 0 } }],
      status: 'ambiguous',
      disambiguation_question: 'Confirm if actor is John Example',
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.status).toBe('needs_more_info');
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.blocking_reasons).toContain('named_entity_unresolved');
  });

  it('strict profile blocks capability tickets when verification is incomplete', () => {
    const service = new ValidatePolicyService({ profile: 'strict' });
    const pack = buildPack();
    pack.capability_verification = {
      required: true,
      device_match_strong: false,
      model_spec_confirmed: false,
      device_match_reason: 'device not resolved',
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.status).toBe('needs_more_info');
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.blocking_reasons).toContain('capability_verification_incomplete');
  });

  it('standard profile allows generation with unresolved actor when ticket has person+contact hints', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const pack = buildPack();
    pack.entity_resolution = {
      extracted_entities: {
        ...pack.entity_resolution!.extracted_entities,
        person: ['John Example'],
        email: ['john@example.com'],
      },
      status: 'ambiguous',
      actor_candidates: [{ id: 'c-1', name: 'John Example', score: 0.6, score_breakdown: { exact_name: 0.4, email: 0.2, phone: 0, company_normalized: 0 } }],
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.blocking_reasons).not.toContain('named_entity_unresolved');
  });

  it('standard profile allows guided generation when capability verification is incomplete', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const pack = buildPack();
    pack.capability_verification = {
      required: true,
      device_match_strong: false,
      model_spec_confirmed: false,
      device_match_reason: 'device not resolved',
    };
    const result = service.validate(buildDiagnosis(), pack);
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.blocking_reasons).not.toContain('capability_verification_incomplete');
  });

  it('approves when quality gates and coverage pass', () => {
    const service = new ValidatePolicyService({ profile: 'strict' });
    const result = service.validate(buildDiagnosis(), buildPack());

    expect(result.status).toBe('approved');
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.violations.find((v) => v.type === 'quality_gate')).toBeUndefined();
  });

  it('blocks generation when top hypothesis is explicitly unsupported by diagnose grounding', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const diagnosis = buildDiagnosis();
    (diagnosis.top_hypotheses[0] as any).grounding_status = 'unsupported';
    (diagnosis.top_hypotheses[0] as any).support_score = 0.12;
    (diagnosis.top_hypotheses[0] as any).relevance_score = 0.78;
    (diagnosis.top_hypotheses[0] as any).calibrated_confidence = 0.68;
    (diagnosis.top_hypotheses[0] as any).playbook_anchor_eligible = false;

    const result = service.validate(diagnosis, buildPack());
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('diagnose_top_hypothesis_unsupported');
  });

  it('adds advisory when no hypothesis is playbook-anchor eligible', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const diagnosis = buildDiagnosis();
    diagnosis.top_hypotheses = diagnosis.top_hypotheses.map((h) => ({
      ...h,
      confidence: 0.62,
      evidence: ['fact-ticket-T1'],
      tests: ['Investigate further'],
    })) as any;
    diagnosis.top_hypotheses.forEach((h: any) => {
      h.grounding_status = 'weak';
      h.support_score = 0.3;
      h.relevance_score = 0.55;
      h.playbook_anchor_eligible = false;
    });

    const result = service.validate(diagnosis, buildPack());
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.violations.some((v) => /playbook_anchor_eligible/i.test(v.detail))).toBe(true);
  });

  it('blocks safe generation when rejected evidence contains invalid_source_scope', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const pack = buildPack();
    pack.evidence_digest = {
      ...pack.evidence_digest!,
      rejected_evidence: [
        {
          id: 'doc:foreign',
          source: 'itglue',
          reason: 'invalid_source_scope',
          summary: 'foreign org evidence while target org unresolved',
          tenant_id: 'tenant-1',
          org_id: 'org-999',
          source_workspace: 'tenant:tenant-1',
          evidence_score: 0,
        },
      ],
    };

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('cross_tenant_candidate_detected');
  });

  it('blocks generation when mandatory ticket fields are unknown in iterative enrichment', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const pack = buildPack();
    pack.iterative_enrichment = {
      schema_version: '1.0.0',
      completed_rounds: 2,
      stop_reason: 'marginal_gain',
      rounds: [],
      coverage: {
        total: 30,
        confirmed: 10,
        inferred: 10,
        unknown: 10,
        conflict: 0,
        completion_ratio: 0.67,
      },
      sections: {
        ticket: {
          ticket_id: buildField('T1'),
          company: buildField('unknown', 'unknown'),
          requester_name: buildField('John Example'),
          requester_email: buildField('john@example.com'),
          affected_user_name: buildField('John Example'),
          affected_user_email: buildField('john@example.com'),
          created_at: buildField(new Date().toISOString()),
          title: buildField('VPN down for user'),
          description_clean: buildField('Remote access is failing'),
        },
        identity: {
          user_principal_name: buildField('john@example.com'),
          account_status: buildField('unknown', 'unknown'),
          mfa_state: buildField('unknown', 'unknown'),
          licenses_summary: buildField('Unknown', 'unknown'),
          groups_top: buildField('unknown', 'unknown'),
        },
        endpoint: {
          device_name: buildField('ACME-LT-01'),
          device_type: buildField('laptop', 'inferred'),
          os_name: buildField('Windows'),
          os_version: buildField('11'),
          last_check_in: buildField(new Date().toISOString()),
          security_agent: buildField({ state: 'unknown', name: 'Unknown' }, 'unknown'),
          user_signed_in: buildField('john@example.com', 'inferred'),
          user_signed_in_at: buildField(new Date().toISOString(), 'inferred'),
        },
        network: {
          location_context: buildField('remote', 'inferred'),
          public_ip: buildField('8.8.8.8'),
          isp_name: buildField('unknown', 'unknown'),
          vpn_state: buildField('connected', 'inferred'),
          phone_provider: buildField('unknown', 'unknown'),
          phone_provider_name: buildField('unknown', 'unknown'),
        },
        infra: {
          firewall_make_model: buildField('unknown', 'unknown'),
          wifi_make_model: buildField('unknown', 'unknown'),
          switch_make_model: buildField('unknown', 'unknown'),
        },
      },
    } as any;

    const result = service.validate(buildDiagnosis(), pack);
    expect(result.status).toBe('needs_more_info');
    expect(result.safe_to_generate_playbook).toBe(true);
    expect(result.blocking_reasons).toContain('mandatory_ticket_fields_missing');
  });

  it('blocks broad ISP/provider hypothesis when no corroborating evidence exists', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const pack = buildPack();
    pack.related_cases = [];
    pack.external_status = [];
    pack.evidence_digest = {
      ...pack.evidence_digest!,
      facts_confirmed: [
        {
          id: 'fact-ticket-T1',
          fact: 'Ticket reports intermittent internet issues',
          evidence_score: 1,
          evidence_refs: ['fact-ticket-T1'],
          source: 'ticket',
          tenant_id: 'tenant-1',
          org_id: 'org-1',
          source_workspace: 'tenant:tenant-1',
        },
      ],
    };
    const diagnosis = buildDiagnosis();
    diagnosis.top_hypotheses = [
      {
        rank: 1,
        hypothesis: 'ISP regional outage affecting provider connectivity',
        confidence: 0.74,
        evidence: ['fact-ticket-T1'],
        tests: ['Check ISP status page'],
      },
    ];

    const result = service.validate(diagnosis, pack);
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('broad_hypothesis_corroboration_missing');
  });

  it('blocks destructive remediation without explicit human approval gate', () => {
    const service = new ValidatePolicyService({ profile: 'standard' });
    const diagnosis = buildDiagnosis();
    diagnosis.recommended_actions = [
      { action: 'Factory reset the firewall to clear bad config state', risk: 'high' },
    ];

    const result = service.validate(diagnosis, buildPack());
    expect(result.status).toBe('blocked');
    expect(result.safe_to_generate_playbook).toBe(false);
    expect(result.blocking_reasons).toContain('destructive_action_requires_human_approval');
  });
});
