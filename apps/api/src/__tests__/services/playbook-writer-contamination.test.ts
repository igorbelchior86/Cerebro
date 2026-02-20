import { PlaybookWriterService } from '../../services/playbook-writer.js';

describe('PlaybookWriter contamination guard', () => {
  it('detects internal-engine leakage terms', () => {
    const service = new PlaybookWriterService() as any;
    const leaked = `
# Network Playbook
1. Check LLM JSON Response
2. Verify model output
`;
    expect(service.hasInternalLeakage(leaked)).toBe(true);
  });

  it('sanitizes internal-engine leakage lines', () => {
    const service = new PlaybookWriterService() as any;
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
});
