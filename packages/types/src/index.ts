// ─────────────────────────────────────────────────────────────
// SHARED TYPES — playbook-brain
// Importar como: import type { EvidencePack } from '@playbook-brain/types'
// ─────────────────────────────────────────────────────────────

// ─── Evidence Pack ────────────────────────────────────────────

export interface Signal {
  id: string;
  source: 'ninja' | 'autotask' | 'external' | 'email';
  timestamp: string;
  type: string;
  summary: string;
  raw_ref?: Record<string, unknown>;
  tenant_id?: string | null;
  org_id?: string | null;
  source_workspace?: string;
}

export interface RelatedCase {
  ticket_id: string;
  symptom: string;
  resolution: string;
  resolved_at: string;
  tenant_id?: string | null;
  org_id?: string | null;
  source_workspace?: string;
}

export interface ExternalStatus {
  provider: string;
  region: string;
  status: 'operational' | 'degraded' | 'outage' | 'unknown';
  updated_at: string;
  source_ref: string;
  tenant_id?: string | null;
  org_id?: string | null;
  source_workspace?: string;
}

export interface Doc {
  id: string;
  source: 'itglue' | 'autotask_note' | 'manual' | 'external_web';
  title: string;
  snippet: string;
  relevance: number;
  raw_ref?: Record<string, unknown>;
  tenant_id?: string | null;
  org_id?: string | null;
  source_workspace?: string;
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

export interface SourceFinding {
  source: 'autotask' | 'ninjaone' | 'itglue' | 'external';
  round?: number;
  facet?: string;
  queried: boolean;
  matched: boolean;
  summary: string;
  details: string[];
  why_selected?: string[];
  why_rejected?: string[];
  tenant_id?: string | null;
  org_id?: string | null;
  source_workspace?: string;
}

export interface ArtifactScope {
  tenant_id: string | null;
  org_id: string | null;
  source_workspace: string;
}

export interface ActorCandidate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  score: number;
  score_breakdown: {
    exact_name: number;
    email: number;
    phone: number;
    company_normalized: number;
  };
}

export interface EntityResolution {
  extracted_entities: {
    person: string[];
    company: string[];
    phone: string[];
    email: string[];
    location: string[];
    product_or_domain: string[];
  };
  resolved_actor?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    confidence: 'strong' | 'medium';
  };
  actor_candidates?: ActorCandidate[];
  disambiguation_question?: string;
  status: 'resolved' | 'ambiguous' | 'unresolved';
}

export interface RejectedEvidence {
  id: string;
  source: string;
  reason: 'org_mismatch' | 'tenant_mismatch' | 'insufficient_support' | 'invalid_source_scope';
  summary: string;
  tenant_id: string | null;
  org_id: string | null;
  source_workspace: string;
  evidence_score: number;
}

export interface DigestFact {
  id: string;
  fact: string;
  evidence_score: number;
  evidence_refs: string[];
  source: string;
  tenant_id: string | null;
  org_id: string | null;
  source_workspace: string;
}

export interface DigestAction {
  action: string;
  evidence_refs: string[];
  rationale?: string;
}

export interface CapabilityVerification {
  required: boolean;
  device_match_strong: boolean;
  model_spec_confirmed: boolean;
  device_match_reason?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  dock_or_adapter?: string;
  spec_source_url?: string;
  compatibility_outcome?: 'supported' | 'supported_with_dock' | 'not_supported';
}

export interface EvidenceDigest {
  facts_confirmed: DigestFact[];
  facts_conflicted: DigestFact[];
  missing_critical: { field: string; why: string }[];
  candidate_actions: DigestAction[];
  tech_context_detected: string[];
  sources_consulted_by_facet: Record<string, string[]>;
  rejected_evidence: RejectedEvidence[];
  capability_verification?: CapabilityVerification;
}

export type EnrichmentFieldStatus = 'confirmed' | 'inferred' | 'unknown' | 'conflict';

export interface EnrichmentField<T = string | number | boolean | string[] | null> {
  value: T;
  status: EnrichmentFieldStatus;
  confidence: number;
  source_system: string;
  source_ref?: string;
  observed_at: string;
  round: number;
}

export interface TicketEnrichmentSection {
  ticket_id: EnrichmentField<string>;
  company: EnrichmentField<string>;
  requester_name: EnrichmentField<string>;
  requester_email: EnrichmentField<string>;
  affected_user_name: EnrichmentField<string>;
  affected_user_email: EnrichmentField<string>;
  created_at: EnrichmentField<string>;
  title: EnrichmentField<string>;
  description_clean: EnrichmentField<string>;
}

export interface IdentityEnrichmentSection {
  user_principal_name: EnrichmentField<string>;
  account_status: EnrichmentField<'enabled' | 'locked' | 'disabled' | 'unknown'>;
  mfa_state: EnrichmentField<'enrolled' | 'not_enrolled' | 'unknown'>;
  licenses_summary: EnrichmentField<string>;
  groups_top: EnrichmentField<string[] | 'unknown'>;
}

export interface SecurityAgentSummary {
  state: 'present' | 'absent' | 'unknown';
  name: string;
}

export interface EndpointEnrichmentSection {
  device_name: EnrichmentField<string>;
  device_type: EnrichmentField<'desktop' | 'laptop' | 'mobile' | 'unknown'>;
  os_name: EnrichmentField<string>;
  os_version: EnrichmentField<string>;
  last_check_in: EnrichmentField<string>;
  security_agent: EnrichmentField<SecurityAgentSummary>;
  user_signed_in: EnrichmentField<string>;
  user_signed_in_at: EnrichmentField<string>;
}

export interface NetworkEnrichmentSection {
  location_context: EnrichmentField<'office' | 'remote' | 'unknown'>;
  public_ip: EnrichmentField<string>;
  isp_name: EnrichmentField<string>;
  vpn_state: EnrichmentField<'connected' | 'disconnected' | 'unknown'>;
  phone_provider: EnrichmentField<'connected' | 'unknown'>;
  phone_provider_name: EnrichmentField<string>;
}

export interface InfraEnrichmentSection {
  firewall_make_model: EnrichmentField<string>;
  wifi_make_model: EnrichmentField<string>;
  switch_make_model: EnrichmentField<string>;
}

export interface IterativeEnrichmentSections {
  ticket: TicketEnrichmentSection;
  identity: IdentityEnrichmentSection;
  endpoint: EndpointEnrichmentSection;
  network: NetworkEnrichmentSection;
  infra: InfraEnrichmentSection;
}

export interface EnrichmentRoundSummary {
  round: number;
  label: string;
  sources_consulted: string[];
  new_fields_confirmed: string[];
  new_fields_inferred: string[];
  new_fields_unknown: string[];
  gain_count: number;
}

export interface EnrichmentCoverageSummary {
  total: number;
  confirmed: number;
  inferred: number;
  unknown: number;
  conflict: number;
  completion_ratio: number;
}

export interface IterativeEnrichmentProfile {
  schema_version: '1.0.0';
  completed_rounds: number;
  stop_reason:
  | 'max_rounds_reached'
  | 'marginal_gain'
  | 'coverage_target_reached'
  | 'source_exhausted';
  rounds: EnrichmentRoundSummary[];
  sections: IterativeEnrichmentSections;
  coverage: EnrichmentCoverageSummary;
}

export interface IntakeContext {
  organization_hint?: string;
  device_hints?: string[];
  symptoms?: string[];
  technology_facets?: string[];
}

export interface EvidencePack {
  session_id: string;
  tenant_id?: string | null;
  source_workspace?: string;
  intake_context?: IntakeContext;
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
  source_findings?: SourceFinding[];
  entity_resolution?: EntityResolution;
  evidence_digest?: EvidenceDigest;
  rejected_evidence?: RejectedEvidence[];
  capability_verification?: CapabilityVerification;
  iterative_enrichment?: IterativeEnrichmentProfile;
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
  llm_confidence?: number;
  calibrated_confidence?: number;
  support_score?: number;
  relevance_score?: number;
  grounding_status?: 'grounded' | 'partial' | 'weak' | 'unsupported';
  confidence_explanation?: string[];
  playbook_anchor_eligible?: boolean;
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
  type:
  | 'no_evidence'
  | 'risk_gate'
  | 'coherence'
  | 'missing_checklist'
  | 'quality_gate'
  | 'coverage_gate';
  detail: string;
}

export interface QualityGateScores {
  entity_coverage: number;
  tech_coverage: number;
  signal_coverage: number;
  asset_coverage: number;
}

export interface QualityGateFlags {
  cross_tenant_candidate_detected: boolean;
  named_entity_unresolved: boolean;
  domain_required_source_missing: boolean;
  capability_verification_incomplete: boolean;
  mandatory_ticket_fields_missing: boolean;
}

export interface ValidationOutput {
  status: ValidationStatus;
  violations: Violation[];
  required_questions: string[];
  required_fixes: string[];
  safe_to_generate_playbook: boolean;
  quality_gates?: QualityGateFlags;
  coverage_scores?: QualityGateScores;
  blocking_reasons?: string[];
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

// ─── Connector Types ──────────────────────────────────────────

export interface AutotaskTicket {
  id: number;
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  queueID: number;
  createDate: string;
  userDefinedFields?: Record<string, unknown>;
  resources?: Array<{ id: number; name: string }>;
}

export interface AutotaskDevice {
  id: number;
  hostName: string;
  osType: string;
  osEdition: string;
  osVersionStatus: string;
  lastSeen: string;
  serialNumber: string;
}

export interface NinjaOneDevice {
  id: string;
  hostname?: string;
  systemName?: string;
  osName?: string;
  osVersion?: string;
  lastActivityTime?: string;
  lastContact?: string;
  ipAddress?: string;
  organizationId?: number;
  online?: boolean;
  [key: string]: unknown;
}

export interface ITGlueDocument {
  id: string;
  name: string;
  body: string;
  documentType: string;
  createdAt: string;
  updatedAt: string;
}
