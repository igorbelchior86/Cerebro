import type { EvidencePack } from '@cerebro/types';
import { DiagnoseService } from '../../services/diagnose.js';

describe('DiagnoseService fail-fast behavior', () => {
  it('throws when response cannot be parsed as diagnosis JSON', () => {
    const service = new DiagnoseService() as any;
    const pack: EvidencePack = {
      session_id: 's1',
      ticket: {
        id: 'T1',
        title: 'Email signature issue',
        description: 'Unable to apply signature in Outlook',
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
        candidate_actions: [],
        tech_context_detected: [],
        sources_consulted_by_facet: { base: ['itglue'] },
        rejected_evidence: [],
      },
      evidence_rules: {
        require_evidence_for_claims: true,
        no_destructive_steps_without_gating: true,
      },
      prepared_at: new Date().toISOString(),
    };

    expect(() => service.parseResponse('not-json', pack)).toThrow(
      /Diagnosis parse failed/
    );
  });
});
