import { PlaybookWriterService } from '../../services/ai/playbook-writer.js';

type PlaybookWriterInternals = {
  hasInternalLeakage(markdown: string): boolean;
  sanitizePlaybook(markdown: string): string;
};

describe('PlaybookWriter contamination guard', () => {
  it('detects internal-engine leakage terms', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const leaked = `
# Network Playbook
1. Check LLM JSON Response
2. Verify model output
`;
    expect(service.hasInternalLeakage(leaked)).toBe(true);
  });

  it('sanitizes internal-engine leakage lines', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const leaked = `
# Network Playbook
1. Verify Device Configuration
2. Check LLM JSON Response
3. Verify Phone Line Service
`;
    const cleaned = service.sanitizePlaybook(leaked);
    expect(cleaned.toLowerCase()).not.toContain('llm json response');
    expect(cleaned).toContain('Verify Device Configuration');
    expect(cleaned).toContain('Verify Phone Line Service');
  });

  it('does not block legitimate troubleshooting terms like API response or debug logs', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const legitimate = `
# Network Playbook
1. [H1] Check API response from Job Runner service endpoint for timeout or 5xx errors
2. [H2] Review application debug logs on the tablet and WAP event logs
3. [H3] Verify DHCP lease and gateway reachability
`;
    expect(service.hasInternalLeakage(legitimate)).toBe(false);
  });

  it('still blocks explicit model-meta leakage phrasing', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const leaked = `
# Network Playbook
1. Debug the prompt used for playbook generation
2. Inspect model API response and parse JSON
`;
    expect(service.hasInternalLeakage(leaked)).toBe(true);
  });
});
