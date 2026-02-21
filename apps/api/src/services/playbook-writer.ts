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
import { shouldBlockPlaybookOutput } from './evidence-guardrails.js';

const INTERNAL_LEAK_PATTERNS: RegExp[] = [
  /\bllm\b/i,
  /\bjson response\b/i,
  /\bprompt\b/i,
  /\bmodel output\b/i,
  /\bchain of thought\b/i,
  /\bsystem instruction\b/i,
  /\bdebug\b/i,
  /\bparse(?:r|)\s+json\b/i,
  /\bapi response\b/i,
];

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
    let llm;
    let response;
    let modelName = process.env.LLM_PROVIDER || 'gemini';
    try {
      llm = getDefaultLLMProvider();
      modelName = llm.name;
      response = await llm.complete(prompt);
    } catch (error) {
      const message = String((error as Error)?.message || '');
      throw new Error(
        `Playbook generation failed (${modelName}): ${message || 'unknown LLM error'}`
      );
    }
    let playbookMarkdown = response.content;

    const latencyMs = Date.now() - startTime;

    if (shouldBlockPlaybookOutput(playbookMarkdown, diagnosis, pack)) {
      throw new Error(
        `Playbook guardrail blocked unsupported inference for ticket ${pack.ticket.id}`
      );
    }
    if (this.hasInternalLeakage(playbookMarkdown)) {
      throw new Error(
        `Playbook contamination guard blocked output for ticket ${pack.ticket.id}`
      );
    }

    let sanitizedPlaybook = this.sanitizePlaybook(playbookMarkdown);

    if (!this.hasChecklistHypothesisAlignment(sanitizedPlaybook, diagnosis)) {
      const repairPrompt = `${prompt}

## REVISION REQUIRED
Your previous output did not map checklist items to the ranked hypotheses.
Regenerate the full playbook and ensure Resolution Steps include explicit hypothesis tags: [H1], [H2], [H3] where applicable.
`;
      const repair = await llm.complete(repairPrompt);
      playbookMarkdown = repair.content;
      sanitizedPlaybook = this.sanitizePlaybook(playbookMarkdown);
    }

    // ─── Validate playbook structure ────────────────────────────
    this.validatePlaybookStructure(sanitizedPlaybook);
    if (!this.hasChecklistHypothesisAlignment(sanitizedPlaybook, diagnosis)) {
      throw new Error(
        `Playbook generation failed: checklist is not aligned with ranked hypotheses for ticket ${pack.ticket.id}`
      );
    }

    // ─── Build output ──────────────────────────────────────────
    const playbook: PlaybookOutput = {
      content_md: sanitizedPlaybook,
      meta: {
        model: modelName,
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
    const digest = pack.evidence_digest;
    const endpoint = pack.iterative_enrichment?.sections?.endpoint;
    const capability = pack.capability_verification;

    return `You are an expert IT support engineer. Generate a detailed, safe, and actionable support playbook in Markdown format.

## DIAGNOSIS CONTEXT

**Issue Summary:** ${diagnosis.summary}

**Root Cause Hypothesis (Primary):**
${topHypothesis ? `- ${topHypothesis.hypothesis} (Confidence: ${(topHypothesis.confidence * 100).toFixed(0)}%)` : '- Multiple hypotheses identified'}

**Supporting Evidence:**
${diagnosis.top_hypotheses.map((h) => h.evidence.map((e) => `- ${e}`).join('\n')).join('\n')}

${digest ? `## EVIDENCE DIGEST (MANDATORY GROUNDING)
### Confirmed facts
${digest.facts_confirmed.map((fact) => `- [${fact.id}] ${fact.fact}`).join('\n') || '- none'}

### Candidate actions with refs
${digest.candidate_actions
  .map((action) => `- ${action.action} | refs: ${action.evidence_refs.join(', ')}`)
  .join('\n') || '- none'}

### Missing critical
${digest.missing_critical.map((m) => `- ${m.field}: ${m.why}`).join('\n') || '- none'}

### Rejected evidence
${digest.rejected_evidence.map((r) => `- ${r.id}: ${r.reason} (${r.summary})`).join('\n') || '- none'}
` : ''}

## VALIDATION GATES

✅ Status: ${validation.status}
✅ Safe to generate: ${validation.safe_to_generate_playbook}
${validation.quality_gates ? `✅ Quality gates: ${JSON.stringify(validation.quality_gates)}` : ''}
${validation.coverage_scores ? `✅ Coverage scores: ${JSON.stringify(validation.coverage_scores)}` : ''}

## TICKET CONTEXT

**Ticket:** ${pack.ticket.id} - ${pack.ticket.title}
**Priority:** ${pack.ticket.priority}
**Queue:** ${pack.ticket.queue}
**Known endpoint data:** device=${String(endpoint?.device_name?.value || 'unknown')}, os=${String(endpoint?.os_name?.value || 'unknown')} ${String(endpoint?.os_version?.value || '')}, last_user=${String(endpoint?.user_signed_in?.value || 'unknown')}
**Known capability data:** manufacturer=${String(capability?.manufacturer || 'unknown')}, model=${String(capability?.model || 'unknown')}, serial=${String(capability?.serial || 'unknown')}

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
1. **[H#] Step Title** - One line summary
   - Description of what to do
   - \`command to run\` if applicable
   - Expected output or behavior
   - ⚠️ Risks if applicable

2. **Next Step** - Continue...

Stop at step 8 maximum. Each step should be 30-60 seconds execution.

### Hypothesis Mapping Rule (MANDATORY)
- Map checklist steps to hypotheses using tags:
  - [H1] for primary hypothesis
  - [H2] for second hypothesis
  - [H3] for third hypothesis
- At least one checklist step must exist for each hypothesis with confidence >= 0.60.
- Do not produce a checklist focused only on H1 when H2/H3 are material.
- If a hypothesis cannot be actioned, add one explicit investigative step tagged to that hypothesis.

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
5. No hallucinations: Only reference things in the evidence digest and validated diagnosis
6. Do not turn missing integration credentials (401/invalid_client/auth failures) into root cause unless ticket explicitly mentions those integrations
7. Do not introduce security-compromise narratives unless directly evidenced in this ticket/signals/docs
8. Do not include any remediation step without at least one valid evidence reference from evidence digest
9. If capability verification is required and incomplete, output only directed data-collection steps (no final compatibility conclusion)
10. NEVER include internal-engine instructions or meta-steps (forbidden examples: "check LLM JSON response", "review prompt", "inspect model output", "parse JSON")
11. NEVER add data-collection steps for fields already present in Known endpoint/capability data above; use those facts directly.
12. If manufacturer+model are already known, do not ask to identify hardware model again.

## OUTPUT

Return ONLY the Markdown content. No explanation, no code fences wrapping the markdown itself.

Start with the title and continue with the sections above.`;
  }

  private hasChecklistHypothesisAlignment(
    markdown: string,
    diagnosis: DiagnosisOutput
  ): boolean {
    const required = (diagnosis.top_hypotheses || [])
      .slice(0, 3)
      .filter((h) => Number(h?.confidence || 0) >= 0.6)
      .map((h, idx) => `h${idx + 1}`);
    if (required.length === 0) return true;

    const lines = markdown.split('\n');
    const checklistItems = lines
      .filter((line) => /^\s*\d+\.\s+/.test(line))
      .map((line) => line.toLowerCase());

    return required.every((tag) =>
      checklistItems.some((line) => line.includes(`[${tag}]`))
    );
  }

  private hasInternalLeakage(markdown: string): boolean {
    return INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(markdown));
  }

  private sanitizePlaybook(markdown: string): string {
    const lines = markdown.split('\n');
    const cleaned = lines.filter((line) => !INTERNAL_LEAK_PATTERNS.some((pattern) => pattern.test(line)));
    return cleaned.join('\n').trim();
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
