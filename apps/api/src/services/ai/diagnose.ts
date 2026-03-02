// ─────────────────────────────────────────────────────────────
// Diagnose Service — Multi-LLM Support (Groq, Anthropic, Minimax)
// ─────────────────────────────────────────────────────────────

import type {
  EvidencePack,
  DiagnosisOutput,
  Hypothesis,
} from '@cerebro/types';
import { getDefaultLLMProvider } from './llm-adapter.js';
import { shouldBlockDiagnosisOutput } from '../domain/evidence-guardrails.js';

type HypothesisGroundingStatus = 'grounded' | 'partial' | 'weak' | 'unsupported';
type EnrichedHypothesis = Hypothesis & {
  llm_confidence?: number;
  calibrated_confidence?: number;
  support_score?: number;
  relevance_score?: number;
  grounding_status?: HypothesisGroundingStatus;
  confidence_explanation?: string[];
  playbook_anchor_eligible?: boolean;
};

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

      const parsedHypotheses: EnrichedHypothesis[] = (parsed.top_hypotheses || []).map(
        (h: any, idx: number) => {
          const llmConfidence = Math.min(1, Math.max(0, Number(h.confidence || 0)));
          // Keep a backward-compatible baseline confidence before deterministic calibration.
          const baselineBlendedConfidence = Number(
            (0.6 * llmConfidence + 0.4 * algorithmicBaseline).toFixed(3)
          );

          return {
            rank: h.rank || idx + 1,
            hypothesis: h.hypothesis || 'Unknown hypothesis',
            confidence: baselineBlendedConfidence,
            llm_confidence: llmConfidence,
            evidence: Array.isArray(h.evidence) ? h.evidence : [],
            tests: Array.isArray(h.tests) ? h.tests : [],
            next_questions: Array.isArray(h.next_questions)
              ? h.next_questions
              : [],
          };
        }
      );

      const calibratedHypotheses = this.enrichAndRankHypotheses(
        parsedHypotheses,
        pack,
        algorithmicBaseline
      );

      const parsedDiagnosis: DiagnosisOutput = {
        summary: String(parsed.summary || 'Diagnosis complete.'),
        top_hypotheses: calibratedHypotheses as Hypothesis[],
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

  private enrichAndRankHypotheses(
    hypotheses: EnrichedHypothesis[],
    pack: EvidencePack,
    algorithmicBaseline: number
  ): EnrichedHypothesis[] {
    const ticketDomains = this.detectDomains(
      `${pack.ticket.title || ''} ${pack.ticket.description || ''} ${(pack.evidence_digest?.tech_context_detected || []).join(' ')}`
    );
    const confirmedFacts = (pack.evidence_digest?.facts_confirmed || []) as Array<any>;
    const conflictedFacts = (pack.evidence_digest?.facts_conflicted || []) as Array<any>;
    const missingCritical = (pack.evidence_digest?.missing_critical || []) as Array<any>;
    const confirmedIds = new Set(confirmedFacts.map((f) => String(f?.id || '').trim()).filter(Boolean));
    const conflictedIds = new Set(conflictedFacts.map((f) => String(f?.id || '').trim()).filter(Boolean));
    const candidateActionText = (pack.evidence_digest?.candidate_actions || [])
      .map((a: any) => String(a?.action || '').toLowerCase())
      .filter(Boolean);

    const processed = hypotheses.map((hyp, idx) =>
      this.scoreAndCalibrateHypothesis({
        hyp,
        idx,
        ticketDomains,
        confirmedIds,
        conflictedIds,
        confirmedFacts,
        conflictedFacts,
        missingCritical,
        candidateActionText,
        algorithmicBaseline,
      })
    );

    return processed
      .sort((a, b) => {
        const confDelta = (b.calibrated_confidence || b.confidence) - (a.calibrated_confidence || a.confidence);
        if (Math.abs(confDelta) > 0.0001) return confDelta;
        return (b.support_score || 0) - (a.support_score || 0);
      })
      .slice(0, 3)
      .map((h, i) => ({ ...h, rank: i + 1 }));
  }

  private scoreAndCalibrateHypothesis(input: {
    hyp: EnrichedHypothesis;
    idx: number;
    ticketDomains: Set<string>;
    confirmedIds: Set<string>;
    conflictedIds: Set<string>;
    confirmedFacts: Array<any>;
    conflictedFacts: Array<any>;
    missingCritical: Array<any>;
    candidateActionText: string[];
    algorithmicBaseline: number;
  }): EnrichedHypothesis {
    const { hyp, idx, ticketDomains, confirmedIds, conflictedIds, confirmedFacts, conflictedFacts, missingCritical, candidateActionText, algorithmicBaseline } = input;
    const llmConfidence = Math.min(1, Math.max(0, Number(hyp.llm_confidence ?? hyp.confidence ?? 0)));
    const evidenceRefs = (hyp.evidence || []).map((e) => String(e || '').trim()).filter(Boolean);
    const tests = (hyp.tests || []).map((t) => String(t || '').trim()).filter(Boolean);
    const hypothesisText = String(hyp.hypothesis || '');
    const hypothesisLower = hypothesisText.toLowerCase();

    const directConfirmedMatches = evidenceRefs.filter((e) => confirmedIds.has(e)).length;
    const directConflictMatches = evidenceRefs.filter((e) => conflictedIds.has(e)).length;
    const evidencePresenceScore = evidenceRefs.length > 0 ? Math.min(0.28, 0.08 * evidenceRefs.length) : 0;
    const directGroundingScore = Math.min(0.52, 0.2 * directConfirmedMatches);
    const testsScore = tests.length > 0 ? Math.min(0.12, 0.04 * tests.length) : 0;
    const candidateActionAlignmentScore = tests.some((t) =>
      candidateActionText.some((a) => a && (t.toLowerCase().includes(a) || a.includes(t.toLowerCase())))
    )
      ? 0.08
      : 0;
    const unsupportedEvidencePenalty = evidenceRefs.length > 0 && directConfirmedMatches === 0 ? 0.12 : 0;
    const supportScore = this.clamp01(
      evidencePresenceScore + directGroundingScore + testsScore + candidateActionAlignmentScore - unsupportedEvidencePenalty
    );

    const hypothesisDomains = this.detectDomains(hypothesisText);
    const relevanceScore = this.computeRelevanceScore(ticketDomains, hypothesisDomains, hypothesisLower);

    const conflictPenalty = Math.min(0.22, 0.08 * directConflictMatches) +
      this.computeConflictThemePenalty(hypothesisLower, conflictedFacts);
    const missingCriticalPenalty = this.computeMissingCriticalPenalty(hypothesisLower, missingCritical);

    let calibrated = 0.42 * llmConfidence +
      0.18 * algorithmicBaseline +
      0.24 * supportScore +
      0.16 * relevanceScore -
      conflictPenalty -
      missingCriticalPenalty;

    if (relevanceScore < 0.35) calibrated -= 0.08;
    if (supportScore < 0.25) calibrated -= 0.06;

    const calibratedConfidence = Number(this.clamp01(calibrated, 0.05, 0.98).toFixed(3));
    const groundingStatus = this.computeGroundingStatus({
      supportScore,
      relevanceScore,
      directConfirmedMatches,
    });
    const playbookAnchorEligible =
      (groundingStatus === 'grounded' || groundingStatus === 'partial') &&
      relevanceScore >= 0.55 &&
      calibratedConfidence >= 0.45;

    const confidenceExplanation: string[] = [
      `llm=${llmConfidence.toFixed(2)}`,
      `baseline=${algorithmicBaseline.toFixed(2)}`,
      `support=${supportScore.toFixed(2)} (${directConfirmedMatches} direct ref${directConfirmedMatches === 1 ? '' : 's'})`,
      `relevance=${relevanceScore.toFixed(2)}${hypothesisDomains.size ? ` [${[...hypothesisDomains].join(',')}]` : ''}`,
    ];
    if (conflictPenalty > 0) confidenceExplanation.push(`conflict_penalty=${conflictPenalty.toFixed(2)}`);
    if (missingCriticalPenalty > 0) confidenceExplanation.push(`missing_penalty=${missingCriticalPenalty.toFixed(2)}`);
    if (!playbookAnchorEligible) confidenceExplanation.push('downgraded=investigative');
    confidenceExplanation.push(`idx=${idx + 1}`);

    return {
      ...hyp,
      confidence: calibratedConfidence,
      calibrated_confidence: calibratedConfidence,
      support_score: Number(supportScore.toFixed(3)),
      relevance_score: Number(relevanceScore.toFixed(3)),
      grounding_status: groundingStatus,
      confidence_explanation: confidenceExplanation,
      playbook_anchor_eligible: playbookAnchorEligible,
    };
  }

  private computeGroundingStatus(input: {
    supportScore: number;
    relevanceScore: number;
    directConfirmedMatches: number;
  }): HypothesisGroundingStatus {
    const { supportScore, relevanceScore, directConfirmedMatches } = input;
    if (directConfirmedMatches > 0 && supportScore >= 0.62 && relevanceScore >= 0.62) return 'grounded';
    if (supportScore >= 0.45 && relevanceScore >= 0.5) return 'partial';
    if (supportScore >= 0.25) return 'weak';
    return 'unsupported';
  }

  private computeConflictThemePenalty(hypothesisLower: string, conflictedFacts: Array<any>): number {
    if (!conflictedFacts.length) return 0;
    const conflictText = conflictedFacts.map((f) => String(f?.fact || '').toLowerCase()).join(' ');
    const identityKeywords = /(user|requester|logged-in|logged in|account|profile|authentication|auth)/;
    if (identityKeywords.test(hypothesisLower) && identityKeywords.test(conflictText)) {
      return 0.05;
    }
    return 0;
  }

  private computeMissingCriticalPenalty(hypothesisLower: string, missingCritical: Array<any>): number {
    if (!missingCritical.length) return 0;
    let penalty = 0;
    for (const item of missingCritical.slice(0, 6)) {
      const field = String(item?.field || '').toLowerCase();
      const why = String(item?.why || '').toLowerCase();
      const joined = `${field} ${why}`;
      const tokens = joined.split(/[^a-z0-9]+/).filter((t) => t.length >= 4);
      if (tokens.some((t) => hypothesisLower.includes(t))) {
        penalty += 0.04;
      }
    }
    return Math.min(0.16, penalty);
  }

  private computeRelevanceScore(
    ticketDomains: Set<string>,
    hypothesisDomains: Set<string>,
    hypothesisLower: string
  ): number {
    if (ticketDomains.size === 0) return hypothesisDomains.size > 0 ? 0.6 : 0.55;
    if (hypothesisDomains.size === 0) return 0.55;

    if (
      ticketDomains.has('email') &&
      !ticketDomains.has('network') &&
      (hypothesisDomains.has('network') || hypothesisDomains.has('firewall')) &&
      !/(rename|change|update).{0,20}\b(email|mailbox|alias)\b|\b(email|mailbox|alias)\b.{0,20}(rename|change|update)/.test(hypothesisLower)
    ) {
      return 0.28;
    }

    const overlap = [...hypothesisDomains].filter((d) => ticketDomains.has(d));
    if (overlap.length > 0) {
      return Math.min(0.95, 0.72 + 0.08 * overlap.length);
    }

    // Explicit cross-domain penalties for common overreach patterns.
    if (ticketDomains.has('email') && (hypothesisDomains.has('network') || hypothesisDomains.has('firewall'))) {
      return 0.24;
    }
    if (ticketDomains.has('network') && hypothesisDomains.has('security') && !/(edr|xdr|defender|malware|phish)/.test(hypothesisLower)) {
      return 0.28;
    }
    if (ticketDomains.has('onboarding') && hypothesisDomains.has('network') && !/(vpn|wifi|internet|network)/.test(hypothesisLower)) {
      return 0.34;
    }
    return 0.42;
  }

  private detectDomains(text: string): Set<string> {
    const t = String(text || '').toLowerCase();
    const out = new Set<string>();
    if (!t) return out;
    if (/(wifi|wireless|dhcp|dns|gateway|latency|packet loss|apipa|internet|wan|wlan|switch|router|wap|access point|network|vpn)/.test(t)) {
      out.add('network');
    }
    if (/(account|mfa|password|login|sign in|signin|identity|user profile|authentication|auth|azure ad|entra|ad )/.test(t)) {
      out.add('identity');
    }
    if (/(email|mailbox|outlook|exchange|smtp|imap|email address|rename email|signature)/.test(t)) {
      out.add('email');
    }
    if (/(new employee|new hire|onboarding|provision|access request|employee setup|user creation)/.test(t)) {
      out.add('onboarding');
    }
    if (/(printer|print|scanner|usb|monitor|dock|laptop|desktop|hardware|driver)/.test(t)) {
      out.add('hardware');
    }
    if (/(malware|phishing|ransomware|edr|xdr|defender|incident|compromis|exfiltration)/.test(t)) {
      out.add('security');
    }
    if (/(firewall|fortigate|sonicwall|palo alto|watchguard)/.test(t)) {
      out.add('firewall');
      out.add('network');
    }
    return out;
  }

  private clamp01(value: number, min = 0, max = 1): number {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
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
