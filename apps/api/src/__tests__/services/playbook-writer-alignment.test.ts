import type { DiagnosisOutput } from '@cerebro/types';
import { PlaybookWriterService } from '../../services/playbook-writer.js';

describe('PlaybookWriter hypothesis alignment with anchor eligibility', () => {
  it('does not require checklist tags for high-confidence hypotheses marked anchor=no', () => {
    const service = new PlaybookWriterService() as any;
    const diagnosis: DiagnosisOutput = {
      summary: 'Test summary',
      top_hypotheses: [
        {
          rank: 1,
          hypothesis: 'Investigative-only hypothesis',
          confidence: 0.82,
          evidence: ['fact-1'],
          tests: ['Investigate'],
          // extra metadata from Diagnose strengthening
          ...( { playbook_anchor_eligible: false } as any ),
        },
        {
          rank: 2,
          hypothesis: 'Actionable hypothesis',
          confidence: 0.7,
          evidence: ['fact-2'],
          tests: ['Confirm'],
          ...( { playbook_anchor_eligible: true } as any ),
        },
      ] as any,
      missing_data: [],
      recommended_actions: [],
      do_not_do: [],
    };

    const markdown = `
## 🔧 Resolution Steps
1. **[H2] Validate DHCP and AP path**
2. Continue troubleshooting
`;

    expect(service.hasChecklistHypothesisAlignment(markdown, diagnosis)).toBe(true);
  });
});

