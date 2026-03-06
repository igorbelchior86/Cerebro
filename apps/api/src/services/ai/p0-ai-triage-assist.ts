import { v4 as uuidv4 } from 'uuid';
import type {
  AIAssistDrafts,
  DiagnosisOutput,
  CP0AiDecisionRecord,
  EvidencePack,
  ProvenanceRef,
  ValidationOutput,
} from '@cerebro/types';
import type { InMemoryP0TrustStore } from '../domain/p0-trust-store.js';
import type {
  TrustAIDecisionRecord,
  TrustAuditRecord,
  TrustCorrelationRefs,
} from '../domain/p0-trust-contracts.js';

export interface P0AiTriagePolicyConfig {
  hitlConfidenceThreshold: number;
  hitlOnPriorities: string[];
}

export interface BuildAIDecisionInput {
  tenantId: string;
  ticketId: string;
  pack: EvidencePack;
  diagnosis: DiagnosisOutput;
  validation?: ValidationOutput;
  correlation?: TrustCorrelationRefs;
  promptVersion: string;
  modelVersion: string;
  actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string };
}

export interface BuildAIDecisionOutput {
  decision: TrustAIDecisionRecord;
  drafts: AIAssistDrafts;
}

export class P0AiTriageAssistService {
  private readonly config: P0AiTriagePolicyConfig;
  private readonly store: InMemoryP0TrustStore | undefined;

  constructor(input?: { config?: Partial<P0AiTriagePolicyConfig>; store?: InMemoryP0TrustStore }) {
    this.config = {
      hitlConfidenceThreshold: input?.config?.hitlConfidenceThreshold ?? 0.7,
      hitlOnPriorities: input?.config?.hitlOnPriorities ?? ['Critical', 'High'],
    };
    this.store = input?.store;
  }

  buildSuggestionDecision(input: BuildAIDecisionInput): BuildAIDecisionOutput {
    const now = new Date().toISOString();
    const top = (input.diagnosis.top_hypotheses || [])[0];
    const confidenceRaw = Number(top?.calibrated_confidence ?? top?.confidence ?? 0);
    const confidence = Number(Math.max(0, Math.min(1, confidenceRaw)).toFixed(3));

    const policyReasons: string[] = [];
    const priority = String(input.pack.ticket?.priority || '');
    if (this.config.hitlOnPriorities.includes(priority)) {
      policyReasons.push(`priority_${priority.toLowerCase()}`);
    }
    if (confidence < this.config.hitlConfidenceThreshold) {
      policyReasons.push(`confidence_below_${this.config.hitlConfidenceThreshold}`);
    }
    if (input.validation?.status && input.validation.status !== 'approved') {
      policyReasons.push(`validation_${input.validation.status}`);
    }
    if ((input.diagnosis.recommended_actions || []).some((a) => a.risk === 'high')) {
      policyReasons.push('high_risk_action_present');
    }

    const hitlRequired = policyReasons.length > 0;
    const correlation = this.normalizeCorrelation(input.correlation, input.ticketId);
    const provenanceRefs = this.buildProvenanceRefs(input.pack, {
      promptVersion: input.promptVersion,
      modelVersion: input.modelVersion,
    }, now);

    const suggestionSummary =
      input.diagnosis.summary ||
      (top?.hypothesis ? `Suggested triage direction: ${top.hypothesis}` : 'AI triage suggestion generated');
    const rationaleLines = [
      top?.hypothesis ? `Top hypothesis: ${top.hypothesis}` : 'Top hypothesis unavailable',
      `Confidence: ${confidence.toFixed(2)}`,
      ...(top?.confidence_explanation || []),
      ...(input.validation?.blocking_reasons || []).map((r) => `Policy blocking reason: ${r}`),
      `Sources consulted: ${this.collectSignalsUsed(input.pack).length}`,
    ];

    const decision: TrustAIDecisionRecord = {
      decision_id: uuidv4(),
      tenant_id: input.tenantId,
      ticket_id: input.ticketId,
      decision_type: 'triage',
      suggestion: {
        suggestion_only: true,
        summary: suggestionSummary,
        ...(top?.hypothesis ? { top_hypothesis: top.hypothesis } : {}),
        recommended_actions: input.diagnosis.recommended_actions || [],
        do_not_do: input.diagnosis.do_not_do || [],
        handoff_notes: this.buildHandoffNotes(input.pack, input.validation),
      },
      confidence,
      rationale: rationaleLines.join(' | '),
      signals_used: this.collectSignalsUsed(input.pack),
      provenance_refs: provenanceRefs,
      hitl_status: hitlRequired ? 'pending' : 'not_required',
      prompt_version: input.promptVersion,
      model_version: input.modelVersion,
      timestamp: now,
      correlation,
      policy_gate: {
        outcome: hitlRequired ? 'hitl_required' : 'pass',
        reasons: policyReasons,
      },
    };

    const drafts = this.buildDrafts(input.pack, input.diagnosis, input.validation, decision);
    this.store?.recordAIDecision(decision);
    this.store?.recordAudit(this.buildAuditRecord({
      tenantId: input.tenantId,
      ...(input.actor ? { actor: input.actor } : {}),
      now,
      decision,
    }));

    return { decision, drafts };
  }

  private buildHandoffNotes(pack: EvidencePack, validation?: ValidationOutput): string[] {
    const notes: string[] = [];
    if (validation?.status && validation.status !== 'approved') {
      notes.push(`HITL review required (${validation.status})`);
    }
    if (pack.org?.name) notes.push(`Org: ${pack.org.name}`);
    if (pack.ticket?.queue) notes.push(`Queue: ${pack.ticket.queue}`);
    if (Array.isArray(pack.missing_data) && pack.missing_data.length > 0) {
      notes.push(`Missing data: ${pack.missing_data.slice(0, 2).map((m) => m.field).join(', ')}`);
    }
    return notes;
  }

  private buildDrafts(
    pack: EvidencePack,
    diagnosis: DiagnosisOutput,
    validation: ValidationOutput | undefined,
    decision: TrustAIDecisionRecord,
  ): AIAssistDrafts {
    const top = diagnosis.top_hypotheses?.[0];
    const summaryMd = [
      `# AI Triage Summary (Suggestion-First)`,
      `- Ticket: ${pack.ticket.id}`,
      `- Queue: ${pack.ticket.queue}`,
      `- Priority: ${pack.ticket.priority}`,
      `- Decision confidence: ${(decision.confidence * 100).toFixed(0)}%`,
      `- HITL: ${decision.hitl_status}`,
      top ? `- Top hypothesis: ${top.hypothesis}` : '- Top hypothesis: n/a',
      '',
      `## Rationale`,
      decision.rationale,
      '',
      `## Suggested actions`,
      ...(diagnosis.recommended_actions || []).map((a) => `- [${a.risk}] ${a.action}`),
      '',
      `## Do not do`,
      ...((diagnosis.do_not_do || []).length ? diagnosis.do_not_do : ['- none']).map((x) => x.startsWith('-') ? x : `- ${x}`),
      '',
      `## Provenance`,
      ...decision.provenance_refs.map((p) => `- ${p.source} @ ${p.fetched_at}${p.adapter_version ? ` (adapter=${p.adapter_version})` : ''}`),
    ].join('\n');

    const handoffMd = [
      `# AI Handoff Draft`,
      `Ticket ${pack.ticket.id} (${pack.ticket.title})`,
      '',
      `## Suggested next step`,
      decision.suggestion.summary,
      '',
      `## Operator validation checklist`,
      `- Confirm hypothesis against live evidence`,
      `- Confirm tenant/org scope before any action`,
      `- Confirm SLA impact and priority handling`,
      ...(validation?.required_questions || []).slice(0, 5).map((q) => `- ${q}`),
      '',
      `## Evidence references`,
      ...decision.signals_used.slice(0, 10).map((s) => `- ${s.source}:${s.ref}`),
    ].join('\n');

    return { summary_md: summaryMd, handoff_md: handoffMd };
  }

  private collectSignalsUsed(pack: EvidencePack): CP0AiDecisionRecord['signals_used'] {
    const refs = new Map<string, { source: string; ref: string }>();
    for (const s of pack.signals || []) {
      refs.set(`signal:${s.source}:${s.id}`, { source: String(s.source || 'signal'), ref: `signal:${s.id}` });
    }
    for (const d of pack.docs || []) {
      refs.set(`doc:${d.source}:${d.id}`, { source: String(d.source || 'doc'), ref: `doc:${d.id}` });
    }
    for (const f of pack.source_findings || []) {
      const facet = String(f.facet || 'general');
      const match = f.matched ? 'matched' : 'miss';
      refs.set(`source_finding:${f.source}:${facet}:${match}`, {
        source: String(f.source || 'source_finding'),
        ref: `source_finding:${facet}:${match}`,
      });
    }
    return Array.from(refs.values()).slice(0, 50);
  }

  private buildProvenanceRefs(
    pack: EvidencePack,
    model: { promptVersion: string; modelVersion: string },
    now: string,
  ): ProvenanceRef[] {
    const refs: ProvenanceRef[] = [
      {
        source: 'ai_model',
        fetched_at: now,
        prompt_version: model.promptVersion,
        model_version: model.modelVersion,
      },
    ];
    const findingsBySource = new Map<string, number>();
    for (const finding of pack.source_findings || []) {
      const key = String(finding.source || 'unknown');
      findingsBySource.set(key, (findingsBySource.get(key) || 0) + 1);
    }
    for (const [source, count] of findingsBySource.entries()) {
      refs.push({
        source,
        fetched_at: pack.prepared_at || now,
        meta: { source_findings_count: count },
      });
    }
    return refs;
  }

  private buildAuditRecord(input: {
    tenantId: string;
    actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string };
    now: string;
    decision: TrustAIDecisionRecord;
  }): TrustAuditRecord {
    return {
      audit_id: uuidv4(),
      tenant_id: input.tenantId,
      actor: this.normalizeActor(input.actor),
      action: 'ai.decision.create',
      target: {
        type: 'ai_decision_record',
        id: input.decision.decision_id,
      },
      result: 'success',
      timestamp: input.now,
      correlation: input.decision.correlation,
      metadata: {
        ticket_id: input.decision.ticket_id,
        decision_type: input.decision.decision_type,
        hitl_status: input.decision.hitl_status,
        confidence: input.decision.confidence,
        prompt_version: input.decision.prompt_version,
        model_version: input.decision.model_version,
      },
    };
  }

  private normalizeActor(actor?: { type: 'user' | 'system' | 'ai'; id?: string; name?: string }) {
    const type = actor?.type || 'ai';
    return {
      type,
      id: String(actor?.id || 'p0-ai-triage-assist'),
      origin: type === 'user' ? 'api' : (type === 'system' ? 'scheduler' : 'ai'),
      ...(actor?.name ? { role: actor.name } : {}),
    } as const;
  }

  private normalizeCorrelation(correlation: TrustCorrelationRefs | undefined, ticketId: string) {
    return {
      trace_id: String(correlation?.trace_id || uuidv4()),
      ...(correlation?.request_id ? { request_id: String(correlation.request_id) } : {}),
      ...(correlation?.job_id ? { job_id: String(correlation.job_id) } : {}),
      ...(correlation?.command_id ? { command_id: String(correlation.command_id) } : {}),
      ticket_id: ticketId,
    };
  }
}
