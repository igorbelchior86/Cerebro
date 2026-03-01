import type { ITGlueClient } from '../../clients/itglue.js';

export function itgAttr(attrs: Record<string, unknown> | null | undefined, key: string): unknown {
    if (!attrs) return undefined;
    if (key in attrs) return attrs[key];

    const genericKeys = Object.keys(attrs).filter((k) => k.startsWith(key));
    if (genericKeys.length > 0) {
        const found = genericKeys.map((k) => ({ key: k, value: attrs[k] })).find((x) => x.value !== null && x.value !== undefined);
        if (found?.value) return found.value;
    }

    return undefined;
}

export function parseITGlueOrgParentId(org: any): string | null {
    const attrs = org?.attributes || {};
    const value = itgAttr(attrs, 'parent_id');
    const text = String(value ?? '').trim();
    return text ? text : null;
}

export function parseITGlueOrgAncestorIds(org: any): string[] {
    const attrs = org?.attributes || {};
    const raw = itgAttr(attrs, 'ancestor_ids');
    if (Array.isArray(raw)) {
        return raw.map((v) => String(v || '').trim()).filter(Boolean);
    }
    const text = String(raw ?? '').trim();
    if (!text) return [];
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
    } catch {
        // no-op
    }
    return text
        .split(/[,\s|]+/)
        .map((v) => String(v || '').trim())
        .filter(Boolean);
}

export function normalizeName(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
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
        'resource', 'resources', 'technology', 'technologies', 'solution', 'solutions', 'service', 'services',
        'system', 'systems', 'group', 'global', 'international', 'management', 'consulting', 'support',
        'partners', 'network', 'networks', 'communications', 'communication', 'company', 'companies', 'holdings',
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
        const distinctCoverage = distinctOverlap.length / Math.max(Math.min(Math.max(nDistinct.length, 1), Math.max(cDistinct.length, 1)), 1);

        let score = 0.35 * coverageMin + 0.25 * coverageMax + 0.4 * distinctCoverage;

        const acronym = nDistinct.map((t) => t[0]).join('');
        if (acronym && (c.includes(acronym) || rawC.includes(acronym))) {
            score = Math.max(score, 0.72);
        }

        best = Math.max(best, score);
    }

    return best;
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

export async function resolveITGlueOrg(
    itglueClient: ITGlueClient,
    companyName: string,
    hintText?: string
): Promise<{ id: string; name: string } | null> {
    const orgs = await itglueClient.getOrganizations(1000);
    const rankedByName = orgs
        .map((o: any) => ({
            org: o,
            score: scoreOrgNameMatch(companyName, String(itgAttr(o?.attributes || {}, 'name') || ''), String(itgAttr(o?.attributes || {}, 'short_name') || '')),
        }))
        .filter((r) => r.score >= 0.8)
        .sort((a, b) => b.score - a.score);
    const byName = rankedByName[0]?.org;
    if (byName) {
        return { id: String(byName.id), name: String(itgAttr(byName?.attributes || {}, 'name') || companyName) };
    }

    const ignoreDomainSuffixes = [
        'outlook.com', 'office.com', 'microsoft.com', 'autotask.net', 'itclientportal.com',
        'safelinks.protection.outlook.com', 'protection.outlook.com', 'refreshtech.com',
    ];
    const domains = extractEmailDomains(hintText || '').filter((d) => !ignoreDomainSuffixes.some((suffix) => d === suffix || d.endsWith(`.${suffix}`)));
    if (domains.length === 0) return null;

    const rankedByDomain = orgs
        .map((o: any) => {
            const primaryDomain = String(itgAttr(o?.attributes || {}, 'primary_domain') || '').toLowerCase();
            const domainScore =
                primaryDomain && domains.some((d) => d === primaryDomain)
                    ? 1
                    : primaryDomain && domains.some((d) => d.endsWith(`.${primaryDomain}`) || primaryDomain.endsWith(`.${d}`))
                        ? 0.8
                        : 0;
            const nameScore = scoreOrgNameMatch(
                companyName,
                String(itgAttr(o?.attributes || {}, 'name') || ''),
                String(itgAttr(o?.attributes || {}, 'short_name') || '')
            );
            return { org: o, score: domainScore > 0 ? domainScore * 0.75 + nameScore * 0.25 : 0 };
        })
        .filter((r) => r.score >= 0.75)
        .sort((a, b) => b.score - a.score);

    const byDomain = rankedByDomain[0]?.org;
    return byDomain ? { id: String(byDomain.id), name: String(itgAttr(byDomain?.attributes || {}, 'name') || companyName) } : null;
}

export async function resolveITGlueOrgFamilyScopes(
    itglueClient: ITGlueClient,
    matchedOrg: { id: string; name: string },
    companyName?: string
): Promise<Array<{ id: string; name: string; reason: string }>> {
    const orgs = await itglueClient.getOrganizations(1000);
    const byId = new Map<string, any>(orgs.map((org: any): [string, any] => [String(org?.id || '').trim(), org]).filter(([id]) => Boolean(id)));
    const matched = byId.get(String(matchedOrg.id)) || null;
    if (!matched) return [{ id: matchedOrg.id, name: matchedOrg.name, reason: 'matched' }];

    const matchedId = String(matchedOrg.id);
    const matchedAncestors = new Set(parseITGlueOrgAncestorIds(matched));
    const matchedParentId = parseITGlueOrgParentId(matched);
    const familyCandidates: Array<{ org: any; score: number; reason: string; priority: number }> = [];

    const push = (org: any, reason: string, priority: number) => {
        const id = String(org?.id || '').trim();
        if (!id) return;
        const attrs = org?.attributes || {};
        const name = String(itgAttr(attrs, 'name') || '').trim() || id;
        const shortName = String(itgAttr(attrs, 'short_name') || '').trim();
        const score = companyName ? scoreOrgNameMatch(companyName, name, shortName) : 0;
        familyCandidates.push({ org, score, reason, priority });
    };

    push(matched, 'matched', 100);

    if (matchedParentId) {
        const parent = byId.get(matchedParentId);
        if (parent) push(parent, 'parent', 90);
    }
    for (const ancestorId of matchedAncestors) {
        const ancestor = byId.get(ancestorId);
        if (ancestor) push(ancestor, 'ancestor', 80);
    }

    for (const org of orgs) {
        const id = String(org?.id || '').trim();
        if (!id || id === matchedId) continue;
        const parentId = parseITGlueOrgParentId(org);
        const ancestors = parseITGlueOrgAncestorIds(org);
        if (parentId === matchedId || ancestors.includes(matchedId)) {
            push(org, 'descendant', 70);
            continue;
        }
        if (matchedParentId && (id === matchedParentId || parentId === matchedParentId || ancestors.includes(matchedParentId))) {
            push(org, 'sibling_family', 50);
        }
    }

    const deduped = new Map<string, { id: string; name: string; reason: string; score: number; priority: number }>();
    for (const candidate of familyCandidates) {
        const id = String(candidate.org?.id || '').trim();
        const attrs = candidate.org?.attributes || {};
        const name = String(itgAttr(attrs, 'name') || id);
        const existing = deduped.get(id);
        const next = { id, name, reason: candidate.reason, score: candidate.score, priority: candidate.priority };
        if (!existing || candidate.priority > existing.priority || (candidate.priority === existing.priority && candidate.score > existing.score)) {
            deduped.set(id, next);
        }
    }

    const scored = Array.from(deduped.values())
        .filter((x) => x.reason === 'matched' || x.reason === 'parent' || x.reason === 'ancestor' || x.score >= 0.45)
        .sort((a, b) => b.priority - a.priority || b.score - a.score || a.name.localeCompare(b.name))
        .slice(0, 5) // Max scopes e.g. ITGLUE_MAX_SCOPE_ORGS
        .map(({ id, name, reason }) => ({ id, name, reason }));

    return scored.length > 0 ? scored : [{ id: matchedOrg.id, name: matchedOrg.name, reason: 'matched' }];
}
