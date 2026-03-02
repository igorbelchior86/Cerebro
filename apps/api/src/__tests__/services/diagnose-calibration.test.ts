import type { EvidencePack } from '@cerebro/types';
import { DiagnoseService } from '../../services/ai/diagnose.js';

function buildPackForEmailChange(): EvidencePack {
  return {
    session_id: 's-email',
    ticket: {
      id: 'T-EMAIL-1',
      title: 'Email address change request',
      description: 'User needs email address updated due to name change.',
      created_at: new Date().toISOString(),
      priority: 'Medium',
      queue: 'Support',
      category: 'Support',
    },
    org: { id: 'org-1', name: 'Acme' },
    signals: [],
    related_cases: [],
    external_status: [],
    docs: [],
    evidence_digest: {
      facts_confirmed: [
        { id: 'fact-ticket-email', fact: 'Ticket scope: email address change', evidence_score: 1, evidence_refs: ['ticket:T-EMAIL-1'], source: 'ticket', tenant_id: 't1', org_id: 'org-1', source_workspace: 'tenant:t1' },
        { id: 'fact-doc-email-proc', fact: 'Doc evidence: email rename procedure', evidence_score: 0.7, evidence_refs: ['doc:1'], source: 'itglue', tenant_id: 't1', org_id: 'org-1', source_workspace: 'tenant:t1' },
        { id: 'fact-doc-firewall', fact: 'Doc evidence: firewall overview', evidence_score: 0.3, evidence_refs: ['doc:2'], source: 'itglue', tenant_id: 't1', org_id: 'org-1', source_workspace: 'tenant:t1' },
      ],
      facts_conflicted: [],
      missing_critical: [],
      candidate_actions: [
        { action: 'Confirm exact new email address', evidence_refs: ['fact-ticket-email'] },
      ],
      tech_context_detected: ['email', 'directory'],
      sources_consulted_by_facet: { ticket: ['autotask'], docs: ['itglue'] },
      rejected_evidence: [],
    },
    evidence_rules: {
      require_evidence_for_claims: true,
      no_destructive_steps_without_gating: true,
    },
    missing_data: [],
    prepared_at: new Date().toISOString(),
  };
}

describe('DiagnoseService hypothesis calibration', () => {
  it('downgrades cross-domain firewall overreach on email change tickets', () => {
    const service = new DiagnoseService() as any;
    const pack = buildPackForEmailChange();

    const response = JSON.stringify({
      summary: 'Email address change request requiring updates across systems.',
      top_hypotheses: [
        {
          rank: 1,
          hypothesis: 'Firewall rules may require adjustment if the email address is used for access control.',
          confidence: 0.78,
          evidence: ['fact-doc-firewall'],
          tests: ['Review firewall rules for user-specific ACL references'],
          next_questions: ['Is email used in any ACLs?'],
        },
        {
          rank: 2,
          hypothesis: 'Email address needs updating across core systems and directories.',
          confidence: 0.72,
          evidence: ['fact-ticket-email', 'fact-doc-email-proc'],
          tests: ['Confirm exact new email address', 'Update directory/email aliases in approved systems'],
          next_questions: ['What is the exact new address?'],
        },
      ],
      missing_data: [],
      recommended_actions: [{ action: 'Confirm exact new email address', risk: 'low' }],
      do_not_do: [],
    });

    const diagnosis = service.parseResponse(response, pack);
    const [top, second] = diagnosis.top_hypotheses as any[];

    expect(top.hypothesis.toLowerCase()).toContain('email address needs updating');
    expect(top.grounding_status === 'grounded' || top.grounding_status === 'partial').toBe(true);
    expect(typeof top.calibrated_confidence).toBe('number');

    expect(second.hypothesis.toLowerCase()).toContain('firewall');
    expect((second.relevance_score || 1)).toBeLessThan(0.4);
    expect(second.playbook_anchor_eligible).toBe(false);
    expect((second.confidence_explanation || []).join(' ').toLowerCase()).toContain('downgraded=investigative');
  });
});
