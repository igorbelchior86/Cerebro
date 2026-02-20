import type { EvidencePack } from '@playbook-brain/types';
import { DiagnoseService } from '../../services/diagnose.js';

describe('DiagnoseService deterministic fallback', () => {
  it('uses evidence digest candidate actions when available', () => {
    const service = new DiagnoseService() as any;
    const pack: EvidencePack = {
      session_id: 's1',
      ticket: {
        id: 'T1',
        title: 'Phone line help',
        description: 'Phone not ringing',
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
        facts_confirmed: [],
        facts_conflicted: [],
        missing_critical: [],
        candidate_actions: [
          { action: 'Validate VoIP registration in provider portal', evidence_refs: ['fact-1'] },
          { action: 'Check handset provisioning profile', evidence_refs: ['fact-2'] },
        ],
        tech_context_detected: ['goto'],
        sources_consulted_by_facet: { base: ['itglue'] },
        rejected_evidence: [],
      },
      evidence_rules: {
        require_evidence_for_claims: true,
        no_destructive_steps_without_gating: true,
      },
      prepared_at: new Date().toISOString(),
    };

    const fallback = service.buildDeterministicFallback(pack, 0);
    expect(fallback.meta?.model).toBe('rules-fallback');
    expect(fallback.recommended_actions.map((a: any) => a.action)).toEqual([
      'Validate VoIP registration in provider portal',
      'Check handset provisioning profile',
    ]);
  });
});

