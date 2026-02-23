// ─────────────────────────────────────────────────────────────
// Diagnose Service — Multi-LLM Support (Groq, Anthropic, Minimax)
// ─────────────────────────────────────────────────────────────

import type {
  EvidencePack,
  DiagnosisOutput,
} from '@playbook-brain/types';
import { getDefaultLLMProvider } from './llm-adapter.js';
import { shouldBlockDiagnosisOutput } from './evidence-guardrails.js';

export class DiagnoseService {
  /**
   * Diagnose the issue using configured LLM based on evidence pack
   */
  async diagnose(pack: EvidencePack): Promise<DiagnosisOutput> {
    const startTime = Date.now();

    // ─── Build diagnostic prompt ──────────────────────────────-----
    const prompt = this.buildDiagnosticPrompt(pack);

    // ─── Call LLM (Groq, Anthropic, or Minimax) ──────────────────
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
        `Diagnosis generation failed (${modelName}): ${message || 'unknown LLM error'}`
      );
    }
    const responseText = response.content;

    const latencyMs = Date.now() - startTime;

    // ─── Parse LLM response into DiagnosisOutput format ──────────
    const diagnosis = this.parseResponse(responseText, pack);

    // ─── Add metadata ──────────────────────────────────────────────
    diagnosis.meta = {
      model: modelName as string,
      input_tokens: response.inputTokens,
      output_tokens: response.outputTokens,
      cost_usd: response.costUsd,
      latency_ms: latencyMs,
    };

    return diagnosis;
  }

  /**
   * Build comprehensive diagnostic prompt from evidence pack
   */
  private buildDiagnosticPrompt(pack: EvidencePack): string {
    const digest = pack.evidence_digest;

    const ticketInfo = `
## TICKET INFO
- ID: ${pack.ticket.id}
- Title: ${pack.ticket.title}
- Description: ${pack.ticket.description}
- Priority: ${pack.ticket.priority}
- Queue: ${pack.ticket.queue}
- Created: ${pack.ticket.created_at}
    `.trim();

    const digestInfo = digest
      ? `
## EVIDENCE DIGEST (PRIMARY CONTEXT)

### facts_confirmed
${digest.facts_confirmed.map((f) => `- [${f.id}] ${f.fact} (score=${f.evidence_score})`).join('\n') || '- none'}

### facts_conflicted
${digest.facts_conflicted.map((f) => `- [${f.id}] ${f.fact}`).join('\n') || '- none'}

### missing_critical
${digest.missing_critical.map((m) => `- ${m.field}: ${m.why}`).join('\n') || '- none'}

### candidate_actions_with_evidence_refs
${digest.candidate_actions
          .map((a) => `- ${a.action} | evidence_refs: ${a.evidence_refs.join(', ')}`)
          .join('\n') || '- none'}

### tech_context_detected
${digest.tech_context_detected.map((t) => `- ${t}`).join('\n') || '- none'}

### sources_consulted_by_facet
${Object.entries(digest.sources_consulted_by_facet || {})
          .map(([facet, sources]) => `- ${facet}: ${(sources || []).join(', ')}`)
          .join('\n') || '- none'}

### rejected_evidence
${(digest.rejected_evidence || []).map((r) => `- ${r.id}: ${r.reason} (${r.summary})`).join('\n') || '- none'}
      `.trim()
      : '';

    const fallbackRawContext = !digest
      ? `
## RAW FALLBACK CONTEXT (ONLY WHEN DIGEST IS MISSING)
${pack.signals.length > 0
          ? `### Signals\n${pack.signals
            .map((s) => `- [${s.source.toUpperCase()}] ${s.type}: ${s.summary} (${s.timestamp})`)
            .join('\n')}`
          : ''}
${pack.docs.length > 0
          ? `\n### Docs\n${pack.docs.map((d) => `- [${d.source}] ${d.title}`).join('\n')}`
          : ''}
${pack.related_cases.length > 0
          ? `\n### Related Cases\n${pack.related_cases.map((c) => `- ${c.symptom} -> ${c.resolution}`).join('\n')}`
          : ''}
      `.trim()
      : '';

    const missingDataInfo =
      pack.missing_data && pack.missing_data.length > 0
        ? `
## MISSING DATA
${pack.missing_data.map((m) => `- ${m.field}: ${m.why}`).join('\n')}
    `.trim()
        : '';

    return `You are an expert IT support specialist and network systems diagnostician.

Your task: Analyze the provided evidence digest and generate a detailed technical diagnosis.

${ticketInfo}

${digestInfo}

${fallbackRawContext}

${missingDataInfo}

## REQUIRED OUTPUT FORMAT

Respond with ONLY a valid JSON object (no markdown, no code blocks) with this EXACT structure:

{
  "summary": "one-paragraph executive summary of the diagnosis",
  "top_hypotheses": [
    {
      "rank": 1,
      "hypothesis": "specific technical diagnosis",
      "confidence": 0.95,
      "evidence": ["evidence point 1", "evidence point 2"],
      "tests": ["test to confirm: step 1", "test to confirm: step 2"],
      "next_questions": ["clarification question 1"]
    }
  ],
  "missing_data": [
    {"field": "fieldname", "why": "why it matters for diagnosis"}
  ],
  "recommended_actions": [
    {"action": "specific actionable step", "risk": "low|medium|high"}
  ],
  "do_not_do": [
    "dangerous action to avoid"
  ]
}

Rules:
1. Top 3 hypotheses ranked by confidence (0.0-1.0)
2. Each hypothesis must have supporting evidence and tests
3. Prefer actions from candidate_actions_with_evidence_refs when available
4. Never recommend an action that has no supporting evidence reference in facts_confirmed
5. If evidence is insufficient, explicitly lower confidence and keep status investigative
6. "do_not_do" includes destructive actions, unsupported fixes, or risky changes
7. Be specific: avoid generic advice
8. Consider the priority level and SLA implications
9. Reference related cases only as weak prior context; never treat them as direct evidence
10. Never infer compromise/malware/phishing without direct evidence in this ticket/signals/docs
11. Missing integration access (401/invalid_client/auth failures) is missing data, not root cause unless the ticket is explicitly about those integrations`;
  }

  /**
   * Parse LLM response into DiagnosisOutput
   */
  private parseResponse(responseText: string, pack: EvidencePack): DiagnosisOutput {
    try {
      // Robust JSON extraction: look for ```json ... ``` or just the first {
      let cleanJson = responseText.trim();
      if (cleanJson.includes('```')) {
        const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) cleanJson = match[1] || '';
      }

      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(cleanJson);
      const algorithmicBaseline = this.calculateAlgorithmicBaseline(pack);

      const parsedDiagnosis: DiagnosisOutput = {
        summary: String(parsed.summary || 'Diagnosis complete.'),
        top_hypotheses: (parsed.top_hypotheses || []).map(
          (h: any, idx: number) => {
            const llmConfidence = Math.min(1, Math.max(0, h.confidence || 0));
            // BLENDING LOGIC: 60% LLM, 40% Algorithmic Baseline
            // If internal identifier match is strong, baseline pushes it up.
            const blendedConfidence = Number((0.6 * llmConfidence + 0.4 * algorithmicBaseline).toFixed(3));

            return {
              rank: h.rank || idx + 1,
              hypothesis: h.hypothesis || 'Unknown hypothesis',
              confidence: blendedConfidence,
              evidence: Array.isArray(h.evidence) ? h.evidence : [],
              tests: Array.isArray(h.tests) ? h.tests : [],
              next_questions: Array.isArray(h.next_questions)
                ? h.next_questions
                : [],
            };
          }
        ),
        missing_data: Array.isArray(parsed.missing_data)
          ? parsed.missing_data
          : [],
        recommended_actions: (parsed.recommended_actions || []).map(
          (a: any) => ({
            action: a.action || 'Unknown action',
            risk: (['low', 'medium', 'high'].includes(a.risk)
              ? a.risk
              : 'medium') as 'low' | 'medium' | 'high',
          })
        ),
        do_not_do: Array.isArray(parsed.do_not_do) ? parsed.do_not_do : [],
      };

      if (shouldBlockDiagnosisOutput(parsedDiagnosis, pack)) {
        throw new Error(
          `Diagnosis guardrail blocked unsupported inference for ticket ${pack.ticket.id}`
        );
      }

      return parsedDiagnosis;
    } catch (err) {
      console.error('[DIAGNOSE] Failed to parse response:', err);
      throw new Error(
        `Diagnosis parse failed for ticket ${pack.ticket.id}: ${(err as Error)?.message || String(err)}`
      );
    }
  }

  /**
   * Weighted Linear Model for deterministic confidence baseline
   */
  private calculateAlgorithmicBaseline(pack: EvidencePack): number {
    let score = 0;
    const capability = pack.capability_verification;
    const entity = pack.entity_resolution;

    // Asset Identification (Total max 0.6)
    const reason = String(capability?.device_match_reason || '').toLowerCase();
    if (reason.includes('serial') || reason.includes('asset tag')) {
      score += 0.5; // Strong ID match
    } else if (capability?.device_match_strong) {
      score += 0.3; // Hostname/Generic match
    }

    if (pack.device && capability?.model_spec_confirmed) {
      score += 0.1; // Hardware spec confirmation
    }

    // Actor Resolution (Total max 0.2)
    if (entity?.resolved_actor?.confidence === 'strong') {
      score += 0.2;
    } else if (entity?.resolved_actor?.confidence === 'medium') {
      score += 0.1;
    }

    // Org Context (Total max 0.1)
    if (pack.org?.id && pack.org.id !== 'unknown') {
      score += 0.1;
    }

    // History Correlation (Total max 0.1)
    if ((pack.related_cases || []).length > 0) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }
}

/**
 * Diagnose a given evidence pack
 */
export async function diagnoseEvidencePack(
  pack: EvidencePack
): Promise<DiagnosisOutput> {
  const service = new DiagnoseService();
  return service.diagnose(pack);
}

/**
 * Retrieve diagnosis from cache
 */
export function getDiagnosisFromSession(sessionId: string): Promise<DiagnosisOutput | null> {
  // TODO: Implement cache retrieval from Redis or database
  return Promise.resolve(null);
}

/**
 * Cache diagnosis result
 */
export function cacheDiagnosis(
  sessionId: string,
  diagnosis: DiagnosisOutput
): Promise<void> {
  // TODO: Implement cache storage in Redis or database
  return Promise.resolve();
}
