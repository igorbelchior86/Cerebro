// ─────────────────────────────────────────────────────────────
// History Resolver
// Related case discovery, search-term planning, LLM-based
// history calibration, and final-refinement planning.
// ─────────────────────────────────────────────────────────────
import { query } from '../../db/index.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import type { RelatedCase } from '@cerebro/types';
import {
  extractInfraMakeModel,
  inferIspName,
  inferPhoneProvider
} from './ticket-normalizer.js';
import {
  flattenEnrichmentFields,
  generateNameAliases,
  extractEmails,
  extractSoftwareHintsFromTicket,
  getEnrichmentFieldByPath,
  setEnrichmentFieldByPath,
  buildField,
  buildEndpointEnrichmentSection,
} from './prepare-context-helpers.js';
import type {
  IterativeEnrichmentSections,
  TicketContextAppendix,
  HistoryCalibrationResult,
  Doc,
  TicketLike,
  Signal,
  EnrichmentField,
  SecurityAgentSummary,
} from './prepare-context.types.js';

type JsonRecord = Record<string, unknown>;
type NormalizedTicketLike = {
  descriptionClean?: string;
  descriptionUi?: string;
  symptoms?: string[];
  technologyFacets?: string[];
  deviceHints?: string[];
};
type HistoryEnrichmentEngineLike = {
  inferVpnState?: (signals: Signal[], ticketNarrative: string) => 'connected' | 'disconnected' | 'unknown';
  resolvePublicIp?: (device: unknown | null, deviceDetails: unknown | null) => string;
};
type EndpointSectionInput = Parameters<typeof buildEndpointEnrichmentSection>[0];

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asJsonRecordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => asJsonRecord(item)) : [];
}

export async function findRelatedCases(ticketTitle: string, orgId?: string, companyName?: string): Promise<RelatedCase[]> {
  return findRelatedCasesByTerms([ticketTitle], orgId, companyName);
}

export function buildBroadHistorySearchPlan(input: {
  ticket: TicketLike;
  ticketNarrative: string;
  normalizedTicket: NormalizedTicketLike | null;
  sections: IterativeEnrichmentSections;
  docs: Doc[];
  fusionAudit?: Record<string, unknown>;
}): { terms: string[]; strategies: string[] } {
  const termScores = new Map<string, number>();
  const strategies = new Set<string>(['email-fallback-local-history']);

  const addPhrase = (value: unknown, weight: number, strategy: string) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower === 'unknown' || lower === 'none' || lower === 'n/a') return;
    if (text.length > 120) return;
    termScores.set(text, Math.max(weight, termScores.get(text) || 0));
    strategies.add(strategy);
  };
  const addTokenized = (value: unknown, weight: number, strategy: string) => {
    const tokens = String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9._-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);
    for (const token of tokens.slice(0, 12)) {
      if (/^(the|and|for|with|from|this|that|ticket|issue|hello|please|thanks|support|team|user|email|outside)$/i.test(token)) {
        continue;
      }
      addPhrase(token, weight, strategy);
    }
  };

  const fields = flattenEnrichmentFields(input.sections);
  const preferredPaths = new Set([
    'ticket.company',
    'ticket.requester_name',
    'ticket.requester_email',
    'ticket.affected_user_name',
    'ticket.affected_user_email',
    'identity.user_principal_name',
    'endpoint.device_name',
    'endpoint.user_signed_in',
    'network.isp_name',
    'network.public_ip',
    'infra.firewall_make_model',
    'infra.wifi_make_model',
    'infra.switch_make_model',
  ]);
  for (const record of fields) {
    if (!preferredPaths.has(record.path)) continue;
    if (record.field.status === 'unknown') continue;
    addPhrase(record.field.value, 1, 'fused_ssot');
    addTokenized(record.field.value, 0.8, 'fused_ssot');
    if (String(record.path).includes('user_name')) {
      for (const alias of generateNameAliases(String(record.field.value || ''))) {
        addPhrase(alias, 0.95, 'identity_alias');
      }
    }
    if (String(record.path).includes('email')) {
      const email = String(record.field.value || '').toLowerCase();
      addPhrase(email, 1, 'identity_email');
      addPhrase(email.split('@')[0] || '', 0.95, 'identity_email_local');
    }
  }

  addPhrase(input.ticket.title, 0.95, 'ticket_title');
  addPhrase(input.normalizedTicket?.descriptionClean, 0.8, 'ticket_clean');
  addPhrase(input.normalizedTicket?.descriptionUi, 0.75, 'ticket_ui');
  for (const symptom of (input.normalizedTicket?.symptoms || []).slice(0, 12)) addPhrase(symptom, 0.9, 'ticket_symptom');
  for (const tech of (input.normalizedTicket?.technologyFacets || []).slice(0, 12)) addPhrase(tech, 0.85, 'ticket_tech');
  for (const hint of (input.normalizedTicket?.deviceHints || []).slice(0, 8)) addPhrase(hint, 0.85, 'ticket_device_hint');

  for (const domain of extractEmails(`${input.ticketNarrative} ${input.normalizedTicket?.descriptionClean || ''}`)) {
    addPhrase(domain, 0.95, 'domain');
    addPhrase(domain.split('.')[0] || '', 0.8, 'domain_root');
  }
  for (const software of extractSoftwareHintsFromTicket(input.ticketNarrative)) {
    addPhrase(software, 0.95, 'software_hint');
  }
  for (const doc of input.docs.slice(0, 10)) {
    addPhrase(doc.title, 0.6, 'itglue_doc_title');
    addTokenized(doc.title, 0.45, 'itglue_doc_title');
  }

  const fusionAudit = asJsonRecord(input.fusionAudit);
  const fusionLinks = asJsonRecordArray(fusionAudit.links);
  const fusionInferences = asJsonRecordArray(fusionAudit.inferences);
  const fusionResolutions = asJsonRecordArray(fusionAudit.resolutions);
  for (const link of fusionLinks.slice(0, 20)) {
    addPhrase(link?.note, 0.6, 'fusion_link_note');
    addTokenized(link?.from_entity, 0.55, 'fusion_link_entity');
    addTokenized(link?.to_entity, 0.55, 'fusion_link_entity');
  }
  for (const inf of fusionInferences.slice(0, 20)) {
    addPhrase(inf?.claim, 0.65, 'fusion_inference_claim');
  }
  for (const res of fusionResolutions.slice(0, 20)) {
    addPhrase(res?.value, 0.75, 'fusion_resolution');
  }

  const ranked = [...termScores.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([term]) => term)
    .filter(Boolean);

  return {
    terms: ranked.slice(0, 28),
    strategies: [...strategies],
  };
}

export function buildFinalRefinementPlan(input: {
  sections: IterativeEnrichmentSections;
  missingData: Array<{ field: string; why: string }>;
  fusionAudit?: Record<string, unknown>;
  historyCalibration?: TicketContextAppendix['history_confidence_calibration'];
  historyCorrelation?: TicketContextAppendix['history_correlation'];
}): { targets: string[]; terms: string[] } {
  const targets = new Set<string>();
  const terms = new Set<string>();

  for (const m of input.missingData.slice(0, 20)) {
    if (m?.field) targets.add(String(m.field));
    for (const token of String(m?.why || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
      if (token.length >= 4 && !/(failed|error|unknown|resolve|deterministically)/.test(token)) terms.add(token);
    }
  }
  for (const record of flattenEnrichmentFields(input.sections)) {
    if (record.field.status === 'unknown' || record.field.status === 'conflict') {
      targets.add(record.path);
    }
  }
  const conflicts = asJsonRecordArray(asJsonRecord(input.fusionAudit).conflicts);
  for (const c of conflicts.slice(0, 10)) {
    if (c?.field) targets.add(String(c.field));
    for (const token of String(c?.note || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
      if (token.length >= 4) terms.add(token);
    }
  }
  for (const adj of input.historyCalibration?.field_adjustments || []) {
    if (adj.action === 'decrease' || adj.action === 'context_only') targets.add(adj.path);
  }
  for (const contradiction of input.historyCalibration?.contradictions || []) {
    targets.add(contradiction.path);
    for (const v of contradiction.observed_values) {
      for (const token of String(v || '').toLowerCase().split(/[^a-z0-9._-]+/)) {
        if (token.length >= 3) terms.add(token);
      }
    }
  }
  for (const t of input.historyCorrelation?.search_terms?.slice(0, 12) || []) {
    if (String(t || '').trim()) terms.add(String(t));
  }
  return {
    targets: [...targets].slice(0, 20),
    terms: [...terms].map((t) => t.trim()).filter(Boolean).sort((a, b) => b.length - a.length).slice(0, 24),
  };
}

export function shouldRunFinalNinjaRefinement(input: {
  sections: IterativeEnrichmentSections;
  finalRefinementPlanTargets: string[];
  currentDevice: unknown | null;
}): boolean {
  if (!input.currentDevice) return true;
  if (input.finalRefinementPlanTargets.some((target) => /(device|endpoint|vpn|public_ip|user_signed_in)/.test(target))) {
    return true;
  }
  return (
    input.sections.endpoint.device_name.status !== 'confirmed' ||
    input.sections.endpoint.user_signed_in.status === 'unknown' ||
    input.sections.network.public_ip.status === 'unknown' ||
    input.sections.network.vpn_state.status === 'unknown'
  );
}

export async function findRelatedCasesBroad(input: {
  ticketId?: string;
  orgId?: string;
  companyName?: string;
  terms: string[];
}): Promise<RelatedCase[]> {
  const normalizedTerms = normalizeHistoryTerms(input.terms);
  if (normalizedTerms.length === 0) return [];
  try {
    const rows = await query<{
      ticket_id: string;
      symptom_text: string;
      resolution_text: string;
      resolved_at: string;
    }>(
      `
      SELECT
        t.ticket_id,
        COALESCE(string_agg(DISTINCT l.payload->>'summary', ' || '), '') AS symptom_text,
        COALESCE(string_agg(DISTINCT l.payload->>'content', ' || '), '') AS resolution_text,
        max(t.updated_at) AS resolved_at
      FROM triage_sessions t
      LEFT JOIN llm_outputs l ON t.id = l.session_id
      LEFT JOIN tickets_processed tp ON tp.id = t.ticket_id
      LEFT JOIN ticket_ssot tsot ON tsot.ticket_id = t.ticket_id
      WHERE t.status = 'approved'
      ${input.orgId ? 'AND t.org_id = $1' : ''}
      ${input.companyName ? `AND lower(coalesce(tsot.payload->>'company', '')) = lower($${input.orgId ? 2 : 1})` : ''}
      ${input.ticketId ? `AND t.ticket_id <> $${input.orgId ? (input.companyName ? 3 : 2) : (input.companyName ? 2 : 1)}` : ''}
      GROUP BY t.ticket_id
      ORDER BY max(t.updated_at) DESC
      LIMIT 250
      `,
      [
        ...(input.orgId ? [input.orgId] : []),
        ...(input.companyName ? [input.companyName] : []),
        ...(input.ticketId ? [input.ticketId] : []),
      ]
    );

    const scored = rows
      .map((row) => {
        const haystack = `${row.ticket_id} ${row.symptom_text} ${row.resolution_text}`.toLowerCase();
        const match = scoreHistoryCandidate(haystack, normalizedTerms);
        return {
          row,
          score: match.score,
          matchedTerms: match.matchedTerms,
        };
      })
      .filter((entry) => entry.score > 0 && entry.matchedTerms.length > 0)
      .sort((a, b) => b.score - a.score || String(b.row.resolved_at || '').localeCompare(String(a.row.resolved_at || '')))
      .slice(0, 6);

    return scored.map(({ row }) => ({
      ticket_id: row.ticket_id,
      symptom: String(row.symptom_text || '').slice(0, 1200),
      resolution: String(row.resolution_text || '').slice(0, 1600),
      resolved_at: row.resolved_at,
    }));
  } catch (error) {
    operationalLogger.warn('context.history_resolver.broad_search_failed', {
      module: 'services.context.history-resolver',
      org_id: input.orgId || null,
      company_name: input.companyName || null,
      ticket_id: input.ticketId || null,
      terms_count: normalizedTerms.length,
      signal: 'integration_failure',
      degraded_mode: true,
      error_message: String((error as Error)?.message || error),
    }, {
      ticket_id: input.ticketId || null,
    });
    return [];
  }
}

export async function findRelatedCasesByTerms(terms: string[], orgId?: string, companyName?: string): Promise<RelatedCase[]> {
  try {
    const broad = await findRelatedCasesBroad({
      ...(orgId ? { orgId } : {}),
      ...(!orgId && companyName ? { companyName } : {}),
      terms,
    });
    if (broad.length > 0) return broad.slice(0, 3);

    const keyword = pickHistoryKeyword(terms);
    const fallback = await findRelatedCasesBroad({
      ...(orgId ? { orgId } : {}),
      ...(!orgId && companyName ? { companyName } : {}),
      terms: [keyword],
    });
    return fallback.slice(0, 3);
  } catch (error) {
    operationalLogger.warn('context.history_resolver.related_cases_failed', {
      module: 'services.context.history-resolver',
      org_id: orgId || null,
      company_name: companyName || null,
      terms_count: terms.length,
      signal: 'integration_failure',
      degraded_mode: true,
      error_message: String((error as Error)?.message || error),
    });
    return [];
  }
}

export function normalizeHistoryTerms(terms: string[]): Array<{ term: string; normalized: string; weight: number }> {
  const out = new Map<string, { term: string; normalized: string; weight: number }>();
  for (const rawTerm of terms) {
    const term = String(rawTerm || '').replace(/\s+/g, ' ').trim();
    if (!term) continue;
    if (term.length < 3) continue;
    if (term.length > 120) continue;
    const lower = term.toLowerCase();
    if (['unknown', 'none', 'n/a', 'null', 'false', 'true'].includes(lower)) continue;
    const normalized = lower.replace(/[^a-z0-9.@_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    let weight = 1;
    if (/@/.test(term)) weight += 0.35;
    if (/\./.test(term) && /[a-z]/i.test(term)) weight += 0.25;
    if (term.includes(' ')) weight += 0.2;
    if (normalized.length >= 8) weight += 0.1;
    const existing = out.get(normalized);
    if (!existing || weight > existing.weight) {
      out.set(normalized, { term, normalized, weight: Number(Math.min(2, weight).toFixed(2)) });
    }
  }
  return [...out.values()]
    .sort((a, b) => b.weight - a.weight || b.normalized.length - a.normalized.length)
    .slice(0, 32);
}

export function scoreHistoryCandidate(
  haystack: string,
  terms: Array<{ term: string; normalized: string; weight: number }>
): { score: number; matchedTerms: string[] } {
  let score = 0;
  const matchedTerms: string[] = [];
  const tokenSet = new Set(
    haystack
      .split(/[^a-z0-9.@_-]+/)
      .map((t) => t.trim())
      .filter(Boolean)
  );

  for (const term of terms) {
    const exactPhrase = haystack.includes(term.normalized);
    const tokenParts = term.normalized.split(' ').filter(Boolean);
    const allParts = tokenParts.length > 1 && tokenParts.every((part) => tokenSet.has(part));
    const anyToken = tokenParts.some((part) => tokenSet.has(part));
    if (exactPhrase) {
      score += 1.2 * term.weight;
      matchedTerms.push(term.term);
      continue;
    }
    if (allParts) {
      score += 0.75 * term.weight;
      matchedTerms.push(term.term);
      continue;
    }
    if (anyToken && term.normalized.length >= 6) {
      score += 0.35 * term.weight;
      matchedTerms.push(term.term);
    }
  }

  const uniqueMatches = [...new Set(matchedTerms)];
  if (uniqueMatches.length >= 3) score += 0.8;
  if (uniqueMatches.length >= 5) score += 0.6;
  return {
    score: Number(score.toFixed(3)),
    matchedTerms: uniqueMatches.slice(0, 12),
  };
}

export function applyFinalRefinementToEnrichment(input: {
  sections: IterativeEnrichmentSections;
  ticketNarrative: string;
  docs: Doc[];
  itglueConfigs: JsonRecord[];
  itgluePasswords: JsonRecord[];
  signals: Signal[];
  device: unknown | null;
  deviceDetails: unknown | null;
  loggedInUser: string;
  loggedInAt: string;
  enrichmentEngine?: HistoryEnrichmentEngineLike;
}): string[] {
  const updatedPaths: string[] = [];
  const patchIfBetter = (path: string, nextField: EnrichmentField<unknown>) => {
    const current = getEnrichmentFieldByPath(input.sections, path);
    if (!current) return;
    const nextUnknown = nextField.status === 'unknown' || Number(nextField.confidence || 0) <= 0;
    if (nextUnknown) return;
    const currentWeak =
      current.status === 'unknown' ||
      current.status === 'conflict' ||
      Number(current.confidence || 0) < 0.5;
    const improves = currentWeak || Number(nextField.confidence || 0) > Number(current.confidence || 0) + 0.05;
    if (!improves) return;
    setEnrichmentFieldByPath(input.sections, path, nextField);
    updatedPaths.push(path);
  };

  const firewall = extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
  patchIfBetter('infra.firewall_make_model', buildField({
    value: firewall.value,
    status: firewall.status,
    confidence: firewall.confidence,
    sourceSystem: firewall.sourceSystem,
    sourceRef: firewall.sourceRef,
    round: 9,
  }));
  const wifi = extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
  patchIfBetter('infra.wifi_make_model', buildField({
    value: wifi.value,
    status: wifi.status,
    confidence: wifi.confidence,
    sourceSystem: wifi.sourceSystem,
    sourceRef: wifi.sourceRef,
    round: 9,
  }));
  const sw = extractInfraMakeModel('switch', input.itglueConfigs, input.docs);
  patchIfBetter('infra.switch_make_model', buildField({
    value: sw.value,
    status: sw.status,
    confidence: sw.confidence,
    sourceSystem: sw.sourceSystem,
    sourceRef: sw.sourceRef,
    round: 9,
  }));

  const isp = inferIspName({ ticketNarrative: input.ticketNarrative, docs: input.docs, itglueConfigs: input.itglueConfigs });
  if (isp) {
    patchIfBetter('network.isp_name', buildField({
      value: isp,
      status: 'inferred',
      confidence: 0.78,
      sourceSystem: 'final_refinement',
      sourceRef: 'itglue configs+docs + ticket narrative (round9)',
      round: 9,
    }));
  }
  const phoneProviderName = inferPhoneProvider({
    ticketText: input.ticketNarrative,
    docs: input.docs,
    itglueConfigs: input.itglueConfigs,
    itgluePasswords: input.itgluePasswords,
    signals: input.signals,
  });
  if (phoneProviderName) {
    patchIfBetter('network.phone_provider', buildField({
      value: 'connected',
      status: 'inferred',
      confidence: 0.73,
      sourceSystem: 'final_refinement',
      sourceRef: 'ticket+itglue+ninja signals round9',
      round: 9,
    }));
    patchIfBetter('network.phone_provider_name', buildField({
      value: phoneProviderName,
      status: 'inferred',
      confidence: 0.76,
      sourceSystem: 'final_refinement',
      sourceRef: 'provider keyword match round9',
      round: 9,
    }));
  }

  if (input.device || input.deviceDetails) {
    const endpointFallbackEngine = {
      inferDeviceType: (): 'unknown' => 'unknown',
      normalizeTimeValue: (value: string) => String(value || ''),
      inferSecurityAgent: (): SecurityAgentSummary => ({ state: 'unknown', name: 'unknown' }),
      inferLocationContext: (): 'unknown' => 'unknown',
      resolvePublicIp: (): string => '',
      inferVpnState: (): 'unknown' => 'unknown',
    };
    const endpointSection = buildEndpointEnrichmentSection({
      ticketNarrative: input.ticketNarrative,
      device: input.device as EndpointSectionInput['device'],
      deviceDetails: input.deviceDetails as EndpointSectionInput['deviceDetails'],
      loggedInUser: input.loggedInUser,
      loggedInAt: input.loggedInAt,
      ninjaChecks: input.signals.filter((s) => s.source === 'ninja'),
      enrichmentEngine: endpointFallbackEngine,
    });
    patchIfBetter('endpoint.device_name', { ...endpointSection.device_name, round: 9 });
    patchIfBetter('endpoint.device_type', { ...endpointSection.device_type, round: 9 });
    patchIfBetter('endpoint.os_name', { ...endpointSection.os_name, round: 9 });
    patchIfBetter('endpoint.os_version', { ...endpointSection.os_version, round: 9 });
    patchIfBetter('endpoint.last_check_in', { ...endpointSection.last_check_in, round: 9 });
    patchIfBetter('endpoint.user_signed_in', { ...endpointSection.user_signed_in, round: 9 });
  }

  const vpnState = input.enrichmentEngine?.inferVpnState?.(input.signals, input.ticketNarrative) || 'unknown';
  patchIfBetter('network.vpn_state', buildField({
    value: vpnState,
    status: vpnState === 'unknown' ? 'unknown' : 'inferred',
    confidence: vpnState === 'unknown' ? 0 : 0.68,
    sourceSystem: 'final_refinement',
    sourceRef: 'ninja signals round9',
    round: 9,
  }));
  const publicIp = input.enrichmentEngine?.resolvePublicIp?.(input.device, input.deviceDetails);
  if (publicIp) {
    patchIfBetter('network.public_ip', buildField({
      value: publicIp,
      status: 'confirmed',
      confidence: 0.84,
      sourceSystem: 'ninjaone',
      sourceRef: 'ninja final refinement selected device',
      round: 9,
    }));
  }

  return [...new Set(updatedPaths)];
}

export function applyHistoryConfidenceCalibration(input: {
  sections: IterativeEnrichmentSections;
  relatedCases: RelatedCase[];
}): HistoryCalibrationResult {
  const next: IterativeEnrichmentSections = {
    ticket: { ...input.sections.ticket },
    identity: { ...input.sections.identity },
    endpoint: { ...input.sections.endpoint },
    network: { ...input.sections.network },
    infra: { ...input.sections.infra },
  };
  const fields = flattenEnrichmentFields(next);
  const trackedPaths = new Set([
    'ticket.affected_user_name',
    'ticket.affected_user_email',
    'identity.user_principal_name',
    'endpoint.device_name',
    'endpoint.user_signed_in',
    'network.isp_name',
    'infra.firewall_make_model',
    'infra.wifi_make_model',
    'infra.switch_make_model',
  ]);
  const caseHaystacks = input.relatedCases.map((rc) => ({
    ticket_id: rc.ticket_id,
    text: `${rc.ticket_id} ${rc.symptom || ''} ${rc.resolution || ''}`.toLowerCase(),
  }));

  const fieldAdjustments: NonNullable<TicketContextAppendix['history_confidence_calibration']>['field_adjustments'] = [];
  const contradictions: NonNullable<TicketContextAppendix['history_confidence_calibration']>['contradictions'] = [];

  for (const record of fields) {
    if (!trackedPaths.has(record.path)) continue;
    const currentValue = String(record.field.value || '').trim();
    if (!currentValue || currentValue.toLowerCase() === 'unknown') continue;

    const supportTerms = buildHistorySupportTermsForField(record.path, currentValue);
    if (supportTerms.length === 0) continue;

    const supportCaseIds: string[] = [];
    for (const hc of caseHaystacks) {
      const hits = supportTerms.filter((term) => hc.text.includes(term));
      if (hits.length === 0) continue;
      const phraseHit = hc.text.includes(currentValue.toLowerCase());
      if (phraseHit || hits.length >= Math.min(2, supportTerms.length)) {
        supportCaseIds.push(hc.ticket_id);
      }
    }

    const contradictionCaseIds: string[] = [];
    if (record.path === 'network.isp_name') {
      const currentIsp = inferIspName({ ticketNarrative: currentValue, docs: [], itglueConfigs: [] });
      if (currentIsp) {
        const altProviders = new Set<string>();
        for (const hc of caseHaystacks) {
          const observed = inferIspName({ ticketNarrative: hc.text, docs: [], itglueConfigs: [] });
          if (!observed) continue;
          const providerContextLikely =
            hc.text.includes('dns') ||
            hc.text.includes('internet') ||
            hc.text.includes('comcast') ||
            hc.text.includes('xfinity') ||
            hc.text.includes('verizon');
          if (observed !== currentIsp && providerContextLikely) {
            altProviders.add(observed);
            contradictionCaseIds.push(hc.ticket_id);
          }
        }
        if (altProviders.size > 0) {
          contradictions.push({
            path: record.path,
            current_value: currentValue,
            observed_values: [...altProviders].slice(0, 5),
            case_ids: [...new Set(contradictionCaseIds)].slice(0, 8),
            note: 'Historical cases mention a different ISP/provider in similar context; verify current site/provider before diagnosis.',
          });
        }
      }
    }

    const prevConfidence = Number(record.field.confidence || 0);
    let delta = 0;
    let action: 'boost' | 'decrease' | 'context_only' = 'context_only';
    let reason = 'Historical cases are contextual only';
    if (supportCaseIds.length > 0) {
      delta += Math.min(0.15, 0.04 * supportCaseIds.length);
      action = 'boost';
      reason = `Historical matches support ${record.path} via repeated terms (${supportCaseIds.length} case(s))`;
    }
    if (contradictionCaseIds.length > 0) {
      const penalty = Math.min(0.12, 0.05 * contradictionCaseIds.length);
      delta -= penalty;
      action = delta >= 0 ? action : 'decrease';
      reason = supportCaseIds.length > 0
        ? 'Historical support exists but contradictory provider evidence reduced confidence'
        : 'Historical contradictions reduced confidence pending confirmation';
    }

    if (Math.abs(delta) < 0.0001) {
      fieldAdjustments.push({
        path: record.path,
        action: 'context_only',
        delta_confidence: 0,
        previous_confidence: Number(prevConfidence.toFixed(3)),
        new_confidence: Number(prevConfidence.toFixed(3)),
        support_case_ids: [...new Set(supportCaseIds)].slice(0, 8),
        ...(contradictionCaseIds.length ? { contradiction_case_ids: [...new Set(contradictionCaseIds)].slice(0, 8) } : {}),
        reason,
      });
      continue;
    }

    const newConfidence = Number(Math.max(0, Math.min(1, prevConfidence + delta)).toFixed(3));
    const adjustedField = buildField({
      value: record.field.value,
      status: record.field.status,
      confidence: newConfidence,
      sourceSystem: String(record.field.source_system || 'history_calibrated'),
      sourceRef: [
        record.field.source_ref || record.path,
        `history_calibration:${action}`,
        ...[...new Set(supportCaseIds)].slice(0, 3).map((id) => `case:${id}`),
      ].join(' | '),
      round: Math.max(8, Number(record.field.round || 1)),
      observedAt: record.field.observed_at,
    });
    setEnrichmentFieldByPath(next, record.path, adjustedField);
    fieldAdjustments.push({
      path: record.path,
      action,
      delta_confidence: Number(delta.toFixed(3)),
      previous_confidence: Number(prevConfidence.toFixed(3)),
      new_confidence: newConfidence,
      support_case_ids: [...new Set(supportCaseIds)].slice(0, 8),
      ...(contradictionCaseIds.length ? { contradiction_case_ids: [...new Set(contradictionCaseIds)].slice(0, 8) } : {}),
      reason,
    });
  }

  return {
    sections: next,
    appendix: {
      round: 8,
      field_adjustments: fieldAdjustments,
      contradictions,
    },
  };
}

export function buildHistorySupportTermsForField(path: string, currentValue: string): string[] {
  const terms = new Set<string>();
  const raw = String(currentValue || '').trim().toLowerCase();
  if (!raw || raw === 'unknown') return [];
  terms.add(raw);
  for (const token of raw.split(/[^a-z0-9.@_-]+/).filter(Boolean)) {
    if (token.length >= 3) terms.add(token);
  }
  if (path.includes('user_name')) {
    for (const alias of generateNameAliases(currentValue)) {
      if (alias.length >= 3) terms.add(alias);
    }
  }
  if (path.includes('email')) {
    const local = raw.split('@')[0] || '';
    const domain = raw.split('@')[1] || '';
    if (local.length >= 3) terms.add(local);
    if (domain.length >= 3) terms.add(domain);
  }
  if (path === 'network.isp_name') {
    const canonical = inferIspName({ ticketNarrative: currentValue, docs: [], itglueConfigs: [] });
    if (canonical) terms.add(canonical.toLowerCase());
    if (/comcast/i.test(currentValue)) terms.add('xfinity');
    if (/xfinity/i.test(currentValue)) terms.add('comcast');
  }
  return [...terms].slice(0, 12);
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

/**
 * Mapeia prioridade do Autotask para formato padronizado
 */
