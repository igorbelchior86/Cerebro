// ─────────────────────────────────────────────────────────────
// Diagnose Service — Multi-LLM Support (Groq, Anthropic, Minimax)
// ─────────────────────────────────────────────────────────────

import type {
  EvidencePack,
  DiagnosisOutput,
  Hypothesis,
  RecommendedAction,
} from '@playbook-brain/types';
import { createLLMProvider, getDefaultLLMProvider } from './llm-adapter.js';
import { shouldDowngradeDiagnosisToFallback } from './evidence-guardrails.js';

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
      const shouldFallback =
        modelName === 'gemini' &&
        (message.includes('GEMINI_API_KEY') || message.includes('[GeminiLimiter]') || message.includes('Gemini API error'));
      if (!shouldFallback) {
        return this.buildDeterministicFallback(pack, Date.now() - startTime);
      }
      try {
        llm = createLLMProvider('groq');
        modelName = llm.name;
        response = await llm.complete(prompt);
      } catch {
        return this.buildDeterministicFallback(pack, Date.now() - startTime);
      }
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

  private buildDeterministicFallback(pack: EvidencePack, latencyMs: number): DiagnosisOutput {
    const title = pack.ticket.title || 'Reported issue';
    const desc = pack.ticket.description || 'No description provided';
    const evidence = [title, desc].filter(Boolean).slice(0, 3);
    const digestActions = pack.evidence_digest?.candidate_actions || [];
    const recommendedActions =
      digestActions.length > 0
        ? digestActions.slice(0, 4).map((item) => ({
            action: item.action,
            risk: 'low' as const,
          }))
        : [
            { action: 'Collect missing context from ticket requester and confirm exact failure mode', risk: 'low' as const },
            { action: 'Run standard service/device connectivity checks based on environment baseline', risk: 'low' as const },
          ];
    return {
      summary: `Deterministic fallback diagnosis generated from ticket context for ${pack.ticket.id}.`,
      top_hypotheses: [
        {
          rank: 1,
          hypothesis: `Primary issue is consistent with user-reported symptom: ${title}`,
          confidence: 0.62,
          evidence,
          tests: ['Confirm current error state with the requester', 'Validate service/device status against recent known-good baseline'],
          next_questions: ['When did the issue start?', 'Does it affect one user/device or multiple?'],
        },
      ],
      missing_data: pack.missing_data || [],
      recommended_actions: recommendedActions,
      do_not_do: ['Do not apply destructive changes before confirming scope and root cause'],
      meta: {
        model: 'rules-fallback',
        input_tokens: 0,
        output_tokens: 0,
        cost_usd: 0,
        latency_ms: latencyMs,
      },
    };
  }

  private buildEvidenceAnchoredFallback(pack: EvidencePack): DiagnosisOutput {
    const fallback = this.buildDeterministicFallback(pack, 0);
    delete fallback.meta;
    fallback.summary = `Evidence-anchored fallback diagnosis generated for ${pack.ticket.id} due to unsupported high-risk inference in model output.`;
    return fallback;
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
   * Parse Claude's JSON response into DiagnosisOutput
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

      const parsedDiagnosis: DiagnosisOutput = {
        summary: String(parsed.summary || 'Diagnosis complete.'),
        top_hypotheses: (parsed.top_hypotheses || []).map(
          (h: any, idx: number) => ({
            rank: h.rank || idx + 1,
            hypothesis: h.hypothesis || 'Unknown hypothesis',
            confidence: Math.min(1, Math.max(0, h.confidence || 0)),
            evidence: Array.isArray(h.evidence) ? h.evidence : [],
            tests: Array.isArray(h.tests) ? h.tests : [],
            next_questions: Array.isArray(h.next_questions)
              ? h.next_questions
              : [],
          })
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

      if (shouldDowngradeDiagnosisToFallback(parsedDiagnosis, pack)) {
        return this.buildEvidenceAnchoredFallback(pack);
      }

      return parsedDiagnosis;
    } catch (err) {
      console.error('[DIAGNOSE] Failed to parse Claude response:', err);
      const seedEvidence = [
        pack.ticket.title,
        pack.ticket.description,
        ...(pack.signals?.slice(0, 2).map((s) => `${s.source}:${s.type}`) || []),
      ]
        .filter(Boolean)
        .slice(0, 3);

      return {
        summary: 'Fallback diagnosis generated due to invalid LLM JSON response.',
        top_hypotheses: [
          {
            rank: 1,
            hypothesis: `Intermittent service degradation related to ticket symptom: ${pack.ticket.title}`,
            confidence: 0.65,
            evidence: seedEvidence,
            tests: [
              'Re-run network reachability checks from affected endpoint',
              'Confirm scope of impact with at least one additional user/device',
            ],
            next_questions: pack.missing_data?.slice(0, 2).map((m) => `Confirm: ${m.field}`) || [],
          },
        ],
        missing_data: [],
        recommended_actions: [
          { action: 'Run safe diagnostic checks before any configuration change', risk: 'low' },
        ],
        do_not_do: ['Do not execute destructive changes without explicit approval'],
      };
    }
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
