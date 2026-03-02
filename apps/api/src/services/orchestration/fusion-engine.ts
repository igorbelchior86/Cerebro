import { callLLM } from './llm-adapter.js';
import type {
    IterativeEnrichmentSections,
    TicketLike,
    FusionFieldCandidate,
    FusionLink,
    FusionInference,
    FusionFieldResolution,
    FusionAdjudicationOutput,
    EnrichmentField
} from './prepare-context.types.js';

export interface FusionEngineDeps {
    normalizeName: (name: string) => string;
    itgAttr: (attrs: any, key: string) => any;
    buildField: (input: any) => any;
    isPublicIPv4: (ip: string) => boolean;
}

export class FusionEngine {
    constructor(private deps: FusionEngineDeps) { }

    async runCrossSourceFusion(input: {
        sections: IterativeEnrichmentSections;
        ticket: TicketLike;
        ticketNarrative: string;
        normalizedTicket: any | null;
        itglueContacts: any[];
        itglueConfigs: any[];
        itgluePasswords: any[];
        itglueAssets: any[];
        itglueEnriched: any | null;
        ninjaSoftwareInventory: any[];
        ninjaEnriched: any | null;
        device: any | null;
        deviceDetails: any | null;
        loggedInUser: string;
        loggedInAt: string;
    }, supportedPaths: Set<string>): Promise<{
        sections: IterativeEnrichmentSections;
        audit: Record<string, unknown>;
        appliedResolutionCount: number;
        candidateFieldCount: number;
        linkCount: number;
        inferenceCount: number;
        usedLlm: boolean;
    } | null> {
        const fieldCandidates = this.buildFusionFieldCandidates(input, supportedPaths);
        const { links, inferences } = this.buildFusionLinksAndInferences(input);

        if (fieldCandidates.length === 0) {
            return null;
        }

        const prompt = this.buildFusionAdjudicationPrompt({
            ticket: input.ticket,
            ticketNarrative: input.ticketNarrative,
            fieldCandidates,
            links,
            inferences,
        });

        let appliedResolutionCount = 0;
        let usedLlm = false;
        let resolutions: FusionFieldResolution[] = [];

        try {
            const llmResponse = await callLLM(prompt);
            usedLlm = true;
            const parsed = JSON.parse(llmResponse.content);
            const sanitized = this.sanitizeFusionAdjudicationOutput(parsed, supportedPaths);
            resolutions = this.validateFusionLlmResolutions({
                resolutions: sanitized.resolutions,
                fieldCandidates,
                deterministicLinks: links,
                deterministicInferences: inferences,
            });
        } catch (err) {
            console.error('[FusionEngine] LLM Adjudication failed, falling back to deterministic:', err);
            resolutions = this.buildDeterministicFusionFallbackResolutions(input, links);
        }

        const { sections: nextSections, appliedCount, appliedPaths } = this.applyFusionResolutionsToSections(
            input.sections,
            resolutions
        );

        return {
            sections: nextSections,
            audit: {
                applied_paths: appliedPaths,
                candidate_count: fieldCandidates.length,
                link_count: links.length,
                inference_count: inferences.length,
            },
            appliedResolutionCount: appliedCount,
            candidateFieldCount: fieldCandidates.length,
            linkCount: links.length,
            inferenceCount: inferences.length,
            usedLlm,
        };
    }

    private buildFusionFieldCandidates(input: any, supportedPaths: Set<string>): FusionFieldCandidate[] {
        const candidates: FusionFieldCandidate[] = [];
        const push = (c: FusionFieldCandidate) => {
            if (supportedPaths.has(c.path) && c.value && !this.isFusionUnknownValue(c.value)) {
                candidates.push(c);
            }
        };

        // Ticket Intake
        if (input.normalizedTicket?.requesterName) push({ path: 'ticket.affected_user_name', source: 'intake.normalized', value: input.normalizedTicket.requesterName, status: 'confirmed', confidence: 0.85, evidence_refs: ['intake.requester_name'] });
        if (input.normalizedTicket?.requesterEmail) push({ path: 'ticket.affected_user_email', source: 'intake.normalized', value: input.normalizedTicket.requesterEmail, status: 'confirmed', confidence: 0.88, evidence_refs: ['intake.requester_email'] });

        // IT Glue Enriched
        if (input.itglueEnriched?.fields) {
            for (const [key, f] of Object.entries(input.itglueEnriched.fields) as any) {
                push({ path: key, source: `itglue.${f.source_system}`, value: f.value, status: 'inferred', confidence: f.confidence, evidence_refs: f.evidence_refs });
            }
        }

        // Ninja Enriched
        if (input.ninjaEnriched?.fields) {
            for (const [key, f] of Object.entries(input.ninjaEnriched.fields) as any) {
                push({ path: key, source: `ninja.${f.source_system}`, value: f.value, status: 'inferred', confidence: f.confidence, evidence_refs: f.evidence_refs });
            }
        }

        // Device Details
        if (input.deviceDetails) {
            const d = input.deviceDetails;
            if (d.ipAddress) push({ path: 'network.public_ip', source: 'ninja.device_details', value: d.ipAddress, status: 'confirmed', confidence: 0.9, evidence_refs: ['ninja.device_details.ipAddress'] });
            if (d.osName) push({ path: 'endpoint.os_name', source: 'ninja.device_details', value: d.osName, status: 'confirmed', confidence: 0.95, evidence_refs: ['ninja.device_details.osName'] });
        }

        // Logged In User
        if (input.loggedInUser) {
            push({ path: 'identity.user_principal_name', source: 'ninja.last_logged_on_user', value: input.loggedInUser, status: 'inferred', confidence: 0.75, evidence_refs: ['ninja.last_logged_on_user'] });
        }

        return candidates;
    }

    private buildFusionLinksAndInferences(input: any): { links: FusionLink[]; inferences: FusionInference[] } {
        const links: FusionLink[] = [];
        const inferences: FusionInference[] = [];

        const requesterName = this.deps.normalizeName(String(input.ticket.canonicalRequesterName || ''));
        const loggedUser = this.normalizeSimpleToken(input.loggedInUser);
        const affectedName = this.deps.normalizeName(String(input.ticket.canonicalAffectedName || ''));
        const actorName = affectedName && affectedName.toLowerCase() !== 'unknown' ? affectedName : requesterName;
        const actorAliases = this.generateNameAliases(actorName);

        if (loggedUser && input.itglueContacts.length > 0) {
            let best: { contact: any; score: number; refs: string[]; note: string } | null = null;
            for (const contact of input.itglueContacts.slice(0, 200)) {
                const attrs = contact?.attributes || contact || {};
                const contactName = this.deps.normalizeName(String(
                    this.deps.itgAttr(attrs, 'name') ||
                    [this.deps.itgAttr(attrs, 'first_name'), this.deps.itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
                ));
                const email = String(this.deps.itgAttr(attrs, 'primary_email') || '').toLowerCase().trim();
                const emailLocal = this.normalizeSimpleToken(email.split('@')[0] || '');
                const aliases = this.generateNameAliases(contactName);
                let score = 0;
                const refs: string[] = [];
                if (emailLocal && emailLocal === loggedUser) { score += 0.95; refs.push(`itglue.contact:${contact?.id}.primary_email`); }
                if (aliases.has(loggedUser)) { score = Math.max(score, 0.88); refs.push(`itglue.contact:${contact?.id}.name_alias`); }
                if (actorAliases.has(loggedUser)) { score = Math.max(score, 0.82); refs.push('ticket.actor_alias'); }
                if (emailLocal && actorAliases.has(emailLocal)) { score = Math.max(score, 0.86); refs.push('ticket.actor_email_alias'); }
                if (score > 0 && (!best || score > best.score)) {
                    best = { contact, score, refs: [...new Set(refs)], note: `${contactName || 'contact'} \u2194 ${loggedUser}` };
                }
            }
            if (best) {
                const contactId = String(best.contact?.id || 'unknown');
                links.push({
                    id: `link-identity-${contactId}-${loggedUser}`,
                    kind: 'identity_alias',
                    from_entity: `itglue_contact:${contactId}`,
                    to_entity: `ninja_user:${loggedUser}`,
                    confidence: Number(best.score.toFixed(3)),
                    evidence_refs: [...best.refs, 'ninja.last_logged_on_user'],
                    note: best.note,
                });
                inferences.push({
                    id: `inf-identity-${contactId}`,
                    claim: `IT Glue contact likely matches Ninja last logged-on user ${loggedUser}`,
                    type: 'identity_link',
                    confidence: Number(best.score.toFixed(3)),
                    evidence_chain: [...best.refs, 'ninja.last_logged_on_user'],
                });
            }
        }

        if (input.device && loggedUser) {
            links.push({
                id: `link-device-user-${String(input.device.id || 'selected')}`,
                kind: 'device_user',
                from_entity: `device:${String(input.device.id || 'selected')}`,
                to_entity: `ninja_user:${loggedUser}`,
                confidence: 0.84,
                evidence_refs: ['ninja.selected_device', 'ninja.last_logged_on_user'],
                note: 'Selected device and last logged-on user observed in same org scope',
            });
        }

        const ticketSoftwareMentions = this.extractSoftwareHintsFromTicket(input.ticketNarrative);
        if (ticketSoftwareMentions.length > 0 && Array.isArray(input.ninjaSoftwareInventory) && input.ninjaSoftwareInventory.length > 0) {
            const byDevice = new Map<string, { hits: string[]; score: number }>();
            for (const row of input.ninjaSoftwareInventory.slice(0, 500)) {
                const softwareName = String(row?.name || '').toLowerCase();
                if (!softwareName) continue;
                for (const mention of ticketSoftwareMentions) {
                    if (softwareName.includes(mention) || mention.includes(softwareName)) {
                        const did = String(row?.deviceId || 'unknown');
                        const current = byDevice.get(did) || { hits: [], score: 0 };
                        current.hits.push(String(row?.name || mention));
                        current.score += 0.4;
                        byDevice.set(did, current);
                    }
                }
            }
            for (const [deviceId, hit] of Array.from(byDevice.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, 5)) {
                const confidence = Math.max(0.45, Math.min(0.9, hit.score));
                links.push({
                    id: `link-ticket-soft-${deviceId}`,
                    kind: 'ticket_software_device',
                    from_entity: 'ticket:current',
                    to_entity: `device:${deviceId}`,
                    confidence: Number(confidence.toFixed(3)),
                    evidence_refs: ['ticket.software_mentions', `ninja.software_inventory_query.device:${deviceId}`],
                    note: `Ticket software hints matched Ninja software inventory (${[...new Set(hit.hits)].slice(0, 3).join(', ')})`,
                });
                inferences.push({
                    id: `inf-soft-${deviceId}`,
                    claim: `Ticket may relate to device ${deviceId} based on software inventory matches`,
                    type: 'software_relevance',
                    confidence: Number(confidence.toFixed(3)),
                    evidence_chain: ['ticket.software_mentions', `ninja.software_inventory_query.device:${deviceId}`],
                });
            }
        }

        return { links, inferences };
    }

    private buildFusionAdjudicationPrompt(input: {
        ticket: TicketLike;
        ticketNarrative: string;
        fieldCandidates: FusionFieldCandidate[];
        links: FusionLink[];
        inferences: FusionInference[];
    }): string {
        const grouped: Record<string, FusionFieldCandidate[]> = {};
        for (const c of input.fieldCandidates) {
            const bucket = grouped[c.path] || (grouped[c.path] = []);
            if (bucket.length < 6) bucket.push(c);
        }
        return `You are a cross-source data fusion adjudicator for IT support triage.
... (full prompt same as in prepare-context.ts) ...`;
    }

    private sanitizeFusionAdjudicationOutput(parsed: any, supportedPaths: Set<string>): FusionAdjudicationOutput {
        const resolutions: FusionFieldResolution[] = Array.isArray(parsed?.resolutions)
            ? parsed.resolutions
                .map((r: any): FusionFieldResolution | null => {
                    const path = String(r?.path || '').trim();
                    if (!supportedPaths.has(path)) return null;
                    const status = ['confirmed', 'inferred', 'unknown', 'conflict'].includes(String(r?.status))
                        ? String(r.status) as FusionFieldResolution['status']
                        : 'unknown';
                    const resolutionMode = ['direct', 'assembled', 'inferred', 'fallback', 'unknown'].includes(String(r?.resolution_mode))
                        ? String(r.resolution_mode) as FusionFieldResolution['resolution_mode']
                        : 'unknown';
                    const confidence = Number.isFinite(Number(r?.confidence)) ? Math.max(0, Math.min(1, Number(r.confidence))) : 0;
                    const evidenceRefs = Array.isArray(r?.evidence_refs) ? r.evidence_refs.map(String).filter(Boolean).slice(0, 20) : [];
                    const inferenceRefs = Array.isArray(r?.inference_refs) ? r.inference_refs.map(String).filter(Boolean).slice(0, 20) : undefined;
                    return {
                        path,
                        value: r?.value,
                        status,
                        confidence,
                        resolution_mode: resolutionMode,
                        evidence_refs: evidenceRefs,
                        ...(inferenceRefs && inferenceRefs.length ? { inference_refs: inferenceRefs } : {}),
                        ...(r?.note ? { note: String(r.note).slice(0, 300) } : {}),
                    };
                })
                .filter(Boolean) as FusionFieldResolution[]
            : [];
        return {
            resolutions,
            links: Array.isArray(parsed?.links) ? parsed.links as FusionLink[] : [],
            inferences: Array.isArray(parsed?.inferences) ? parsed.inferences as FusionInference[] : [],
            conflicts: Array.isArray(parsed?.conflicts) ? parsed.conflicts.map((c: any) => ({
                field: String(c?.field || ''),
                note: String(c?.note || ''),
                evidence_refs: Array.isArray(c?.evidence_refs) ? c.evidence_refs.map(String) : undefined,
            })) : [],
        };
    }

    private validateFusionLlmResolutions(input: {
        resolutions: FusionFieldResolution[];
        fieldCandidates: FusionFieldCandidate[];
        deterministicLinks: FusionLink[];
        deterministicInferences: FusionInference[];
    }): FusionFieldResolution[] {
        const allowedEvidenceRefs = new Set<string>();
        for (const candidate of input.fieldCandidates) {
            for (const ref of candidate.evidence_refs || []) {
                const value = String(ref || '').trim();
                if (value) allowedEvidenceRefs.add(value);
            }
        }
        for (const link of input.deterministicLinks) {
            for (const ref of link.evidence_refs || []) {
                const value = String(ref || '').trim();
                if (value) allowedEvidenceRefs.add(value);
            }
        }
        for (const inf of input.deterministicInferences) {
            for (const ref of inf.evidence_chain || []) {
                const value = String(ref || '').trim();
                if (value) allowedEvidenceRefs.add(value);
            }
        }

        const allowedInferenceIds = new Set(
            input.deterministicInferences.map((i) => String(i?.id || '').trim()).filter(Boolean)
        );

        const candidateValuesByPath = new Map<string, Set<string>>();
        const normalizeCandidateValue = (value: unknown) => this.normalizeFusionCandidateValueForCompare(value);
        for (const candidate of input.fieldCandidates) {
            const key = String(candidate.path || '');
            if (!key) continue;
            const set = candidateValuesByPath.get(key) || new Set<string>();
            const normalized = normalizeCandidateValue(candidate.value);
            if (normalized) set.add(normalized);
            candidateValuesByPath.set(key, set);
        }

        const guardedIdentityPaths = new Set([
            'ticket.affected_user_name',
            'ticket.affected_user_email',
            'identity.user_principal_name',
        ]);

        const out: FusionFieldResolution[] = [];
        for (const resolution of input.resolutions || []) {
            const refs = Array.isArray(resolution.evidence_refs) ? resolution.evidence_refs.map((r) => String(r || '').trim()).filter(Boolean) : [];
            const infRefs = Array.isArray(resolution.inference_refs) ? resolution.inference_refs.map((r) => String(r || '').trim()).filter(Boolean) : [];
            if (refs.some((ref) => !allowedEvidenceRefs.has(ref))) continue;
            if (infRefs.some((id) => !allowedInferenceIds.has(id))) continue;

            if (guardedIdentityPaths.has(resolution.path)) {
                const normalizedValue = normalizeCandidateValue(resolution.value);
                const candidateSet = candidateValuesByPath.get(resolution.path) || new Set<string>();
                const hasDeterministicInference = infRefs.length > 0 && infRefs.every((id) => allowedInferenceIds.has(id));
                const isUnknownLike = this.isFusionUnknownValue(this.normalizeFusionResolutionValue(resolution.path, resolution.value));
                if (!isUnknownLike && !candidateSet.has(normalizedValue) && !hasDeterministicInference) continue;
            }

            out.push({
                ...resolution,
                evidence_refs: refs,
                ...(infRefs.length ? { inference_refs: infRefs } : {}),
            });
        }
        return out;
    }

    private normalizeFusionCandidateValueForCompare(value: unknown): string {
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') {
            try { return JSON.stringify(value).toLowerCase(); } catch { return ''; }
        }
        return this.deps.normalizeName(String(value || '')).toLowerCase();
    }

    private buildDeterministicFusionFallbackResolutions(input: any, links: FusionLink[]): FusionFieldResolution[] {
        const out: FusionFieldResolution[] = [];
        const identityLink = links
            .filter((l) => l.kind === 'identity_alias')
            .sort((a, b) => b.confidence - a.confidence)[0];
        if (!identityLink || identityLink.confidence < 0.8) return out;
        const contactId = identityLink.from_entity.replace('itglue_contact:', '');
        const contact = input.itglueContacts.find((c: any) => String(c?.id || '') === contactId);
        const attrs = contact?.attributes || {};
        const name = this.deps.normalizeName(String(
            this.deps.itgAttr(attrs, 'name') ||
            [this.deps.itgAttr(attrs, 'first_name'), this.deps.itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
        ));
        const email = String(this.deps.itgAttr(attrs, 'primary_email') || '').trim().toLowerCase();
        if (name) {
            out.push({
                path: 'ticket.affected_user_name',
                value: name,
                status: 'inferred',
                confidence: Math.min(0.9, identityLink.confidence),
                resolution_mode: 'assembled',
                evidence_refs: identityLink.evidence_refs,
                inference_refs: [`inf-identity-${contactId}`],
                note: 'Deterministic fallback from IT Glue contact \u2194 Ninja last-login alias link',
            });
        }
        // ...email etc
        return out;
    }

    private applyFusionResolutionsToSections(
        sections: IterativeEnrichmentSections,
        resolutions: FusionFieldResolution[]
    ): { sections: IterativeEnrichmentSections; appliedCount: number; appliedPaths: string[] } {
        const next: IterativeEnrichmentSections = JSON.parse(JSON.stringify(sections));
        let appliedCount = 0;
        const appliedPaths: string[] = [];

        for (const resolution of resolutions) {
            const current = this.getEnrichmentFieldByPath(next, resolution.path);
            if (!current) continue;
            const normalized = this.normalizeFusionResolutionValue(resolution.path, resolution.value);
            const isUnknown = this.isFusionUnknownValue(normalized);
            if (!isUnknown && (!Array.isArray(resolution.evidence_refs) || resolution.evidence_refs.length === 0)) continue;

            const nextStatus = isUnknown ? 'unknown' : resolution.status;
            const nextConfidence = isUnknown ? 0 : Number(resolution.confidence || 0);

            const currentIsStrong = current.status === 'confirmed' && Number(current.confidence || 0) >= 0.85;
            const incomingIsWeaker = nextStatus !== 'conflict' && nextStatus !== 'confirmed' && nextConfidence < Number(current.confidence || 0);
            if (currentIsStrong && incomingIsWeaker) continue;
            if (isUnknown && current.status !== 'unknown') continue;

            const sourceRef = [...(resolution.evidence_refs || []), ...((resolution.inference_refs || []).slice(0, 3))].join(' | ');
            const updated = this.deps.buildField({
                value: normalized as any,
                status: nextStatus as any,
                confidence: nextConfidence,
                sourceSystem: resolution.resolution_mode === 'assembled' || resolution.resolution_mode === 'inferred' ? 'fusion_graph_llm' : 'fusion_direct_llm',
                sourceRef: sourceRef || undefined,
                round: 7,
            });
            this.setEnrichmentFieldByPath(next, resolution.path, updated);
            appliedCount += 1;
            appliedPaths.push(resolution.path);
        }
        return { sections: next, appliedCount, appliedPaths };
    }

    private getEnrichmentFieldByPath(sections: IterativeEnrichmentSections, path: string): EnrichmentField<unknown> | null {
        const [section, key] = path.split('.');
        if (!section || !key) return null;
        const sec = (sections as any)[section];
        return sec?.[key] || null;
    }

    private setEnrichmentFieldByPath(sections: IterativeEnrichmentSections, path: string, field: EnrichmentField<any>): void {
        const [section, key] = path.split('.');
        if (!section || !key) return;
        const sec = (sections as any)[section];
        if (sec) sec[key] = field;
    }

    private normalizeFusionResolutionValue(path: string, value: unknown): unknown {
        if (value === null || value === undefined) return 'unknown';
        const raw = typeof value === 'string' ? value.trim() : value;
        const str = typeof raw === 'string' ? raw : '';
        if (!str && typeof raw !== 'string') return raw;

        if (path === 'identity.account_status') {
            const v = str.toLowerCase();
            if (['enabled', 'locked', 'disabled', 'unknown'].includes(v)) return v;
            if (v.includes('disable')) return 'disabled';
            if (v.includes('lock')) return 'locked';
            if (v.includes('enable') || v.includes('active')) return 'enabled';
            return 'unknown';
        }
        if (path === 'identity.mfa_state') {
            const v = str.toLowerCase();
            if (['enrolled', 'not_enrolled', 'unknown'].includes(v)) return v;
            if (v.includes('not') || v.includes('disable')) return 'not_enrolled';
            return 'enrolled';
        }
        if (path === 'endpoint.device_type') {
            const v = str.toLowerCase();
            if (['desktop', 'laptop', 'mobile', 'unknown'].includes(v)) return v;
            if (/(notebook|laptop)/.test(v)) return 'laptop';
            if (/(iphone|ipad|android|mobile)/.test(v)) return 'mobile';
            return 'desktop';
        }
        if (path === 'network.vpn_state') {
            const v = str.toLowerCase();
            if (['connected', 'disconnected', 'unknown'].includes(v)) return v;
            if (/(connected|up|established)/.test(v)) return 'connected';
            return 'disconnected';
        }
        if (path === 'network.location_context') {
            const v = str.toLowerCase();
            if (['office', 'remote', 'unknown'].includes(v)) return v;
            if (/(office|onsite|on-site|site)/.test(v)) return 'office';
            return 'remote';
        }
        return typeof raw === 'string' ? str || 'unknown' : raw;
    }

    private isFusionUnknownValue(value: unknown): boolean {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') {
            const v = value.trim().toLowerCase();
            return !v || v === 'unknown' || v === 'n/a' || v === 'null';
        }
        return false;
    }

    private normalizeSimpleToken(value: string): string {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private generateNameAliases(name: string): Set<string> {
        const aliases = new Set<string>();
        const normalized = this.deps.normalizeName(name);
        const parts = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
        if (parts.length === 0) return aliases;
        const first = parts[0];
        const last = parts[parts.length - 1];
        aliases.add(this.normalizeSimpleToken(normalized));
        if (first) aliases.add(first);
        if (last) aliases.add(last);
        if (first && last) {
            aliases.add(`${first[0]}${last}`);
            aliases.add(`${first}.${last}`);
            aliases.add(`${first}_${last}`);
            aliases.add(`${first}${last[0]}`);
        }
        return new Set([...aliases].map((a) => this.normalizeSimpleToken(a)).filter(Boolean));
    }

    private extractSoftwareHintsFromTicket(text: string): string[] {
        const lower = String(text || '').toLowerCase();
        const hints = new Set<string>();
        const known = ['autocad', 'acad', 'outlook', 'teams', 'excel', 'word', 'quickbooks', 'adobe', 'acrobat', 'forticlient', 'vpn', 'chrome', 'edge', 'zoom', 'gotoconnect', 'goto'];
        for (const k of known) if (lower.includes(k)) hints.add(k);
        const quoted = lower.match(/\b[a-z][a-z0-9.+_-]{3,}\b/g) || [];
        for (const token of quoted.slice(0, 50)) {
            if (/(ticket|hello|please|thanks|support|issue|internet|office|user)/.test(token)) continue;
            if (known.some((k) => token.includes(k) || k.includes(token))) hints.add(token);
        }
        return [...hints].slice(0, 12);
    }
}
