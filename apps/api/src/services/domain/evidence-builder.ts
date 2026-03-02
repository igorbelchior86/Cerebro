import type { EvidencePack } from '@cerebro/types';

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

        const intake: any = {};
        if (details.intakeContext.organization_hint !== undefined) intake.organization_hint = details.intakeContext.organization_hint;
        if (details.intakeContext.device_hints !== undefined) intake.device_hints = details.intakeContext.device_hints;
        if (details.intakeContext.symptoms !== undefined) intake.symptoms = details.intakeContext.symptoms;
        if (details.intakeContext.technology_facets !== undefined) intake.technology_facets = details.intakeContext.technology_facets;
        this.pack.intake_context = intake;

        return this;
    }

    setTicket(ticket: any, ssot: any) {
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

    setOrg(resolvedOrgId: string | null, ssot: any, companyName: string, itglueOrgMatch: any, ninjaOrgMatch: any) {
        this.pack.org = {
            id: resolvedOrgId || 'unknown',
            name: ssot.company || companyName || itglueOrgMatch?.name || ninjaOrgMatch?.name || 'Organization',
        };
        return this;
    }

    setUser(entityResolution: any, ssot: any) {
        if (entityResolution?.resolved_actor) {
            this.pack.user = {
                name: entityResolution.resolved_actor.name,
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
        signals: any[];
        relatedCases: any[];
        externalStatus: any;
        docs: any[];
        sourceFindings: any[];
    }) {
        this.pack.signals = data.signals;
        this.pack.related_cases = data.relatedCases;
        this.pack.external_status = data.externalStatus;
        this.pack.docs = data.docs;
        this.pack.source_findings = data.sourceFindings;
        return this;
    }

    setEnrichmentData(data: {
        networkStack?: any;
        entityResolution: any;
        evidenceDigest: any;
        rejectedEvidence: any[];
        capabilityVerification: any;
        iterativeEnrichment: any;
        missingData: any[];
    }) {
        if (data.networkStack) this.pack.network_stack = data.networkStack;
        this.pack.entity_resolution = data.entityResolution;
        this.pack.evidence_digest = data.evidenceDigest;
        this.pack.rejected_evidence = data.rejectedEvidence;
        this.pack.capability_verification = data.capabilityVerification;
        this.pack.iterative_enrichment = data.iterativeEnrichment;
        if (data.missingData?.length > 0) {
            this.pack.missing_data = data.missingData;
        }
        return this;
    }

    setDeviceFromNinja(device: any, deviceDetails: any, capabilityVerification: any, normalizedLastSeen: string, resolveDeviceOsLabel: (d: any, dd: any) => string) {
        if (device) {
            this.pack.device = {
                ninja_device_id: device.id,
                hostname: device.hostname || device.systemName || String(device.id),
                os: resolveDeviceOsLabel(device, deviceDetails),
                last_seen: normalizedLastSeen || new Date().toISOString(),
                confidence: capabilityVerification?.device_match_strong ? 'high' as const : 'medium' as const,
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
