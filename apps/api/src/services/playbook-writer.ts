// ─────────────────────────────────────────────────────────────
// Playbook Writer Service — Generate Support Playbooks
// Takes Diagnosis + Validation and creates executable playbooks
// ─────────────────────────────────────────────────────────────

import type {
  DiagnosisOutput,
  ValidationOutput,
  PlaybookOutput,
  EvidencePack,
} from '@playbook-brain/types';
import { getDefaultLLMProvider } from './llm-adapter.js';

export class PlaybookWriterService {
  /**
   * Generate a playbook from diagnosis and validation
   */
  async generatePlaybook(
    diagnosis: DiagnosisOutput,
    validation: ValidationOutput,
    pack: EvidencePack
  ): Promise<PlaybookOutput> {
    // ─── Check if safe to proceed ──────────────────────────────
    if (!validation.safe_to_generate_playbook) {
      throw new Error(
        `Cannot generate playbook - validation status: ${validation.status}. ` +
          `Violations: ${validation.violations.map((v) => v.detail).join(', ')}`
      );
    }

    const startTime = Date.now();

    // ─── Build playbook generation prompt ──────────────────────
    const prompt = this.buildPlaybookPrompt(diagnosis, validation, pack);

    // ─── Call LLM ──────────────────────────────────────────────
    const llm = getDefaultLLMProvider();
    const response = await llm.complete(prompt);
    const playbookMarkdown = response.content;

    const latencyMs = Date.now() - startTime;

    // ─── Validate playbook structure ────────────────────────────
    this.validatePlaybookStructure(playbookMarkdown);

    // ─── Build output ──────────────────────────────────────────
    const playbook: PlaybookOutput = {
      content_md: playbookMarkdown,
      meta: {
        model: process.env.LLM_PROVIDER || 'groq',
        input_tokens: response.inputTokens,
        output_tokens: response.outputTokens,
        cost_usd: response.costUsd,
        latency_ms: latencyMs,
      },
    };

    return playbook;
  }

  /**
   * Build comprehensive prompt for playbook generation
   */
  private buildPlaybookPrompt(
    diagnosis: DiagnosisOutput,
    validation: ValidationOutput,
    pack: EvidencePack
  ): string {
    const topHypothesis = diagnosis.top_hypotheses[0];

    return `You are an expert IT support engineer. Generate a detailed, safe, and actionable support playbook in Markdown format.

## DIAGNOSIS CONTEXT

**Issue Summary:** ${diagnosis.summary}

**Root Cause Hypothesis (Primary):**
${topHypothesis ? `- ${topHypothesis.hypothesis} (Confidence: ${(topHypothesis.confidence * 100).toFixed(0)}%)` : '- Multiple hypotheses identified'}

**Supporting Evidence:**
${diagnosis.top_hypotheses.map((h) => h.evidence.map((e) => `- ${e}`).join('\n')).join('\n')}

## VALIDATION GATES

✅ Status: ${validation.status}
✅ Safe to generate: ${validation.safe_to_generate_playbook}

## TICKET CONTEXT

**Ticket:** ${pack.ticket.id} - ${pack.ticket.title}
**Priority:** ${pack.ticket.priority}
**Queue:** ${pack.ticket.queue}

## PLAYBOOK GENERATION REQUIREMENTS

Generate a MARKDOWN playbook with these sections:

# Title
\`\`\`
[TICKET-ID] - [Concise Title from Diagnosis]
\`\`\`

## 📋 Overview
- Issue: One paragraph summary
- Affected: ${pack.device?.hostname || 'Device'}, ${pack.user?.name || 'User'}, etc.
- Impact: High/Medium/Low with explanation
- Estimated Time: 5-30 minutes

## 🎯 Root Cause
- Primary hypothesis from diagnosis
- Contributing factors
- Why this happened

## ✅ Pre-flight Checks
List 3-5 checks to verify system state before starting:
- Check 1: Specific command or note
- Check 2: Specific command or note
- etc.

## 🔧 Resolution Steps
Numbered steps with:
1. **Step Title** - One line summary
   - Description of what to do
   - \`command to run\` if applicable
   - Expected output or behavior
   - ⚠️ Risks if applicable

2. **Next Step** - Continue...

Stop at step 8 maximum. Each step should be 30-60 seconds execution.

## ✨ Verification
- How to verify the fix worked
- Command to check status
- Expected outcome

## 🔄 Rollback (if needed)
If something goes wrong, how to revert:
1. Rollback step 1
2. Rollback step 2
3. Restore from backup (if needed)

## 📞 Escalation
- Escalate to: [Team/Department]
- If: [Condition where escalation needed]
- Contact: [Contact info or process]

## 🚨 DO NOT DO
${(diagnosis.do_not_do || []).map((action) => `- ❌ ${action}`).join('\n')}

## 📚 References
${pack.docs
  .slice(0, 3)
  .map((d) => `- [${d.title}](${d.id})`)
  .join('\n')}

---

## STYLE REQUIREMENTS

1. Be specific: Use exact commands, file names, paths
2. Be safe: Include warnings, verification steps, rollback
3. Be clear: Use code blocks, formatting, step-by-step
4. Be practical: Estimated time, prerequisites, dependencies
5. No hallucinations: Only reference things in the evidence

## OUTPUT

Return ONLY the Markdown content. No explanation, no code fences wrapping the markdown itself.

Start with the title and continue with the sections above.`;
  }

  /**
   * Validate that the playbook has required sections
   */
  private validatePlaybookStructure(markdown: string): void {
    const requiredSections = [
      'overview',
      'root cause',
      'steps',
      'verification',
      'rollback',
    ];

    const lowerContent = markdown.toLowerCase();

    for (const section of requiredSections) {
      if (!lowerContent.includes(section)) {
        console.warn(
          `[WARN] Playbook missing expected section: "${section}". Generated content may be incomplete.`
        );
      }
    }
  }
}

/**
 * Generate playbook from diagnosis + validation
 */
export async function generatePlaybook(
  diagnosis: DiagnosisOutput,
  validation: ValidationOutput,
  pack: EvidencePack
): Promise<PlaybookOutput> {
  const service = new PlaybookWriterService();
  return service.generatePlaybook(diagnosis, validation, pack);
}

/**
 * Retrieve playbook from cache
 */
export async function getPlaybook(sessionId: string): Promise<PlaybookOutput | null> {
  // TODO: Implement cache retrieval from database
  return Promise.resolve(null);
}

/**
 * Save playbook to database
 */
export async function savePlaybook(
  sessionId: string,
  playbook: PlaybookOutput
): Promise<void> {
  // TODO: Implement persistence to database
  return Promise.resolve();
}
