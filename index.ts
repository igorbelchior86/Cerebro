// ─────────────────────────────────────────────────────────────
// SHARED TYPES — playbook-brain
// Importar como: import type { EvidencePack } from '@playbook-brain/types'
// ─────────────────────────────────────────────────────────────

// ─── Evidence Pack ────────────────────────────────────────────

export interface Signal {
  id: string;
  source: 'ninja' | 'autotask' | 'external';
  timestamp: string;
  type: string;
  summary: string;
  raw_ref?: Record<string, unknown>;
}

export interface RelatedCase {
  ticket_id: string;
  symptom: string;
  resolution: string;
  resolved_at: string;
}

export interface ExternalStatus {
  provider: string;
  region: string;
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  updated_at: string;
  source_ref: string;
}

export interface Doc {
  id: string;
  source: 'itglue' | 'autotask_note' | 'manual';
  title: string;
  snippet: string;
  relevance: number;
  raw_ref?: Record<string, unknown>;
}

export interface DeviceConnection {
  type: 'wifi' | 'ethernet' | 'vpn' | 'unknown';
  ip?: string;
  gateway?: string;
  dns?: string[];
}

export interface NetworkStack {
  isp?: string;
  firewall?: { vendor: string; model: string; firmware?: string };
  switches?: { vendor: string; model: string }[];
  aps?: { vendor: string; model: string }[];
}

export interface EvidenceRules {
  require_evidence_for_claims: boolean;
  no_destructive_steps_without_gating: boolean;
}

export interface EvidencePack {
  session_id: string;
  ticket: {
    id: string;
    title: string;
    description: string;
    created_at: string;
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    queue: string;
    category: string;
  };
  org: {
    id: string;
    name: string;
    sla?: string;
    timezone?: string;
  };
  site?: {
    name: string;
    address?: string;
  };
  user?: {
    name: string;
    email: string;
  };
  device?: {
    ninja_device_id: string;
    hostname: string;
    os: string;
    last_seen: string;
    connection?: DeviceConnection;
    confidence?: 'high' | 'medium' | 'none';
  };
  network_stack?: NetworkStack;
  signals: Signal[];
  related_cases: RelatedCase[];
  external_status: ExternalStatus[];
  docs: Doc[];
  evidence_rules: EvidenceRules;
  missing_data?: { field: string; why: string }[];
  prepared_at: string;
}

// ─── Diagnosis Output ─────────────────────────────────────────

export interface Hypothesis {
  rank: number;
  hypothesis: string;
  confidence: number;
  evidence: string[];
  tests: string[];
  next_questions?: string[];
}

export interface RecommendedAction {
  action: string;
  risk: 'low' | 'medium' | 'high';
}

export interface DiagnosisOutput {
  summary: string;
  top_hypotheses: Hypothesis[];
  missing_data: { field: string; why: string }[];
  recommended_actions: RecommendedAction[];
  do_not_do: string[];
  meta?: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    latency_ms: number;
  };
}

// ─── Validation Output ────────────────────────────────────────

export type ValidationStatus = 'approved' | 'needs_more_info' | 'blocked';

export interface Violation {
  type: 'no_evidence' | 'risk_gate' | 'coherence' | 'missing_checklist';
  detail: string;
}

export interface ValidationOutput {
  status: ValidationStatus;
  violations: Violation[];
  required_questions: string[];
  required_fixes: string[];
  safe_to_generate_playbook: boolean;
}

// ─── Playbook Output ──────────────────────────────────────────

export interface PlaybookOutput {
  content_md: string;
  meta?: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
    latency_ms: number;
  };
}

// ─── Triage Session ───────────────────────────────────────────

export type SessionStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'needs_more_info'
  | 'blocked'
  | 'failed';

export interface TriageSession {
  id: string;
  ticket_id: string;
  org_id?: string;
  org_name?: string;
  status: SessionStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ─── Triage Flow Result ───────────────────────────────────────

export interface TriageFlowResult {
  session: TriageSession;
  evidence_pack?: EvidencePack;
  diagnosis?: DiagnosisOutput;
  validation?: ValidationOutput;
  playbook?: PlaybookOutput;
  error?: string;
}
