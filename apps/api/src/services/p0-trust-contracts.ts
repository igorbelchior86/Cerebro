import type {
  AiDecisionTypeP0,
  CP0ActorRef,
  CP0AiDecisionRecord,
  CP0AuditRecord,
  CP0CorrelationIds,
  HitlStatusP0,
  ProvenanceRef,
  RecommendedAction,
} from '@cerebro/types';

export type TrustCorrelationRefs = Partial<CP0CorrelationIds>;
export type TrustAuditRecord = CP0AuditRecord;
export type TrustActorRef = CP0ActorRef;
export type TrustAIDecisionType = AiDecisionTypeP0;
export type TrustHitlStatus = HitlStatusP0;

export interface TrustAIDecisionSuggestion extends Record<string, unknown> {
  suggestion_only: boolean;
  summary: string;
  top_hypothesis?: string;
  recommended_actions: RecommendedAction[];
  do_not_do: string[];
  handoff_notes?: string[];
}

export type TrustPolicyGate = {
  outcome: 'pass' | 'hitl_required';
  reasons: string[];
};

export type TrustAIDecisionRecord = Omit<CP0AiDecisionRecord, 'suggestion' | 'signals_used' | 'decision_type'> & {
  decision_type: TrustAIDecisionType;
  suggestion: TrustAIDecisionSuggestion;
  signals_used: CP0AiDecisionRecord['signals_used'];
  provenance_refs: ProvenanceRef[];
  policy_gate: TrustPolicyGate;
};
