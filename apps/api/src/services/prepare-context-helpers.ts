import type {
    IterativeEnrichmentSections,
    EnrichmentField,
    SourceFinding,
    IterativeEnrichmentProfile,
    TicketLike,
    EntityResolution,
    ItglueEnrichedPayload,
    Doc,
    Signal
} from './prepare-context.types.js';

export function itgAttr(attrs: Record<string, unknown> | null | undefined, key: string): unknown {
    if (!attrs) return undefined;
    if (attrs[key] !== undefined) return attrs[key];
    const toCamel = (s: string) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
    const toKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const camelKey = toCamel(key);
    if (attrs[camelKey] !== undefined) return attrs[camelKey];
    const kebabKey = toKebab(key);
    if (attrs[kebabKey] !== undefined) return attrs[kebabKey];
    return undefined;
}

export function normalizeName(name: string): string {
    if (!name) return '';
    return name.trim().replace(/\s+/g, ' ');
}

export function buildField<T>(input: {
    value: T;
    status: EnrichmentField<T>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string | undefined;
    round: number;
    observedAt?: string | undefined;
}): EnrichmentField<T> {
    const safeConfidence = Number(Math.max(0, Math.min(1, input.confidence)).toFixed(3));
    return {
        value: input.value,
        status: input.status,
        confidence: safeConfidence,
        source_system: input.sourceSystem,
        ...(input.sourceRef ? { source_ref: input.sourceRef } : {}),
        observed_at: input.observedAt || new Date().toISOString(),
        round: input.round,
    };
}

export function getEnrichmentFieldByPath(
    sections: IterativeEnrichmentSections,
    path: string
): EnrichmentField<unknown> | null {
    const [section, key] = path.split('.');
    if (!section || !key) return null;
    const sec = (sections as any)[section];
    if (!sec || typeof sec !== 'object') return null;
    return (sec as any)[key] || null;
}

export function setEnrichmentFieldByPath(
    sections: IterativeEnrichmentSections,
    path: string,
    field: EnrichmentField<any>
): void {
    const [section, key] = path.split('.');
    if (!section || !key) return;
    const sec = (sections as any)[section];
    if (!sec || typeof sec !== 'object') return;
    (sec as any)[key] = field;
}

export function flattenEnrichmentFields(
    sections: IterativeEnrichmentSections
): Array<{ path: string; field: EnrichmentField<unknown> }> {
    const output: Array<{ path: string; field: EnrichmentField<unknown> }> = [];
    for (const [sectionKey, sectionValue] of Object.entries(sections) as Array<
        [string, Record<string, EnrichmentField<unknown>>]
    >) {
        for (const [fieldKey, fieldValue] of Object.entries(sectionValue)) {
            output.push({
                path: `${sectionKey}.${fieldKey}`,
                field: fieldValue,
            });
        }
    }
    return output;
}

export function computeEnrichmentCoverage(
    records: Array<{ path: string; field: EnrichmentField<unknown> }>
): IterativeEnrichmentProfile['coverage'] {
    const total = records.length || 1;
    const confirmed = records.filter((record) => record.field.status === 'confirmed').length;
    const inferred = records.filter((record) => record.field.status === 'inferred').length;
    const unknown = records.filter((record) => record.field.status === 'unknown').length;
    const conflict = records.filter((record) => record.field.status === 'conflict').length;
    return {
        total,
        confirmed,
        inferred,
        unknown,
        conflict,
        completion_ratio: Number(((confirmed + inferred) / total).toFixed(3)),
    };
}

export function roundLabel(round: number): string {
    if (round === 1) return 'intake';
    if (round === 2) return 'itglue';
    if (round === 3) return 'ninja';
    if (round === 4) return 'history_correlation';
    if (round === 5) return 'itglue_refinement';
    if (round === 6) return 'ninja_refinement';
    if (round === 7) return 'cross_source_fusion';
    if (round === 8) return 'history_correlation_broad';
    if (round === 9) return 'final_refinement_verify_backfill';
    return `round_${round}`;
}

export function buildEnrichmentRounds(
    records: Array<{ path: string; field: EnrichmentField<unknown> }>,
    sourceFindings: SourceFinding[]
): IterativeEnrichmentProfile['rounds'] {
    const maxRound = Math.max(
        1,
        ...records.map((record) => Number(record.field.round || 1)),
        ...sourceFindings.map((finding) => Number(finding.round || 0))
    );
    const rounds: IterativeEnrichmentProfile['rounds'] = [];
    for (let round = 1; round <= maxRound; round += 1) {
        const roundRecords = records.filter((record) => Number(record.field.round || 1) === round);
        const roundFindings = sourceFindings.filter((finding) => Number(finding.round || 0) === round);
        if (roundRecords.length === 0 && roundFindings.length === 0) continue;
        const confirmed = roundRecords.filter((r) => r.field.status === 'confirmed').map((r) => r.path);
        const inferred = roundRecords.filter((r) => r.field.status === 'inferred').map((r) => r.path);
        const unknown = roundRecords.filter((r) => r.field.status === 'unknown').map((r) => r.path);
        rounds.push({
            round,
            label: roundLabel(round),
            sources_consulted: [...new Set(roundFindings.map((f) => f.source))],
            new_fields_confirmed: confirmed,
            new_fields_inferred: inferred,
            new_fields_unknown: unknown,
            gain_count: confirmed.length + inferred.length,
        });
    }
    return rounds;
}

export function isUnknown(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    const s = String(value).trim().toLowerCase();
    return s === '' || s === 'unknown' || s === 'n/a' || s === 'null' || s === 'undefined';
}

export function pickBetter<T>(...values: Array<T | null | undefined>): T {
    const valid = values.filter((v) => !isUnknown(v));
    if (valid.length > 0) return valid[0] as T;
    return values[0] as T;
}

export function pickHistoryKeyword(terms: string[]): string {
    const all = terms
        .flatMap((t) => String(t || '').split(/\s+/))
        .map((t) => t.trim())
        .filter((t) => t.length >= 4)
        .slice(0, 50);
    if (all.length === 0) return 'ticket';
    const noise = new Set(['with', 'from', 'that', 'this', 'please', 'ticket', 'setup', 'conference', 'room']);
    const best = all.find((t) => !noise.has(t.toLowerCase()));
    return best || all[0] || 'ticket';
}

export function mapAutotaskPriority(
    priority: number | undefined
): 'Critical' | 'High' | 'Medium' | 'Low' {
    if (!priority) return 'Medium';
    if (priority === 1) return 'Critical';
    if (priority <= 2) return 'High';
    if (priority <= 3) return 'Medium';
    return 'Low';
}

export function isLikelyDomainDerivedCompanyLabel(raw: string): boolean {
    if (!raw) return false;
    if (/\s/.test(raw)) return false;
    if (!/^[A-Za-z0-9._&-]+$/.test(raw)) return false;

    const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (compact.length < 8) return false;

    if (compact.includes('andcompany') || compact.includes('andco')) return true;
    if (/(company|corp|corporation|management|services|solutions|technologies|technology|holdings|consulting)$/.test(compact)) {
        return true;
    }

    return false;
}

export function shouldPreferCompanyCandidateOverIntake(intakeCompany: string, candidateCompany: string): boolean {
    const intake = normalizeName(String(intakeCompany || ''));
    const candidate = normalizeName(String(candidateCompany || ''));
    if (!intake || !candidate) return false;
    if (!isLikelyDomainDerivedCompanyLabel(intake)) return false;
    if (isLikelyDomainDerivedCompanyLabel(candidate)) return false;

    const candidateLooksDisplayReady =
        /[\s&.,()'-]/.test(candidate) || /\b(inc|llc|ltd|corp|corporation|co)\b/i.test(candidate);
    if (!candidateLooksDisplayReady) return false;

    return true;
}

export function selectPreferredCompanyName(input: { intakeCompany: string; inferredCompany: string }): string {
    const intake = normalizeName(String(input.intakeCompany || ''));
    const inferred = normalizeName(String(input.inferredCompany || ''));
    if (shouldPreferCompanyCandidateOverIntake(intake, inferred)) {
        return inferred;
    }
    return normalizeName(intake || inferred || '');
}

export function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function extractEmailDomains(text: string): string[] {
    const source = String(text || '').toLowerCase();
    const matches = source.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g) || [];
    const domains = matches
        .map((m) => m.split('@')[1] || '')
        .map((d) => d.trim())
        .filter(Boolean);
    return [...new Set(domains)].slice(0, 3);
}

export function extractEmails(text: string): string[] {
    const source = String(text || '').toLowerCase();
    const matches = source.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
    return [...new Set(matches.map((m) => m.trim()))];
}

export function extractFirstEmail(text: string): string | null {
    const emails = extractEmails(text);
    return emails.length > 0 ? emails[0] || null : null;
}

export function inferCompanyNameFromTicketText(text: string): string {
    const raw = String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
    const bodyPatterns = [
        /\bhas been created for\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?)\s*\.\s*we will attend/i,
        /\bcreated for\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?)\s*\.\s*/i,
        /\bfor\s+([A-Z][A-Za-z0-9&.,'()\-\s]{2,80}?,\s*(?:LLC|Inc\.?|Corp\.?|Corporation|Ltd\.?|Co\.?))\b/i,
    ];
    for (const pattern of bodyPatterns) {
        const match = raw.match(pattern);
        const candidate = normalizeName(String(match?.[1] || ''))
            .replace(/\s+/g, ' ')
            .replace(/\b(we will attend|the details of the ticket are listed below)\b[\s\S]*$/i, '')
            .trim()
            .replace(/[.,;:\s]+$/g, '');
        if (candidate && candidate.length >= 3 && !/^unknown$/i.test(candidate)) {
            return candidate;
        }
    }

    const domains = extractEmailDomains(text || '');
    if (!domains.length) return '';

    const domain = String(domains[0] || '').toLowerCase();
    const root = domain.split('.')[0] || '';
    if (!root) return '';

    const suffixes = [
        'management',
        'homes',
        'technologies',
        'technology',
        'solutions',
        'support',
        'services',
        'group',
        'partners',
        'consulting',
        'systems',
        'security',
        'health',
        'care',
        'logistics',
        'holdings',
        'capital',
    ];

    let normalized = root.replace(/[-_]+/g, ' ');
    for (const suffix of suffixes) {
        const idx = normalized.indexOf(suffix);
        if (idx > 0) {
            normalized = `${normalized.slice(0, idx)} ${suffix}`;
            break;
        }
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (!normalized) return '';

    return normalized
        .split(' ')
        .filter(Boolean)
        .map((part) => capitalize(part))
        .join(' ');
}

export function buildTicketNarrative(ticket: TicketLike): string {
    const updatesText = (ticket.updates || [])
        .map((u) => String(u?.content || '').trim())
        .filter(Boolean)
        .slice(0, 6)
        .join('\n');
    return [
        ticket.title || '',
        ticket.description || '',
        ticket.company || '',
        ticket.requester || '',
        ticket.rawBody || '',
        updatesText,
    ]
        .filter(Boolean)
        .join('\n');
}

export function normalizeTicketDeterministically(title: string, narrative: string): {
    title: string;
    descriptionClean: string;
    requesterName: string;
    requesterEmail: string;
    affectedUserName: string;
    affectedUserEmail: string;
} {
    const cleaned = String(narrative || '')
        .replace(/you can access your service ticket[\s\S]*$/i, '')
        .replace(/sincerely[\s\S]*$/i, '')
        .replace(/caution[\s\S]*$/i, '')
        .replace(/do not click any links? or attachments?[\s\S]*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();

    const requesterEmail = extractFirstEmail(cleaned) || '';
    const requesterName = normalizeName(
        String(cleaned.match(/(?:first\s*name|firstname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1] || '') +
        ' ' +
        String(cleaned.match(/(?:last\s*name|lastname)\s*[:\-]\s*([a-zA-Z]+)\b/i)?.[1] || '')
    ).trim();

    return {
        title: String(title || '').trim() || 'Support Request',
        descriptionClean: cleaned || String(narrative || '').trim(),
        requesterName,
        requesterEmail,
        affectedUserName: requesterName,
        affectedUserEmail: requesterEmail,
    };
}

export function postProcessCanonicalTicketText(value: string): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let text = raw;

    text = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<img\b[^>]*>/gi, ' ')
        .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

    text = text
        .replace(/\*{3}\s*please enter replies above this line\s*\*{3}[\s\S]*$/i, ' ')
        .replace(/thank you for contacting us[\s\S]*?the details of the ticket are listed below\.?/i, ' ')
        .replace(/you can access your service ticket via our client portal by clicking the following link:[\s\S]*$/i, ' ')
        .replace(/if you do not have access to the client portal[\s\S]*$/i, ' ')
        .replace(/sincerely,\s*refresh support team[\s\S]*$/i, ' ')
        .replace(/caution[\s\S]*?this email originated outside the organization[\s\S]*$/i, ' ')
        .replace(/do not click any links? or attachments? unless you know the sender[\s\S]*$/i, ' ');

    text = text
        .replace(/https?:\/\/nam\d+\.safelinks\.protection\.outlook\.com\/\S+/gi, ' ')
        .replace(/https?:\/\/\S+/gi, ' ');

    const descMatch = text.match(/\bdescription\s*:\s*([\s\S]+)$/i);
    if (descMatch?.[1]) {
        text = descMatch[1];
    }

    text = text
        .replace(/\bticket\s*#?\s*:\s*T\d{8}\.\d+\b/gi, ' ')
        .replace(/\bcreated on\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]*?\bby\s+[A-Za-z .'-]+/gi, ' ')
        .replace(/\btitle\s*:\s*[^.:\n]+/gi, ' ');

    text = text
        .replace(/\r\n/g, '\n')
        .replace(/\t+/g, ' ')
        .replace(/[ \u00A0]+/g, ' ')
        .replace(/[ ]*\n[ ]*/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\b(you can access your service ticket|sincerely|caution)\b[\s\S]*$/i, '')
        .trim();

    return formatCanonicalTicketSignature(text);
}

export function postProcessDisplayMarkdownTicketText(value: string): string {
    let text = String(value || '').trim();
    if (!text) return '';

    text = text
        .replace(/^```(?:markdown|md)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/^cleaned ticket text \(noise removed,\s*meaning preserved\):\s*/i, '')
        .trim();

    text = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<img\b[^>]*>/gi, ' ')
        .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

    text = text
        .replace(/\*{3}\s*please enter replies above this line\s*\*{3}[\s\S]*?(?=\n|$)/ig, '')
        .replace(/you can access your service ticket via our client portal by clicking the following link:[^\n]*/ig, '')
        .replace(/if you do not have access to the client portal[^\n]*/ig, '')
        .replace(/\bcaution\b[^\n]*\n?[^\n]*this email originated outside the organization[^\n]*/ig, '')
        .replace(/this message is directed to and is for the use of the above-noted addressee only[\s\S]*?(?=\n{2,}|$)/ig, '');

    text = text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return text;
}

export function stripMarkdownForDisplayGuard(value: string): string {
    return String(value || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/^\s*\|/gm, ' ')
        .replace(/\|/g, ' ')
        .replace(/^\s*:?[-]{3,}:?\s*$/gm, ' ')
        .replace(/[*_~]/g, '')
        .trim();
}

export function normalizeDisplayTextForVerbatimGuard(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

export function formatCanonicalTicketSignature(value: string): string {
    const text = String(value || '').trim();
    if (!text) return '';

    const signatureStart = detectLikelySignatureStart(text);
    if (signatureStart <= 0 || signatureStart >= text.length) {
        return text.replace(/\s+/g, ' ').trim();
    }

    const body = text.slice(0, signatureStart).replace(/\s+/g, ' ').trim();
    const signature = text.slice(signatureStart).trim();
    const formattedSignature = formatSignatureBlock(signature);
    if (!formattedSignature) return body;
    if (!body) return formattedSignature;
    return `${body}\n\n${formattedSignature}`;
}

export function detectLikelySignatureStart(text: string): number {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return -1;

    const lower = normalized.toLowerCase();
    const signoffPatterns = [
        /\bthanks[,!]?\s+/ig,
        /\bthank you[,!]?\s+/ig,
        /\bbest regards[,!]?\s+/ig,
        /\bregards[,!]?\s+/ig,
        /\bcheers[,!]?\s+/ig,
    ];
    for (const pattern of signoffPatterns) {
        const match = pattern.exec(lower);
        if (match && signatureSignalCount(normalized.slice(match.index)) >= 2) {
            return match.index;
        }
    }

    const tailStart = Math.floor(normalized.length * 0.45);
    const contactMatch = normalized
        .slice(tailStart)
        .match(/\b(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:Phone|Direct|Email|Website)\s*:|www\.)/i);
    if (!contactMatch || contactMatch.index == null) return -1;

    const contactIdx = tailStart + contactMatch.index;
    let start = Math.max(0, contactIdx - 120);
    const beforeContact = normalized.slice(start, contactIdx);

    const properName = beforeContact.match(/(?:^|\s)([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\s*$/);
    const upperName = beforeContact.match(/(?:^|\s)([A-Z]{2,}(?:\s+[A-Z]{2,}){1,4})\s*$/);
    if (properName?.index != null) {
        start += properName.index + (properName[0].startsWith(' ') ? 1 : 0);
    } else if (upperName?.index != null) {
        start += upperName.index + (upperName[0].startsWith(' ') ? 1 : 0);
    } else {
        start = contactIdx;
    }

    return signatureSignalCount(normalized.slice(start)) >= 2 ? start : -1;
}

export function signatureSignalCount(text: string): number {
    const raw = String(text || '');
    let count = 0;
    if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(raw)) count += 1;
    if (/\b(?:direct|phone|mobile|cell|office|email|website)\s*:/i.test(raw)) count += 1;
    if (/\bwww\.[a-z0-9.-]+\.[a-z]{2,}\b/i.test(raw)) count += 1;
    if (/\b(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]?\d{4}\b/.test(raw)) count += 1;
    if (/\b\d{2,6}\s+[A-Za-z0-9.'#-]+(?:\s+[A-Za-z0-9.'#-]+){1,8}\b/.test(raw)) count += 1;
    return count;
}

export function formatSignatureBlock(signature: string): string {
    let sig = String(signature || '')
        .replace(/\r\n/g, '\n')
        .replace(/\s+/g, ' ')
        .trim();
    if (!sig) return '';

    sig = sig.replace(/^(thanks|thank you|regards|best regards|cheers)[,!]?\s+/i, (_m, word) => `${word.replace(/\b\w/g, (c: string) => c.toUpperCase())},\n`);
    sig = sig.replace(/\s+(?=(?:Direct|Phone|Mobile|Cell|Office|Email|Website)\s*:)/g, '\n');
    sig = sig
        .replace(/\s+(?=[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
        .replace(/\s+(?=www\.[a-z0-9.-]+\.[a-z]{2,}\b)/ig, '\n')
        .replace(/\s+(?=(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]?\d{4}\b)/g, '\n');
    sig = sig
        .replace(/\s+(?=(?:Sr\.?\s+)?(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n')
        .replace(/\s+(?=\d{2,6}\s+[A-Za-z])/g, '\n');
    sig = sig
        .replace(/\s+(?=\be\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
        .replace(/\s+(?=\bc\s+\d{3}[.\-\s]\d{3}[.\-\s]\d{4}\b)/ig, '\n');
    sig = sig
        .replace(/\b(Direct|Phone|Mobile|Cell|Office|Email|Website):\s*\n\s*/g, '$1: ')
        .replace(/\n(Sr\.|Jr\.)\s*\n(?=(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n$1 ');
    sig = sig
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');

    return sig;
}

export function postProcessUiTicketText(value: string): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text
        .replace(/^new ticket detected:\s*/i, '')
        .replace(/^ticket\s*#?\s*T\d{8}\.\d+\s*[:\-]\s*/i, '')
        .replace(/\s*(from|at)\s+[A-Z][\s\S]*$/i, '')
        .trim();
}

function escapeRegex(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function guardTicketUiRoleAssignment(input: {
    descriptionUi: string;
    requesterName: string;
    ticketRequester: string;
    canonicalText: string;
    narrative: string;
}): string {
    let ui = String(input.descriptionUi || '').trim();
    if (!ui) return ui;

    const requesterName = normalizeName(input.requesterName || input.ticketRequester || '').trim();
    if (!requesterName) return ui;

    const requesterLower = requesterName.toLowerCase();
    const uiLower = ui.toLowerCase();
    const canonical = String(input.canonicalText || input.narrative || '').toLowerCase();

    const mentionsNewEmployee = /\b(new|another)\s+(maintenance\s+)?employee\b/.test(canonical);
    const requesterAsksForThirdParty =
        /\bwe have a new\b/.test(canonical) ||
        /\bhe will need\b/.test(canonical) ||
        /\bshe will need\b/.test(canonical) ||
        /\bthey will need\b/.test(canonical) ||
        /\bfor (a|an|our)\s+(new\s+)?(employee|hire|user)\b/.test(canonical) ||
        /\bon behalf of\b/.test(canonical);

    const uiAssignsRequesterToNewEmployee =
        uiLower.includes(requesterLower) &&
        /\bnew\s+(maintenance\s+)?employee\b/.test(uiLower) &&
        !/\brequests?\b/.test(uiLower);

    if (!(mentionsNewEmployee && requesterAsksForThirdParty && uiAssignsRequesterToNewEmployee)) {
        return ui;
    }

    ui = ui.replace(new RegExp(`\\b${escapeRegex(requesterName)}\\b`, 'ig'), '').replace(/\s+/g, ' ').trim();
    ui = ui.replace(/\bfor\s+new\s+(maintenance\s+)?employee\b/gi, 'for a new $1employee (name not provided)');
    ui = ui.replace(/\bnew\s+(maintenance\s+)?employee\b/i, 'new $1employee (name not provided)');
    ui = ui.replace(/\s+/g, ' ').trim();
    ui = ui.replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, '');

    const requesterLead = `${requesterName} requests`;
    if (!ui.toLowerCase().startsWith(requesterLead.toLowerCase())) {
        ui = `${requesterLead} ${ui.charAt(0).toLowerCase()}${ui.slice(1)}`;
    }
    return ui;
}

export function extractJsonObject(raw: string): Record<string, unknown> {
    const text = String(raw || '').trim();
    if (!text) return {};
    try {
        return JSON.parse(text) as Record<string, unknown>;
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return {};
        try {
            return JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
            return {};
        }
    }
}

export function buildRequesterTokens(value: string): string[] {
    const normalized = normalizeName(value).toLowerCase();
    if (!normalized) return [];
    return normalized
        .split(/[\s@._-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3)
        .slice(0, 4);
}

export function normalizeOrgNameForMatch(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[.,()[\]{}'"/\\_-]+/g, ' ')
        .replace(
            /\b(incorporated|corporation|corp|company|co|limited|ltd|llc|llp|pllc|inc)\b/g,
            ' '
        )
        .replace(/\s+/g, ' ')
        .trim();
}

export function scoreOrgNameMatch(name: string, candidate: string, candidateShortName?: string): number {
    const rawN = normalizeName(name).toLowerCase();
    const variants = [candidate, candidateShortName || '']
        .map((v) => normalizeName(String(v || '')))
        .filter(Boolean);
    if (!rawN || variants.length === 0) return 0;

    const genericTokens = new Set([
        'resource',
        'resources',
        'technology',
        'technologies',
        'solution',
        'solutions',
        'service',
        'services',
        'system',
        'systems',
        'group',
        'global',
        'international',
        'management',
        'consulting',
        'support',
        'partners',
        'network',
        'networks',
        'communications',
        'communication',
        'company',
        'companies',
        'holdings',
    ]);

    let best = 0;
    for (const variant of variants) {
        const rawC = variant.toLowerCase();
        if (!rawC) continue;
        if (rawC === rawN) return 1;

        const n = normalizeOrgNameForMatch(rawN);
        const c = normalizeOrgNameForMatch(rawC);
        if (!n || !c) continue;
        if (c === n) return 0.99;
        if (c.includes(n) || n.includes(c)) {
            best = Math.max(best, 0.95);
        }

        const nTokens = [...new Set(n.split(' ').filter((t) => t.length >= 2))];
        const cTokens = [...new Set(c.split(' ').filter((t) => t.length >= 2))];
        if (nTokens.length === 0 || cTokens.length === 0) continue;

        const overlap = nTokens.filter((t) => cTokens.includes(t));
        if (overlap.length === 0) continue;

        const nDistinct = nTokens.filter((t) => !genericTokens.has(t));
        const cDistinct = cTokens.filter((t) => !genericTokens.has(t));
        const distinctOverlap = nDistinct.filter((t) => cDistinct.includes(t));

        if (nDistinct.length > 0 && cDistinct.length > 0 && distinctOverlap.length === 0) {
            continue;
        }

        const coverageMin = overlap.length / Math.max(Math.min(nTokens.length, cTokens.length), 1);
        const coverageMax = overlap.length / Math.max(Math.max(nTokens.length, cTokens.length), 1);
        const distinctCoverage =
            distinctOverlap.length / Math.max(Math.min(Math.max(nDistinct.length, 1), Math.max(cDistinct.length, 1)), 1);

        let score = 0.35 * coverageMin + 0.25 * coverageMax + 0.4 * distinctCoverage;

        const acronym = nDistinct.map((t) => t[0]).join('');
        if (acronym && (c.includes(acronym) || rawC.includes(acronym))) {
            score = Math.max(score, 0.72);
        }

        best = Math.max(best, score);
    }

    return best;
}

export function fuzzyMatch(name: string, candidate: string): boolean {
    return scoreOrgNameMatch(name, candidate) >= 0.8;
}

export function normalizeCompanyComparable(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\b(inc|llc|ltd|corp|corporation|co)\b/g, '')
        .trim();
}

export function generateNameAliases(name: string): string[] {
    const raw = normalizeName(name);
    if (!raw) return [];
    const parts = raw.split(' ').filter(Boolean);
    if (parts.length < 2) return [raw];
    const first = parts[0];
    const last = parts[parts.length - 1];
    if (!first || !last) return [raw];
    return [
        raw,
        `${first} ${last}`,
        `${first.charAt(0)}. ${last}`,
        `${first} ${last.charAt(0)}.`,
    ];
}

export function extractSoftwareHintsFromTicket(text: string): string[] {
    const source = String(text || '').toLowerCase();
    const softwareMatchers = [
        { name: 'Forticlient', patterns: [/\bforticlient\b/, /\bforti\s?client\b/] },
        { name: 'VPN', patterns: [/\bvpn\b/] },
        { name: 'Teams', patterns: [/\bteams\b/, /\bmicrosoft\s?teams\b/] },
        { name: 'Outlook', patterns: [/\boutlook\b/] },
        { name: 'Office', patterns: [/\boffice\b/, /\bm365\b/, /\bo365\b/] },
    ];
    return softwareMatchers
        .filter((sm) => sm.patterns.some((p) => p.test(source)))
        .map((sm) => sm.name);
}

export function normalizeHistoryTerms(terms: string[]): string[] {
    const output = new Set<string>();
    for (const t of terms) {
        const clean = String(t || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '')
            .trim();
        if (clean.length >= 3) output.add(clean);
    }
    return [...output];
}

export function scoreHistoryCandidate(haystack: string, terms: string[]): { score: number; matchedTerms: string[] } {
    const lowerHaystack = haystack.toLowerCase();
    const matched = terms.filter((t) => lowerHaystack.includes(t));
    if (matched.length === 0) return { score: 0, matchedTerms: [] };
    const score = matched.length / terms.length;
    return { score, matchedTerms: matched };
}

export function normalizeFusionResolutionValue(path: string, value: unknown): unknown {
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
        if (v.includes('enroll') || v.includes('enabled')) return 'enrolled';
        return 'unknown';
    }
    if (path === 'endpoint.device_type') {
        const v = str.toLowerCase();
        if (['desktop', 'laptop', 'mobile', 'unknown'].includes(v)) return v;
        if (/(notebook|laptop)/.test(v)) return 'laptop';
        if (/(iphone|ipad|android|mobile)/.test(v)) return 'mobile';
        if (/(desktop|workstation|pc)/.test(v)) return 'desktop';
        return 'unknown';
    }
    if (path === 'network.vpn_state') {
        const v = str.toLowerCase();
        if (['connected', 'disconnected', 'unknown'].includes(v)) return v;
        if (/(connected|up|established)/.test(v)) return 'connected';
        if (/(disconnected|down|not connected)/.test(v)) return 'disconnected';
        return 'unknown';
    }
    if (path === 'network.location_context') {
        const v = str.toLowerCase();
        if (['office', 'remote', 'unknown'].includes(v)) return v;
        if (/(office|onsite|on-site|site)/.test(v)) return 'office';
        if (/(remote|home|vpn)/.test(v)) return 'remote';
        return 'unknown';
    }
    return typeof raw === 'string' ? str || 'unknown' : raw;
}

export function isFusionUnknownValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return !v || v === 'unknown' || v === 'n/a' || v === 'null';
    }
    return false;
}


export function buildIterativeEnrichmentProfile(input: {
    ticket: TicketLike;
    ticketNarrative: string;
    companyName: string;
    inferredCompany: string;
    requesterName: string;
    entityResolution: EntityResolution;
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
    inferredPhoneProvider: string | null;
    sourceFindings: SourceFinding[];
    itglueConfigs: any[];
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched?: ItglueEnrichedPayload | null;
    docs: Doc[];
    ninjaChecks: Signal[];
    missingData: Array<{ field: string; why: string }>;
    enrichmentEngine: any;
    pickEnrichedValue: (enriched: any, key: string) => string;
    extractInfraMakeModel: (type: string, configs: any[], docs: any[]) => any;
    extractITGlueWanCandidate: (input: any) => any;
    inferIspName: (input: any) => string;
    extractITGlueInfraCandidates: (params: any) => any;
}): IterativeEnrichmentProfile {
    const ticketSection = buildTicketEnrichmentSection({
        ticket: input.ticket,
        companyName: input.companyName,
        inferredCompany: input.inferredCompany,
        requesterName: input.requesterName,
        entityResolution: input.entityResolution,
    });
    const identitySection = buildIdentityEnrichmentSection(input.entityResolution);
    const endpointSection = buildEndpointEnrichmentSection({
        ticketNarrative: input.ticketNarrative,
        device: input.device,
        deviceDetails: input.deviceDetails,
        loggedInUser: input.loggedInUser,
        loggedInAt: input.loggedInAt,
        ninjaChecks: input.ninjaChecks,
        enrichmentEngine: input.enrichmentEngine,
    });
    const networkSection = buildNetworkEnrichmentSection({
        ticketNarrative: input.ticketNarrative,
        device: input.device,
        deviceDetails: input.deviceDetails,
        docs: input.docs,
        itglueConfigs: input.itglueConfigs,
        itgluePasswords: input.itgluePasswords,
        itglueAssets: input.itglueAssets,
        itglueEnriched: input.itglueEnriched || null,
        ninjaChecks: input.ninjaChecks,
        inferredPhoneProvider: input.inferredPhoneProvider,
        enrichmentEngine: input.enrichmentEngine,
        extractITGlueWanCandidate: input.extractITGlueWanCandidate,
        inferIspName: input.inferIspName,
        pickEnrichedValue: input.pickEnrichedValue,
    });
    const infraSection = buildInfraEnrichmentSection({
        itglueConfigs: input.itglueConfigs,
        itgluePasswords: input.itgluePasswords,
        itglueAssets: input.itglueAssets,
        itglueEnriched: input.itglueEnriched || null,
        docs: input.docs,
        extractITGlueInfraCandidates: input.extractITGlueInfraCandidates,
        pickEnrichedValue: input.pickEnrichedValue,
        extractInfraMakeModel: input.extractInfraMakeModel,
    });

    const sections: IterativeEnrichmentSections = {
        ticket: ticketSection,
        identity: identitySection,
        endpoint: endpointSection,
        network: networkSection,
        infra: infraSection,
    };

    const fieldRecords = flattenEnrichmentFields(sections);
    const coverage = computeEnrichmentCoverage(fieldRecords);
    const rounds = buildEnrichmentRounds(fieldRecords, input.sourceFindings);
    const lastRound = rounds.at(-1);
    const completedRounds = lastRound?.round ?? 1;
    const lastRoundGain = lastRound?.gain_count ?? 0;

    let stopReason: IterativeEnrichmentProfile['stop_reason'] = 'source_exhausted';
    if (completedRounds >= 5) {
        stopReason = 'max_rounds_reached';
    } else if (coverage.completion_ratio >= 0.85) {
        stopReason = 'coverage_target_reached';
    } else if (lastRoundGain <= 1 || input.missingData.length > 0) {
        stopReason = 'marginal_gain';
    }

    return {
        schema_version: '1.0.0',
        completed_rounds: completedRounds,
        stop_reason: stopReason,
        rounds,
        sections,
        coverage,
    };
}

export function buildTicketEnrichmentSection(input: {
    ticket: TicketLike;
    companyName: string;
    inferredCompany: string;
    requesterName: string;
    entityResolution: EntityResolution;
}): IterativeEnrichmentSections['ticket'] {
    const ticketId = String(input.ticket.ticketNumber || input.ticket.id || '').trim();
    const requesterFromTicket = normalizeName(
        input.ticket.canonicalRequesterName || input.ticket.requester || input.requesterName || ''
    );
    const requesterEmailFromTicket = String(
        input.ticket.canonicalRequesterEmail || extractFirstEmail(input.ticket.requester || '')
    ).trim();
    const extractedEmail = input.entityResolution.extracted_entities.email[0] || '';
    const requesterEmail = requesterEmailFromTicket || extractedEmail || '';

    const resolvedActor = input.entityResolution.resolved_actor;
    const affectedName = normalizeName(
        input.ticket.canonicalAffectedName || resolvedActor?.name || requesterFromTicket || 'unknown'
    );
    const affectedEmail = String(
        input.ticket.canonicalAffectedEmail || resolvedActor?.email || requesterEmail || 'unknown'
    ).trim();

    const companyFromTicket = normalizeName(input.ticket.company || '');
    const companyValue = companyFromTicket || input.companyName || input.inferredCompany || 'unknown';
    const companyStatus = companyFromTicket
        ? 'confirmed'
        : companyValue !== 'unknown'
            ? 'inferred'
            : 'unknown';

    return {
        ticket_id: buildField({
            value: ticketId || 'unknown',
            status: ticketId ? 'confirmed' : 'unknown',
            confidence: ticketId ? 1 : 0,
            sourceSystem: 'ticket',
            sourceRef: 'ticket.id',
            round: 1,
        }),
        company: buildField({
            value: companyValue,
            status: companyStatus,
            confidence: companyStatus === 'confirmed' ? 1 : companyStatus === 'inferred' ? 0.7 : 0,
            sourceSystem: companyFromTicket ? 'ticket' : companyValue !== 'unknown' ? 'ticket_narrative' : 'unknown',
            sourceRef: companyFromTicket ? 'ticket.company' : companyValue !== 'unknown' ? 'ticket.domain_inference' : undefined,
            round: 1,
        }),
        requester_name: buildField({
            value: requesterFromTicket || 'unknown',
            status: requesterFromTicket ? 'confirmed' : 'unknown',
            confidence: requesterFromTicket ? 0.9 : 0,
            sourceSystem: requesterFromTicket ? 'ticket' : 'unknown',
            sourceRef: requesterFromTicket ? 'ticket.requester' : undefined,
            round: 1,
        }),
        requester_email: buildField({
            value: requesterEmail || 'unknown',
            status: requesterEmail ? 'confirmed' : 'unknown',
            confidence: requesterEmail ? 0.9 : 0,
            sourceSystem: requesterEmail ? 'ticket' : 'unknown',
            sourceRef: requesterEmail ? 'ticket.requester.email' : undefined,
            round: 1,
        }),
        affected_user_name: buildField({
            value: affectedName,
            status: resolvedActor ? (resolvedActor.confidence === 'strong' ? 'confirmed' : 'inferred') : (requesterFromTicket ? 'inferred' : 'unknown'),
            confidence: resolvedActor ? (resolvedActor.confidence === 'strong' ? 0.9 : 0.7) : (requesterFromTicket ? 0.6 : 0),
            sourceSystem: resolvedActor ? 'entity_resolution' : 'ticket',
            sourceRef: resolvedActor ? 'entity_resolution.resolved_actor' : 'ticket.requester',
            round: resolvedActor ? 3 : 1,
        }),
        affected_user_email: buildField({
            value: affectedEmail,
            status: resolvedActor ? (resolvedActor.confidence === 'strong' ? 'confirmed' : 'inferred') : (requesterEmail ? 'inferred' : 'unknown'),
            confidence: resolvedActor ? (resolvedActor.confidence === 'strong' ? 0.9 : 0.7) : (requesterEmail ? 0.6 : 0),
            sourceSystem: resolvedActor ? 'entity_resolution' : 'ticket',
            sourceRef: resolvedActor ? 'entity_resolution.resolved_actor' : 'ticket.requester.email',
            round: resolvedActor ? 3 : 1,
        }),
        title: buildField({
            value: String(input.ticket.title || '').trim() || 'unknown',
            status: input.ticket.title ? 'confirmed' : 'unknown',
            confidence: input.ticket.title ? 0.95 : 0,
            sourceSystem: input.ticket.title ? 'ticket' : 'unknown',
            sourceRef: input.ticket.title ? 'ticket.title' : undefined,
            round: 1,
        }),
        description_clean: buildField({
            value: String(input.ticket.description || '').trim() || 'unknown',
            status: input.ticket.description ? 'confirmed' : 'unknown',
            confidence: input.ticket.description ? 0.9 : 0,
            sourceSystem: input.ticket.description ? 'ticket' : 'unknown',
            sourceRef: input.ticket.description ? 'ticket.description' : undefined,
            round: 1,
        }),
    };
}

export function buildIdentityEnrichmentSection(
    entityResolution: EntityResolution
): IterativeEnrichmentSections['identity'] {
    const resolvedEmail = entityResolution.resolved_actor?.email || '';
    const extractedEmail = entityResolution.extracted_entities.email[0] || '';
    const principal = resolvedEmail || extractedEmail || 'unknown';
    const hasStrongResolvedEmail =
        Boolean(resolvedEmail) && entityResolution.resolved_actor?.confidence === 'strong';

    return {
        user_principal_name: buildField({
            value: principal,
            status: hasStrongResolvedEmail ? 'confirmed' : principal !== 'unknown' ? 'inferred' : 'unknown',
            confidence: hasStrongResolvedEmail ? 0.9 : principal !== 'unknown' ? 0.6 : 0,
            sourceSystem: resolvedEmail ? 'entity_resolution' : extractedEmail ? 'ticket_narrative' : 'unknown',
            sourceRef: resolvedEmail
                ? 'entity_resolution.resolved_actor.email'
                : extractedEmail
                    ? 'entity_resolution.extracted_entities.email[0]'
                    : undefined,
            round: resolvedEmail ? 3 : extractedEmail ? 2 : 1,
        }),
        account_status: buildField({
            value: 'unknown',
            status: 'unknown',
            confidence: 0,
            sourceSystem: 'directory',
            sourceRef: 'unavailable',
            round: 2,
        }),
        mfa_state: buildField({
            value: 'unknown',
            status: 'unknown',
            confidence: 0,
            sourceSystem: 'directory',
            sourceRef: 'unavailable',
            round: 2,
        }),
        licenses_summary: buildField({
            value: 'Unknown',
            status: 'unknown',
            confidence: 0,
            sourceSystem: 'directory',
            sourceRef: 'unavailable',
            round: 2,
        }),
        groups_top: buildField({
            value: 'unknown',
            status: 'unknown',
            confidence: 0,
            sourceSystem: 'directory',
            sourceRef: 'unavailable',
            round: 2,
        }),
    };
}

export function buildEndpointEnrichmentSection(input: {
    ticketNarrative: string;
    device: any | null;
    deviceDetails: any | null;
    loggedInUser: string;
    loggedInAt: string;
    ninjaChecks: Signal[];
    enrichmentEngine: any;
}): IterativeEnrichmentSections['endpoint'] {
    const deviceName = String(
        input.device?.hostname || input.device?.systemName || input.device?.id || ''
    ).trim();
    const deviceType = input.enrichmentEngine.inferDeviceType({
        ticketNarrative: input.ticketNarrative,
        device: input.device,
        deviceDetails: input.deviceDetails,
    });
    const osName = String(
        input.device?.osName ||
        input.deviceDetails?.osName ||
        input.deviceDetails?.os?.name ||
        ''
    ).trim();
    const osVersion = String(
        input.device?.osVersion ||
        input.deviceDetails?.osVersion ||
        [input.deviceDetails?.os?.buildNumber, input.deviceDetails?.os?.releaseId].filter(Boolean).join(' / ') ||
        ''
    ).trim();
    const lastCheckIn = input.enrichmentEngine.normalizeTimeValue(
        input.device?.lastActivityTime ||
        input.device?.lastContact ||
        input.deviceDetails?.lastContact ||
        input.deviceDetails?.lastUpdate ||
        ''
    );
    const securityAgent = input.enrichmentEngine.inferSecurityAgent(input.ninjaChecks, input.deviceDetails);

    return {
        device_name: buildField({
            value: deviceName || 'unknown',
            status: deviceName ? 'confirmed' : 'unknown',
            confidence: deviceName ? 0.85 : 0,
            sourceSystem: deviceName ? 'ninjaone' : 'unknown',
            sourceRef: deviceName ? 'ninja.device.hostname' : undefined,
            round: 1,
        }),
        device_type: buildField({
            value: deviceType,
            status: deviceType !== 'unknown' ? 'inferred' : 'unknown',
            confidence: deviceType !== 'unknown' ? 0.65 : 0,
            sourceSystem: deviceType !== 'unknown' ? 'ninjaone' : 'unknown',
            sourceRef: deviceType !== 'unknown' ? 'ninja.device.os/type_heuristic' : undefined,
            round: 1,
        }),
        os_name: buildField({
            value: osName || 'unknown',
            status: osName ? 'confirmed' : 'unknown',
            confidence: osName ? 0.8 : 0,
            sourceSystem: osName ? 'ninjaone' : 'unknown',
            sourceRef: osName ? 'ninja.device.osName/os.name' : undefined,
            round: 1,
        }),
        os_version: buildField({
            value: osVersion || 'unknown',
            status: osVersion ? 'confirmed' : 'unknown',
            confidence: osVersion ? 0.75 : 0,
            sourceSystem: osVersion ? 'ninjaone' : 'unknown',
            sourceRef: osVersion ? 'ninja.device.osVersion/os.buildNumber+releaseId' : undefined,
            round: 1,
        }),
        last_check_in: buildField({
            value: lastCheckIn || 'unknown',
            status: lastCheckIn ? 'confirmed' : 'unknown',
            confidence: lastCheckIn ? 0.85 : 0,
            sourceSystem: lastCheckIn ? 'ninjaone' : 'unknown',
            sourceRef: lastCheckIn ? 'ninja.device.lastActivityTime' : undefined,
            round: 1,
        }),
        security_agent: buildField({
            value: securityAgent,
            status: securityAgent.state === 'unknown' ? 'unknown' : 'inferred',
            confidence: securityAgent.state === 'present' ? 0.7 : securityAgent.state === 'absent' ? 0.45 : 0,
            sourceSystem: securityAgent.state === 'unknown' ? 'unknown' : 'ninjaone',
            sourceRef: securityAgent.state === 'unknown' ? undefined : 'ninja.device.checks',
            round: 1,
        }),
        user_signed_in: buildField({
            value: input.loggedInUser || 'unknown',
            status: input.loggedInUser ? 'inferred' : 'unknown',
            confidence: input.loggedInUser ? 0.7 : 0,
            sourceSystem: input.loggedInUser ? 'ninjaone' : 'unknown',
            sourceRef: input.loggedInUser ? 'ninja.device.last-logged-on-user' : undefined,
            round: input.loggedInUser ? 3 : 1,
        }),
        user_signed_in_at: buildField({
            value: input.loggedInAt || (input.loggedInUser && lastCheckIn ? lastCheckIn : 'unknown'),
            status: input.loggedInAt || (input.loggedInUser && lastCheckIn) ? 'inferred' : 'unknown',
            confidence: input.loggedInAt || (input.loggedInUser && lastCheckIn) ? 0.7 : 0,
            sourceSystem: input.loggedInAt || input.loggedInUser ? 'ninjaone' : 'unknown',
            sourceRef: input.loggedInAt ? 'ninja.device.last-logged-on-user.logonTime' : input.loggedInUser && lastCheckIn ? 'ninja.device.lastActivityTime' : undefined,
            round: input.loggedInUser ? 3 : 1,
        }),
    };
}

export function buildNetworkEnrichmentSection(input: {
    ticketNarrative: string;
    device: any | null;
    deviceDetails: any | null;
    docs: Doc[];
    itglueConfigs: any[];
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched: ItglueEnrichedPayload | null;
    ninjaChecks: Signal[];
    inferredPhoneProvider: string | null;
    enrichmentEngine: any;
    extractITGlueWanCandidate: (params: any) => any;
    inferIspName: (params: any) => string;
    pickEnrichedValue: (enriched: any, key: string) => string;
}): IterativeEnrichmentSections['network'] {
    const wanCandidate = input.extractITGlueWanCandidate({
        ticketNarrative: input.ticketNarrative,
        itglueAssets: input.itglueAssets,
        itglueConfigs: input.itglueConfigs,
        docs: input.docs,
    });
    const narrativeLocationContext = input.enrichmentEngine.inferLocationContext(input.ticketNarrative);
    const locationContext = narrativeLocationContext !== 'unknown'
        ? narrativeLocationContext
        : wanCandidate?.location_hint
            ? 'office'
            : 'unknown';
    const publicIp = input.enrichmentEngine.resolvePublicIp(input.device, input.deviceDetails);
    const itglueLlmIsp = input.pickEnrichedValue(input.itglueEnriched, 'isp_name');
    const ispName = itglueLlmIsp || wanCandidate?.isp_name || input.inferIspName({
        ticketNarrative: input.ticketNarrative,
        docs: input.docs,
        itglueConfigs: input.itglueConfigs,
    });
    const vpnState = input.enrichmentEngine.inferVpnState(input.ninjaChecks, input.ticketNarrative);
    const phoneProviderConnected = Boolean(input.inferredPhoneProvider);

    return {
        location_context: buildField({
            value: locationContext,
            status: locationContext === 'unknown' ? 'unknown' : 'inferred',
            confidence: locationContext === 'unknown' ? 0 : narrativeLocationContext !== 'unknown' ? 0.65 : 0.75,
            sourceSystem: locationContext === 'unknown' ? 'unknown' : narrativeLocationContext !== 'unknown' ? 'ticket_narrative' : 'itglue',
            sourceRef: locationContext === 'unknown' ? undefined : narrativeLocationContext !== 'unknown' ? 'ticket.text' : wanCandidate?.source_ref,
            round: narrativeLocationContext !== 'unknown' ? 1 : 2,
        }),
        public_ip: buildField({
            value: publicIp || 'unknown',
            status: publicIp ? 'confirmed' : 'unknown',
            confidence: publicIp ? 0.9 : 0,
            sourceSystem: publicIp ? 'ninjaone' : 'unknown',
            sourceRef: publicIp ? 'ninja.device.publicIP/ipAddresses' : undefined,
            round: 1,
        }),
        isp_name: buildField({
            value: ispName || 'unknown',
            status: ispName ? 'inferred' : 'unknown',
            confidence: itglueLlmIsp ? 0.75 : wanCandidate?.isp_name ? Math.max(0.65, wanCandidate.confidence) : ispName ? 0.6 : 0,
            sourceSystem: itglueLlmIsp ? 'itglue_llm' : wanCandidate?.isp_name ? 'itglue' : ispName ? 'cross_correlation' : 'unknown',
            sourceRef: itglueLlmIsp ? 'itglue_org_snapshot' : wanCandidate?.isp_name ? wanCandidate.source_ref : ispName ? 'ticket/docs/itglue keyword' : undefined,
            round: ispName ? 2 : 1,
        }),
        vpn_state: buildField({
            value: vpnState,
            status: vpnState === 'unknown' ? 'unknown' : 'inferred',
            confidence: vpnState === 'connected' ? 0.7 : vpnState === 'disconnected' ? 0.6 : 0,
            sourceSystem: vpnState === 'unknown' ? 'unknown' : 'ninjaone',
            sourceRef: vpnState === 'unknown' ? undefined : 'ninja.checks:vpn',
            round: 1,
        }),
        phone_provider: buildField({
            value: phoneProviderConnected ? 'connected' : 'unknown',
            status: phoneProviderConnected ? 'inferred' : 'unknown',
            confidence: phoneProviderConnected ? 0.7 : 0,
            sourceSystem: phoneProviderConnected ? 'provider_inference' : 'unknown',
            sourceRef: phoneProviderConnected ? 'ticket/docs/configs/signals' : undefined,
            round: 1,
        }),
        phone_provider_name: buildField({
            value: input.inferredPhoneProvider || 'unknown',
            status: input.inferredPhoneProvider ? 'inferred' : 'unknown',
            confidence: input.inferredPhoneProvider ? 0.75 : 0,
            sourceSystem: input.inferredPhoneProvider ? 'provider_inference' : 'unknown',
            sourceRef: input.inferredPhoneProvider ? 'provider.keyword_match' : undefined,
            round: 1,
        }),
    };
}

export function buildInfraEnrichmentSection(input: {
    itglueConfigs: any[];
    itgluePasswords: any[];
    itglueAssets: any[];
    itglueEnriched: ItglueEnrichedPayload | null;
    docs: Doc[];
    extractITGlueInfraCandidates: (params: any) => any;
    pickEnrichedValue: (enriched: any, key: string) => string;
    extractInfraMakeModel: (type: string, configs: any[], docs: any[]) => any;
}): IterativeEnrichmentSections['infra'] {
    const metadataCandidates = input.extractITGlueInfraCandidates({
        itgluePasswords: input.itgluePasswords,
        itglueConfigs: input.itglueConfigs,
        itglueAssets: input.itglueAssets,
        docs: input.docs,
    });
    const firewallValue = input.pickEnrichedValue(input.itglueEnriched, 'firewall_make_model');
    const wifiValue = input.pickEnrichedValue(input.itglueEnriched, 'wifi_make_model');
    const switchValue = input.pickEnrichedValue(input.itglueEnriched, 'switch_make_model');
    const makeEnriched = (value: string) => ({
        value,
        status: 'inferred' as const,
        confidence: 0.75,
        sourceSystem: 'itglue_llm',
        sourceRef: 'itglue_org_snapshot',
        round: 2,
    });
    const firewall = firewallValue
        ? makeEnriched(firewallValue)
        : metadataCandidates.firewall || input.extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
    const wifi = wifiValue
        ? makeEnriched(wifiValue)
        : metadataCandidates.wifi || input.extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
    const sw = switchValue
        ? makeEnriched(switchValue)
        : metadataCandidates.switch || input.extractInfraMakeModel('switch', input.itglueConfigs, input.docs);

    return {
        firewall_make_model: buildField({
            value: firewall.value,
            status: firewall.status,
            confidence: firewall.confidence,
            sourceSystem: firewall.sourceSystem,
            sourceRef: firewall.sourceRef,
            round: firewall.round,
        }),
        wifi_make_model: buildField({
            value: wifi.value,
            status: wifi.status,
            confidence: wifi.confidence,
            sourceSystem: wifi.sourceSystem,
            sourceRef: wifi.sourceRef,
            round: wifi.round,
        }),
        switch_make_model: buildField({
            value: sw.value,
            status: sw.status,
            confidence: sw.confidence,
            sourceSystem: sw.sourceSystem,
            sourceRef: sw.sourceRef,
            round: sw.round,
        }),
    };
}

export function inferIspName(input: { ticketNarrative: string; docs: Doc[]; itglueConfigs: any[] }): string {
    const narrative = String(input.ticketNarrative || '').toLowerCase();
    const providers = ['Comcast', 'Verizon', 'AT&T', 'Spectrum', 'Cox', 'Frontier', 'CenturyLink', 'Windstream', 'Optimum', 'Google Fiber'];
    for (const p of providers) {
        if (narrative.includes(p.toLowerCase())) return p;
    }
    return '';
}

export function extractInfraMakeModel(type: string, configs: any[], docs: any[]): any {
    return { value: 'unknown', status: 'unknown' as const, confidence: 0, sourceSystem: 'unknown', round: 1 };
}

export function extractITGlueInfraCandidates(input: any): any {
    return { firewall: null, wifi: null, switch: null };
}

export function extractITGlueWanCandidate(input: any): any {
    return null;
}

export function parseMakeModel(text: string): { vendor: string; model: string } | null {
    if (!text || text === 'unknown') return null;
    const parts = text.split(/\s+/);
    if (parts.length < 2) return { vendor: parts[0] || 'Unknown', model: 'Generic' };
    return { vendor: parts[0], model: parts.slice(1).join(' ') };
}

export function normalizeSimpleToken(text: string): string {
    return String(text || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function pickEnrichedValue(payload: ItglueEnrichedPayload | null, key: string): string | null {
  if (!payload || !payload.fields) return null;
  const field = payload.fields[key];
  if (!field || field.confidence < 0.6) return null;
  return field.value || null;
}
