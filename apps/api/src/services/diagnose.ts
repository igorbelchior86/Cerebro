// ─────────────────────────────────────────────────────────────
// Diagnose Service — Multi-LLM Support (Groq, Anthropic, Minimax)
// ─────────────────────────────────────────────────────────────

import type {
  EvidencePack,
  DiagnosisOutput,
  Hypothesis,
  RecommendedAction,
} from '@playbook-brain/types';
import { getDefaultLLMProvider } from './llm-adapter.js';

export class DiagnoseService {
  /**
   * Diagnose the issue using configured LLM based on evidence pack
   */
  async diagnose(pack: EvidencePack): Promise<DiagnosisOutput> {
    const startTime = Date.now();

    // ─── Build diagnostic prompt ──────────────────────────────-----
    const prompt = this.buildDiagnosticPrompt(pack);

    // ─── Call LLM (Groq, Anthropic, or Minimax) ──────────────────
    const llm = getDefaultLLMProvider();
    const response = await llm.complete(prompt);
    const responseText = response.content;

    const latencyMs = Date.now() - startTime;

    // ─── Parse LLM response into DiagnosisOutput format ──────────
    const diagnosis = this.parseResponse(responseText, pack);

    // ─── Add metadata ──────────────────────────────────────────────
    diagnosis.meta = {
      model: process.env.LLM_PROVIDER || 'groq',
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
${
  pack.device
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
7. Reference the related cases for context`;
  }

  /**
   * Parse Claude's JSON response into DiagnosisOutput
   */
  private parseResponse(responseText: string, pack: EvidencePack): DiagnosisOutput {
    try {
      const parsed = JSON.parse(responseText);

      return {
        summary: parsed.summary || 'Diagnosis complete.',
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
    } catch (err) {
      console.error('[DIAGNOSE] Failed to parse Claude response:', err);
      return {
        summary: 'Failed to generate diagnosis. Check logs.',
        top_hypotheses: [],
        missing_data: [],
        recommended_actions: [],
        do_not_do: ['Proceed without additional diagnosis'],
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
