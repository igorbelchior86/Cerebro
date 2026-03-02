import type {
    Signal,
    Doc,
    SecurityAgentSummary,
    EvidencePack,
    IterativeEnrichmentSections,
    EnrichmentField,
    SourceFinding,
    IterativeEnrichmentProfile,
    EntityResolution
} from '@cerebro/types';

export {
    IterativeEnrichmentSections,
    EnrichmentField,
    SourceFinding,
    IterativeEnrichmentProfile,
    Signal,
    Doc,
    EvidencePack,
    SecurityAgentSummary,
    EntityResolution
};

export interface PrepareContextInput {
    sessionId: string;
    ticketId: string;
    orgId?: string;
    organizationIds?: {
        autotask?: string;
        ninjaone?: string;
        itglue?: string;
    };
}

export type TicketLike = {
    id?: string | number;
    ticketNumber?: string;
    title?: string;
    description?: string;
    companyID?: string | number;
    contactID?: string | number;
    queueID?: string | number;
    assignedResourceID?: string | number | null;
    company?: string;
    requester?: string;
    rawBody?: string;
    updates?: Array<{ timestamp?: string; content?: string }>;
    createDate?: string;
    priority?: number;
    queueName?: string;
    canonicalRequesterName?: string;
    canonicalRequesterEmail?: string;
    canonicalAffectedName?: string;
    canonicalAffectedEmail?: string;
};

export interface TicketSSOT {
    ticket_id: string;
    autotask_authoritative?: {
        source: 'autotask';
        ticket_id_numeric?: number;
        ticket_number?: string;
        title?: string;
        description?: string;
        company_id?: number;
        company_name?: string;
        contact_id?: number;
        contact_name?: string;
        contact_email?: string;
        queue_id?: number;
        queue_name?: string;
        assigned_resource_id?: number;
        assigned_resource_name?: string;
        assigned_resource_email?: string;
    };
    company: string;
    requester_name: string;
    requester_email: string;
    affected_user_name: string;
    affected_user_email: string;
    created_at: string;
    title: string;
    description_clean: string;
    user_principal_name: string;
    account_status: string;
    mfa_state: string;
    licenses_summary: string;
    groups_top: string;
    device_name: string;
    device_type: string;
    os_name: string;
    os_version: string;
    last_check_in: string;
    security_agent: SecurityAgentSummary | { state: 'unknown'; name?: string };
    user_signed_in: string;
    location_context: string;
    public_ip: string;
    isp_name: string;
    vpn_state: string;
    phone_provider: string;
    phone_provider_name: string;
    firewall_make_model: string;
    wifi_make_model: string;
    switch_make_model: string;
    fusion_audit?: Record<string, unknown>;
}

export interface TicketTextArtifact {
    ticket_id: string;
    session_id: string;
    source: 'autotask' | 'email' | 'unknown';
    title_original: string;
    text_original: string;
    text_clean: string;
    text_clean_display_markdown?: string;
    text_clean_display_format?: 'plain' | 'markdown_llm';
    normalization_method: 'llm' | 'deterministic_fallback';
    normalization_confidence: number;
    created_at: string;
}

export interface TicketContextAppendix {
    ticket_id: string;
    session_id: string;
    created_at: string;
    history_correlation?: {
        mode: 'autotask_email_fallback';
        round: number;
        search_terms: string[];
        strategies: string[];
        matched_case_ids: string[];
        matched_case_count: number;
        blocked_reason?: 'missing_org_or_company_scope';
    };
    history_confidence_calibration?: {
        round: number;
        field_adjustments: Array<{
            path: string;
            action: 'boost' | 'decrease' | 'context_only';
            delta_confidence: number;
            previous_confidence: number;
            new_confidence: number;
            support_case_ids: string[];
            contradiction_case_ids?: string[];
            reason: string;
        }>;
        contradictions: Array<{
            path: string;
            current_value: string;
            observed_values: string[];
            case_ids: string[];
            note: string;
        }>;
    };
    fusion_summary?: {
        applied_resolution_count: number;
        link_count: number;
        inference_count: number;
        used_llm: boolean;
    };
    final_refinement?: {
        round: number;
        targets: string[];
        terms: string[];
        itglue_docs_added: number;
        ninja_device_reselected: boolean;
        ninja_signals_added: number;
        fields_updated: string[];
    };
}

export interface ScopeMeta {
    tenant_id: string | null;
    org_id: string | null;
    source_workspace: string;
}

export interface ITGlueWanCandidate {
    isp_name?: string;
    location_hint?: string;
    public_ip?: string;
    confidence: number;
    source_ref: string;
    source_system: 'itglue_asset' | 'itglue_config' | 'itglue_doc';
}

export interface ITGlueInfraCandidate {
    kind: 'firewall' | 'wifi' | 'switch';
    value: string;
    confidence: number;
    source_ref: string;
    source_system: 'itglue_password_metadata' | 'itglue_config' | 'itglue_doc';
}

export interface FacetContext {
    symptom: string[];
    technology: string[];
    entities: string[];
    requiresCapabilityVerification: boolean;
}

export interface DeviceResolutionResult {
    device: any | null;
    checks: Signal[];
    loggedInUser: string;
    loggedInAt?: string;
    reason: string;
    strongMatch: boolean;
    score: number;
    details?: any | null;
}

export interface AutotaskCreds {
    apiIntegrationCode: string;
    username: string;
    secret: string;
    zoneUrl?: string;
}

export interface NinjaOneCreds {
    clientId: string;
    clientSecret: string;
    region?: 'us' | 'eu' | 'oc';
}

export interface ITGlueCreds {
    apiKey: string;
    region?: 'us' | 'eu' | 'au';
}

export interface ItglueEnrichedField {
    value: string;
    confidence: number;
    source_system: string;
    evidence_refs: string[];
}

export interface ItglueEnrichedPayload {
    org_id: string;
    source_hash: string;
    fields: Record<string, ItglueEnrichedField>;
    created_at: string;
}

export interface NinjaEnrichedField {
    value: string;
    confidence: number;
    source_system: string;
    evidence_refs: string[];
}

export interface NinjaEnrichedPayload {
    org_id: string;
    source_hash: string;
    fields: Record<string, NinjaEnrichedField>;
    created_at: string;
}

export interface FusionLink {
    id: string;
    kind: 'identity_alias' | 'device_user' | 'ticket_software_device' | 'org_scope' | 'heuristic';
    from_entity: string;
    to_entity: string;
    confidence: number;
    evidence_refs: string[];
    note?: string;
}

export interface FusionInference {
    id: string;
    claim: string;
    type: 'identity_link' | 'device_assignment' | 'software_relevance' | 'field_assembly' | 'heuristic';
    confidence: number;
    evidence_chain: string[];
    assumptions?: string[];
    disconfirmers?: string[];
}

export interface FusionFieldCandidate {
    path: string;
    source: string;
    value: unknown;
    status: string;
    confidence: number;
    evidence_refs: string[];
}

export interface FusionFieldResolution {
    path: string;
    value: unknown;
    status: 'confirmed' | 'inferred' | 'unknown' | 'conflict';
    confidence: number;
    resolution_mode: 'direct' | 'assembled' | 'inferred' | 'fallback' | 'unknown';
    evidence_refs: string[];
    inference_refs?: string[];
    note?: string;
}

export interface FusionAdjudicationOutput {
    resolutions: FusionFieldResolution[];
    links?: FusionLink[];
    inferences?: FusionInference[];
    conflicts?: Array<{ field: string; note: string; evidence_refs?: string[] }>;
}

export interface HistoryCalibrationResult {
    sections: IterativeEnrichmentSections;
    appendix: NonNullable<TicketContextAppendix['history_confidence_calibration']>;
}
