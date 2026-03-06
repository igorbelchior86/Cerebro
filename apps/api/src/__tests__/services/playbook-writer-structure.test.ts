import { PlaybookWriterService } from '../../services/ai/playbook-writer.js';

type PlaybookWriterInternals = {
  validatePlaybookStructure(markdown: string): void;
};

describe('PlaybookWriter structure contract (Phase 5)', () => {
  it('accepts playbook with field-guide sections (context, hypotheses, checklist, escalation)', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const markdown = `# [T1] - Wifi outage troubleshooting

## 📋 Context
- Client: Acme
- Scenario: Wifi down in warehouse

## 🧠 Hypotheses
- H1: AP failure
- H2: ISP outage (investigative)

## ✅ Checklist
1. **[H1] Check AP power**
2. **[H2] Check ISP portal**

## ✨ Verification
- Ping gateway recovers

## 🔄 Rollback
1. Revert AP change

## 📞 Escalation
- If AP unreachable after onsite power check, dispatch onsite tech
`;

    expect(() => service.validatePlaybookStructure(markdown)).not.toThrow();
  });

  it('rejects playbook missing escalation section', () => {
    const service = new PlaybookWriterService() as unknown as PlaybookWriterInternals;
    const markdown = `# [T1] - Wifi outage troubleshooting

## 📋 Context
- Client: Acme

## 🧠 Hypotheses
- H1: AP failure

## ✅ Checklist
1. **[H1] Check AP power**

## ✨ Verification
- Ping gateway recovers

## 🔄 Rollback
1. Revert AP change
`;

    expect(() => service.validatePlaybookStructure(markdown)).toThrow(/missing required sections/i);
  });
});
