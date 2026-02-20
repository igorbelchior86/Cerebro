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
import { createLLMProvider, getDefaultLLMProvider } from './llm-adapter.js';
import { shouldDowngradePlaybookToFallback } from './evidence-guardrails.js';

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
      const shouldFallback =
        modelName === 'gemini' &&
        (message.includes('GEMINI_API_KEY') || message.includes('[GeminiLimiter]') || message.includes('Gemini API error'));
      if (!shouldFallback) {
        const fallbackContent = this.buildDeterministicPlaybook(diagnosis, pack);
        return {
          content_md: fallbackContent,
          meta: {
            model: 'rules-fallback',
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            latency_ms: Date.now() - startTime,
          },
        };
      }
      try {
        llm = createLLMProvider('groq');
        modelName = llm.name;
        response = await llm.complete(prompt);
      } catch {
        const fallbackContent = this.buildDeterministicPlaybook(diagnosis, pack);
        return {
          content_md: fallbackContent,
          meta: {
            model: 'rules-fallback',
            input_tokens: 0,
            output_tokens: 0,
            cost_usd: 0,
            latency_ms: Date.now() - startTime,
          },
        };
      }
    }
    const playbookMarkdown = response.content;

    const latencyMs = Date.now() - startTime;

    if (shouldDowngradePlaybookToFallback(playbookMarkdown, diagnosis, pack)) {
      const fallbackContent = this.buildDeterministicPlaybook(diagnosis, pack);
      return {
        content_md: fallbackContent,
        meta: {
          model: `${modelName}-guardrail-fallback`,
          input_tokens: response.inputTokens,
          output_tokens: response.outputTokens,
          cost_usd: response.costUsd,
          latency_ms: latencyMs,
        },
      };
    }

    // ─── Validate playbook structure ────────────────────────────
    this.validatePlaybookStructure(playbookMarkdown);

    // ─── Build output ──────────────────────────────────────────
    const playbook: PlaybookOutput = {
      content_md: playbookMarkdown,
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

  private buildDeterministicPlaybook(diagnosis: DiagnosisOutput, pack: EvidencePack): string {
    const hypothesis = diagnosis.top_hypotheses?.[0]?.hypothesis || 'Issue requires guided triage';
    const evidence = diagnosis.top_hypotheses?.[0]?.evidence || [];
    const tests = diagnosis.top_hypotheses?.[0]?.tests || [];
    const digestActions = pack.evidence_digest?.candidate_actions || [];
    const actions = diagnosis.recommended_actions?.length
      ? diagnosis.recommended_actions
      : digestActions.map((action) => ({ action: action.action, risk: 'low' as const }));
    return `# [${pack.ticket.id}] - ${pack.ticket.title}

## Overview
- Issue: ${pack.ticket.description || 'No detailed description provided.'}
- Affected: ${pack.user?.name || 'Unknown user'} / ${pack.device?.hostname || 'Unknown device'}
- Impact: Medium (pending confirmation)
- Estimated Time: 15-30 minutes

## Root Cause
- Primary hypothesis: ${hypothesis}

## Pre-flight Checks
1. Confirm ticket scope with requester and capture exact error message.
2. Confirm affected user/device and whether issue is isolated or widespread.
3. Check current status of related services/connectivity.

## Resolution Steps
${actions.length ? actions.map((a, i) => `${i + 1}. ${a.action}`).join('\n') : '1. Gather missing context and replicate symptom.\n2. Execute standard triage checks based on the affected service or endpoint.\n3. Apply lowest-risk remediation aligned to confirmed findings.'}

## Verification
${tests.length ? tests.map((t, i) => `${i + 1}. ${t}`).join('\n') : '1. Confirm symptom no longer reproduces.\n2. Validate service/device health after change.\n3. Confirm with requester that business function is restored.'}

## Rollback
1. Revert the last change if behavior degrades.
2. Restore previous known-good configuration.
3. Escalate with collected evidence if issue persists.

## Escalation
- Escalate to: L2/L3 Operations
- If: root cause remains unconfirmed after baseline checks or impact expands

## Do Not Do
${(diagnosis.do_not_do || ['Do not perform destructive changes without approval']).map((d) => `- ${d}`).join('\n')}

## References
${evidence.length ? evidence.map((e) => `- ${e}`).join('\n') : '- Ticket narrative and collected context only.'}
`;
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
5. No hallucinations: Only reference things in the evidence digest and validated diagnosis
6. Do not turn missing integration credentials (401/invalid_client/auth failures) into root cause unless ticket explicitly mentions those integrations
7. Do not introduce security-compromise narratives unless directly evidenced in this ticket/signals/docs
8. Do not include any remediation step without at least one valid evidence reference from evidence digest
9. If capability verification is required and incomplete, output only directed data-collection steps (no final compatibility conclusion)

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
