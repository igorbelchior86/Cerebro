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
      recommended_actions: [
        { action: 'Collect missing context from ticket requester and confirm exact failure mode', risk: 'low' },
        { action: 'Run standard service/device connectivity checks based on environment baseline', risk: 'low' },
      ],
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
    const ticketInfo = `
## TICKET INFO
- ID: ${pack.ticket.id}
- Title: ${pack.ticket.title}
- Description: ${pack.ticket.description}
- Priority: ${pack.ticket.priority}
- Queue: ${pack.ticket.queue}
- Created: ${pack.ticket.created_at}
    `.trim();

    const deviceInfo =
      pack.device?.hostname || pack.user?.name
        ? `
## AFFECTED DEVICE/USER
${pack.device
            ? `- Device: ${pack.device.hostname} (${pack.device.os})
- Last Seen: ${pack.device.last_seen}
- OS: ${pack.device.os}
${pack.device.connection ? `- Connection: ${pack.device.connection.type}` : ''}`
            : ''
          }
${pack.user ? `- User: ${pack.user.name} (${pack.user.email})` : ''}
    `.trim()
        : '';

    const signalsInfo =
      pack.signals.length > 0
        ? `
## HEALTH SIGNALS & ALERTS
${pack.signals
            .map(
              (s) => `- [${s.source.toUpperCase()}] ${s.type}: ${s.summary} (${s.timestamp})`
            )
            .join('\n')}
    `.trim()
        : '';

    const relatedCasesInfo =
      pack.related_cases.length > 0
        ? `
## SIMILAR PAST CASES
${pack.related_cases
            .map((c) => `- ${c.symptom} → ${c.resolution} (resolved ${c.resolved_at})`)
            .join('\n')}
    `.trim()
        : '';

    const externalStatusInfo =
      pack.external_status.length > 0
        ? `
## EXTERNAL STATUS
${pack.external_status
            .map((s) => `- ${s.provider} (${s.region}): ${s.status}`)
            .join('\n')}
    `.trim()
        : '';

    const docsInfo =
      pack.docs.length > 0
        ? `
## RELEVANT DOCUMENTATION & RUNBOOKS
${pack.docs
            .map(
              (d) => `- [${d.source}] ${d.title} (relevance: ${d.relevance.toFixed(1)}/1.0)
  ${d.snippet}`
            )
            .join('\n\n')}
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

Your task: Analyze the provided evidence and generate a detailed technical diagnosis.

${ticketInfo}

${deviceInfo}

${signalsInfo}

${relatedCasesInfo}

${externalStatusInfo}

${docsInfo}

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
3. Recommended actions should be safe, tested, and prioritized by impact
4. "do_not_do" includes destructive actions, unsupported fixes, or risky changes
5. Be specific: avoid generic advice
6. Consider the priority level and SLA implications
7. Reference related cases only as weak prior context; never treat them as direct evidence
8. Never infer compromise/malware/phishing without direct evidence in this ticket/signals/docs
9. Missing integration access (401/invalid_client/auth failures) is missing data, not root cause unless the ticket is explicitly about those integrations
10. If evidence is insufficient, lower confidence and ask focused next_questions instead of escalating severity`;
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
