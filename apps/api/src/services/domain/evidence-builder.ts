import type { EvidencePack } from '@cerebro/types';

type IntakeContext = NonNullable<EvidencePack['intake_context']>;
type JsonRecord = Record<string, unknown>;
type DeviceRecord = NonNullable<EvidencePack['device']>;
type DeviceConfidence = DeviceRecord['confidence'];

type TicketLike = {
    ticketNumber?: string;
    id?: string | number;
    title?: string;
    description?: string;
    createDate?: string;
    priority?: number;
    queueName?: string;
};

type TicketSsotLike = {
    ticket_id?: string;
    title?: string;
    description_clean?: string;
    created_at?: string;
    requester_name?: string;
    requester_email?: string;
    company?: string;
};

type OrgMatchLike = { name?: string };

type EntityResolutionLike = {
    resolved_actor?: {
        name?: string;
        email?: string;
    };
};

type DeviceLike = JsonRecord & {
    id?: string | number;
    hostname?: string;
    systemName?: string;
};

type CapabilityVerificationLike = {
    device_match_strong?: boolean;
};

export class EvidenceBuilder {
    private pack: Partial<EvidencePack> = {};

    constructor(sessionId: string) {
        this.pack.session_id = sessionId;
        this.pack.prepared_at = new Date().toISOString();
        this.pack.evidence_rules = {
            require_evidence_for_claims: true,
            no_destructive_steps_without_gating: true,
        };
    }

    setCoreDetails(details: {
        tenantId: string | null;
        sourceWorkspace: string;
        intakeContext: {
            organization_hint?: string | undefined;
            device_hints?: string[] | undefined;
            symptoms?: string[] | undefined;
            technology_facets?: string[] | undefined;
        };
    }) {
        this.pack.tenant_id = details.tenantId;
        this.pack.source_workspace = details.sourceWorkspace;

        const intake: IntakeContext = {};
        if (details.intakeContext.organization_hint !== undefined) intake.organization_hint = details.intakeContext.organization_hint;
        if (details.intakeContext.device_hints !== undefined) intake.device_hints = details.intakeContext.device_hints;
        if (details.intakeContext.symptoms !== undefined) intake.symptoms = details.intakeContext.symptoms;
        if (details.intakeContext.technology_facets !== undefined) intake.technology_facets = details.intakeContext.technology_facets;
        this.pack.intake_context = intake;

        return this;
    }

    setTicket(ticket: TicketLike, ssot: TicketSsotLike) {
        this.pack.ticket = {
            id: ssot.ticket_id || ticket.ticketNumber || String(ticket.id),
            title: ssot.title || ticket.title || '',
            description: ssot.description_clean || ticket.description || '',
            created_at: ssot.created_at || ticket.createDate || new Date().toISOString(),
            priority: this.mapAutotaskPriority(ticket.priority),
            queue: ticket.queueName || 'Unknown',
            category: 'Support',
        };
        return this;
    }

    setOrg(
        resolvedOrgId: string | null,
        ssot: TicketSsotLike,
        companyName: string,
        itglueOrgMatch: OrgMatchLike | null,
        ninjaOrgMatch: OrgMatchLike | null
    ) {
        this.pack.org = {
            id: resolvedOrgId || 'unknown',
            name: ssot.company || companyName || itglueOrgMatch?.name || ninjaOrgMatch?.name || 'Organization',
        };
        return this;
    }

    setUser(entityResolution: EntityResolutionLike | null, ssot: TicketSsotLike) {
        if (entityResolution?.resolved_actor) {
            this.pack.user = {
                name: entityResolution.resolved_actor.name || 'Unknown user',
                email: entityResolution.resolved_actor.email || '',
            };
        } else {
            this.pack.user = {
                name: ssot.requester_name || 'Unknown user',
                email: ssot.requester_email || '',
            };
        }
        return this;
    }

    setContextArrays(data: {
        signals: EvidencePack['signals'];
        relatedCases: EvidencePack['related_cases'];
        externalStatus: EvidencePack['external_status'];
        docs: EvidencePack['docs'];
        sourceFindings: EvidencePack['source_findings'];
    }) {
        this.pack.signals = data.signals;
        this.pack.related_cases = data.relatedCases;
        this.pack.external_status = data.externalStatus;
        this.pack.docs = data.docs;
        if (data.sourceFindings !== undefined) {
            this.pack.source_findings = data.sourceFindings;
        }
        return this;
    }

    setEnrichmentData(data: {
        networkStack?: EvidencePack['network_stack'];
        entityResolution: EvidencePack['entity_resolution'];
        evidenceDigest: EvidencePack['evidence_digest'];
        rejectedEvidence: EvidencePack['rejected_evidence'];
        capabilityVerification: EvidencePack['capability_verification'];
        iterativeEnrichment: EvidencePack['iterative_enrichment'];
        missingData: EvidencePack['missing_data'];
    }) {
        if (data.networkStack) this.pack.network_stack = data.networkStack;
        if (data.entityResolution !== undefined) this.pack.entity_resolution = data.entityResolution;
        if (data.evidenceDigest !== undefined) this.pack.evidence_digest = data.evidenceDigest;
        if (data.rejectedEvidence !== undefined) this.pack.rejected_evidence = data.rejectedEvidence;
        if (data.capabilityVerification !== undefined) this.pack.capability_verification = data.capabilityVerification;
        if (data.iterativeEnrichment !== undefined) this.pack.iterative_enrichment = data.iterativeEnrichment;
        if (data.missingData && data.missingData.length > 0) {
            this.pack.missing_data = data.missingData;
        }
        return this;
    }

    setDeviceFromNinja(
        device: DeviceLike | null,
        deviceDetails: JsonRecord | null,
        capabilityVerification: CapabilityVerificationLike | null,
        normalizedLastSeen: string,
        resolveDeviceOsLabel: (device: DeviceLike, details: JsonRecord) => string
    ) {
        if (device) {
            const confidence: DeviceConfidence = capabilityVerification?.device_match_strong ? 'high' : 'medium';
            this.pack.device = {
                ninja_device_id: String(device.id || ''),
                hostname: device.hostname || device.systemName || String(device.id || 'unknown-device'),
                os: resolveDeviceOsLabel(device, deviceDetails ?? {}),
                last_seen: normalizedLastSeen || new Date().toISOString(),
                confidence,
            };
        }
        return this;
    }

    build(): EvidencePack {
        if (!this.pack.ticket || !this.pack.session_id) {
            throw new Error(`[EvidenceBuilder] Incomplete pack. Missing ticket or session_id`);
        }
        return this.pack as EvidencePack;
    }

    private mapAutotaskPriority(priority: number | undefined): 'Critical' | 'High' | 'Medium' | 'Low' {
        if (!priority) return 'Medium';
        if (priority === 1) return 'Critical';
        if (priority <= 2) return 'High';
        if (priority <= 3) return 'Medium';
        return 'Low';
    }
}
