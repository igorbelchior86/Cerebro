// ─────────────────────────────────────────────────────────────
// Fusion Methods
// Cross-source data fusion: field candidates, links, inferences,
// LLM adjudication, validation, and applying resolutions.
// ─────────────────────────────────────────────────────────────
import {
  normalizeName,
  itgAttr,
  normalizeSimpleToken,
  generateNameAliases,
  extractSoftwareHintsFromTicket,
  flattenEnrichmentFields,
  getEnrichmentFieldByPath,
  setEnrichmentFieldByPath,
  buildField,
} from './prepare-context-helpers.js';
import {
  normalizeFusionResolutionValue,
  isFusionUnknownValue
} from './ticket-normalizer.js';
import type {
  IterativeEnrichmentSections,
  ItglueEnrichedPayload,
  NinjaEnrichedPayload,
  FusionLink,
  FusionInference,
  FusionFieldCandidate,
  FusionFieldResolution,
  FusionAdjudicationOutput,
  TicketLike,
  FacetContext,
} from './prepare-context.types.js';

type JsonRecord = Record<string, unknown>;
type NormalizedTicketLike = {
  affectedUserEmail?: string;
  requesterEmail?: string;
} | null;

function asJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

type DigestAction = { type?: string; action?: string; label?: string; priority?: number; [key: string]: unknown };
type DigestFact = { id?: string | number; kind: string; evidence_refs: string[]; [key: string]: unknown };

export function getFusionSupportedPaths(): Set<string> {
  return new Set([
    'ticket.requester_name',
    'ticket.requester_email',
    'ticket.affected_user_name',
    'ticket.affected_user_email',
    'identity.user_principal_name',
    'identity.account_status',
    'identity.mfa_state',
    'identity.licenses_summary',
    'endpoint.device_name',
    'endpoint.device_type',
    'endpoint.os_name',
    'endpoint.os_version',
    'endpoint.last_check_in',
    'endpoint.user_signed_in',
    'network.public_ip',
    'network.isp_name',
    'network.vpn_state',
    'network.location_context',
    'infra.firewall_make_model',
    'infra.wifi_make_model',
    'infra.switch_make_model',
  ]);
}

export function buildFusionFieldCandidates(input: {
  sections: IterativeEnrichmentSections;
  ticket: TicketLike;
  normalizedTicket: NormalizedTicketLike;
  itglueEnriched: ItglueEnrichedPayload | null;
  ninjaEnriched: NinjaEnrichedPayload | null;
  device: JsonRecord | null;
  deviceDetails: JsonRecord | null;
  loggedInUser: string;
  loggedInAt: string;
}, supportedPaths: Set<string>): FusionFieldCandidate[] {
  const out: FusionFieldCandidate[] = [];
  const push = (candidate: FusionFieldCandidate) => {
    if (!supportedPaths.has(candidate.path)) return;
    const v = candidate.value;
    if (v === undefined || v === null) return;
    if (typeof v === 'string' && !String(v).trim()) return;
    out.push(candidate);
  };

  for (const record of flattenEnrichmentFields(input.sections)) {
    if (!supportedPaths.has(record.path)) continue;
    push({
      path: record.path,
      source: `baseline:${record.field.source_system}`,
      value: record.field.value,
      status: record.field.status,
      confidence: Number(record.field.confidence || 0),
      evidence_refs: [record.field.source_ref || record.path].filter(Boolean),
    });
  }

  const itgMap: Record<string, string> = {
    isp_name: 'network.isp_name',
    firewall_make_model: 'infra.firewall_make_model',
    wifi_make_model: 'infra.wifi_make_model',
    switch_make_model: 'infra.switch_make_model',
  };
  for (const [itKey, path] of Object.entries(itgMap)) {
    const raw = input.itglueEnriched?.fields?.[itKey];
    if (!raw) continue;
    push({
      path,
      source: 'itglue_enriched',
      value: raw.value,
      status: String(raw.value || '').toLowerCase() === 'unknown' ? 'unknown' : 'inferred',
      confidence: Number(raw.confidence || 0),
      evidence_refs: Array.isArray(raw.evidence_refs) ? raw.evidence_refs.map((r) => `itglue.${r}`) : [],
    });
  }

  const ninjaMap: Record<string, string> = {
    device_name: 'endpoint.device_name',
    device_type: 'endpoint.device_type',
    os_name: 'endpoint.os_name',
    os_version: 'endpoint.os_version',
    last_check_in: 'endpoint.last_check_in',
    user_signed_in: 'endpoint.user_signed_in',
    public_ip: 'network.public_ip',
    vpn_state: 'network.vpn_state',
  };
  for (const [nKey, path] of Object.entries(ninjaMap)) {
    const raw = input.ninjaEnriched?.fields?.[nKey];
    if (!raw) continue;
    push({
      path,
      source: 'ninja_enriched',
      value: raw.value,
      status: String(raw.value || '').toLowerCase() === 'unknown' ? 'unknown' : 'inferred',
      confidence: Number(raw.confidence || 0),
      evidence_refs: Array.isArray(raw.evidence_refs) ? raw.evidence_refs.map((r) => `ninja.${r}`) : [],
    });
  }

  push({
    path: 'endpoint.device_name',
    source: 'ninja_selected_device',
    value: String(input.device?.hostname || input.device?.systemName || ''),
    status: input.device ? 'confirmed' : 'unknown',
    confidence: input.device ? 0.9 : 0,
    evidence_refs: ['ninja.selected_device.hostname'],
  });
  push({
    path: 'endpoint.os_name',
    source: 'ninja_selected_device',
    value: String(input.deviceDetails?.osName || input.device?.osName || ''),
    status: (input.deviceDetails || input.device) ? 'confirmed' : 'unknown',
    confidence: (input.deviceDetails || input.device) ? 0.88 : 0,
    evidence_refs: ['ninja.selected_device_details.osName'],
  });
  push({
    path: 'endpoint.os_version',
    source: 'ninja_selected_device',
    value: String(input.deviceDetails?.osVersion || input.device?.osVersion || ''),
    status: (input.deviceDetails || input.device) ? 'confirmed' : 'unknown',
    confidence: (input.deviceDetails || input.device) ? 0.85 : 0,
    evidence_refs: ['ninja.selected_device_details.osVersion'],
  });
  push({
    path: 'endpoint.last_check_in',
    source: 'ninja_selected_device',
    value: String(input.device?.lastContact || input.device?.lastActivityTime || input.loggedInAt || ''),
    status: input.device ? 'confirmed' : 'unknown',
    confidence: input.device ? 0.85 : 0,
    evidence_refs: ['ninja.selected_device.lastContact'],
  });
  push({
    path: 'endpoint.user_signed_in',
    source: 'ninja_last_login',
    value: String(input.loggedInUser || ''),
    status: input.loggedInUser ? 'inferred' : 'unknown',
    confidence: input.loggedInUser ? 0.8 : 0,
    evidence_refs: ['ninja.last_logged_on_user'],
  });
  push({
    path: 'identity.user_principal_name',
    source: 'ticket_normalized',
    value: String(input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail || ''),
    status: input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail ? 'inferred' : 'unknown',
    confidence: input.normalizedTicket?.affectedUserEmail || input.normalizedTicket?.requesterEmail ? 0.7 : 0,
    evidence_refs: ['ticket.normalized.round0'],
  });

  return out
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 200);
}

export function buildFusionLinksAndInferences(input: {
  ticket: TicketLike;
  ticketNarrative: string;
  itglueContacts: JsonRecord[];
  ninjaSoftwareInventory: JsonRecord[];
  device: JsonRecord | null;
  loggedInUser: string;
}): { links: FusionLink[]; inferences: FusionInference[] } {
  const links: FusionLink[] = [];
  const inferences: FusionInference[] = [];
  const loggedUser = normalizeSimpleToken(input.loggedInUser || '');

  const requesterName = normalizeName(String(input.ticket.canonicalRequesterName || input.ticket.requester || ''));
  const affectedName = normalizeName(String(input.ticket.canonicalAffectedName || ''));
  const actorName = affectedName && affectedName.toLowerCase() !== 'unknown' ? affectedName : requesterName;
  const actorAliases = generateNameAliases(actorName);

  if (loggedUser && input.itglueContacts.length > 0) {
    let best: { contact: JsonRecord; score: number; refs: string[]; note: string } | null = null;
    for (const contact of input.itglueContacts.slice(0, 200)) {
      const attrs = asJsonRecord(contact.attributes ?? contact);
      const contactName = normalizeName(String(
        itgAttr(attrs, 'name') ||
        [itgAttr(attrs, 'first_name'), itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
      ));
      const email = String(itgAttr(attrs, 'primary_email') || '').toLowerCase().trim();
      const emailLocal = normalizeSimpleToken(email.split('@')[0] || '');
      const aliases = generateNameAliases(contactName);
      let score = 0;
      const refs: string[] = [];
      if (emailLocal && emailLocal === loggedUser) { score += 0.95; refs.push(`itglue.contact:${contact.id}.primary_email`); }
      if (aliases.has(loggedUser)) { score = Math.max(score, 0.88); refs.push(`itglue.contact:${contact.id}.name_alias`); }
      if (actorAliases.has(loggedUser)) { score = Math.max(score, 0.82); refs.push('ticket.actor_alias'); }
      if (emailLocal && actorAliases.has(emailLocal)) { score = Math.max(score, 0.86); refs.push('ticket.actor_email_alias'); }
      if (score > 0 && (!best || score > best.score)) {
        best = { contact, score, refs: [...new Set(refs)], note: `${contactName || 'contact'} ↔ ${loggedUser}` };
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

  const ticketSoftwareMentions = extractSoftwareHintsFromTicket(input.ticketNarrative);
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

export function buildFusionAdjudicationPrompt(input: {
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

Task:
- Resolve fields using complementary evidence across ticket/email, IT Glue, and NinjaOne.
- DO NOT use "winner source" thinking; sources may complement each other.
- You MAY infer using multi-hop evidence chains (e.g., user name <-> alias <-> last login <-> software on device), but only if you provide evidence_refs and (when inferential) inference_refs.

Rules:
1. Return ONLY valid JSON.
2. If uncertain, prefer status="unknown" or "conflict".
3. For non-unknown resolutions, evidence_refs must be non-empty.
3.1. DO NOT invent evidence sources, systems, people, or inference IDs not present in the provided candidates/links/inferences.
4. Use resolution_mode:
 - direct (single-source direct observation)
 - assembled (complementary multi-source assembly)
 - inferred (heuristic / multi-hop inference)
 - fallback
 - unknown
5. Do not remove existing strong values unless your evidence is stronger or complementary.
6. Enum constraints:
 - identity.account_status: enabled|locked|disabled|unknown
 - identity.mfa_state: enrolled|not_enrolled|unknown
 - endpoint.device_type: desktop|laptop|mobile|unknown
 - network.vpn_state: connected|disconnected|unknown
 - network.location_context: office|remote|unknown

Ticket summary:
${JSON.stringify({
    id: input.ticket.ticketNumber || input.ticket.id || '',
    title: input.ticket.title || '',
    requester: input.ticket.requester || '',
    company: input.ticket.company || '',
  })}

Ticket narrative (normalized+raw context excerpt):
${input.ticketNarrative.slice(0, 2200)}

Field candidates by path:
${JSON.stringify(grouped, null, 2).slice(0, 14000)}

Link candidates:
${JSON.stringify(input.links, null, 2).slice(0, 6000)}

Inference candidates:
${JSON.stringify(input.inferences, null, 2).slice(0, 6000)}

Output schema:
{
"resolutions": [
  {
    "path": "ticket.affected_user_name",
    "value": "new employee (name not provided)",
    "status": "confirmed|inferred|unknown|conflict",
    "confidence": 0.0,
    "resolution_mode": "direct|assembled|inferred|fallback|unknown",
    "evidence_refs": ["..."],
    "inference_refs": ["inf-..."],
    "note": "optional"
  }
],
"links": [],
"inferences": [],
"conflicts": [{"field":"path","note":"...", "evidence_refs":["..."]}]
}`;
}

export function sanitizeFusionAdjudicationOutput(parsed: unknown, supportedPaths: Set<string>): FusionAdjudicationOutput {
  const parsedRecord = asJsonRecord(parsed);
  const resolutions: FusionFieldResolution[] = Array.isArray(parsedRecord.resolutions)
    ? parsedRecord.resolutions
      .map((rawResolution): FusionFieldResolution | null => {
        const resolution = asJsonRecord(rawResolution);
        const path = String(resolution.path || '').trim();
        if (!supportedPaths.has(path)) return null;
        const status = ['confirmed', 'inferred', 'unknown', 'conflict'].includes(String(resolution.status))
          ? String(resolution.status) as FusionFieldResolution['status']
          : 'unknown';
        const resolutionMode = ['direct', 'assembled', 'inferred', 'fallback', 'unknown'].includes(String(resolution.resolution_mode))
          ? String(resolution.resolution_mode) as FusionFieldResolution['resolution_mode']
          : 'unknown';
        const confidence = Number.isFinite(Number(resolution.confidence))
          ? Math.max(0, Math.min(1, Number(resolution.confidence)))
          : 0;
        const evidenceRefs = Array.isArray(resolution.evidence_refs)
          ? resolution.evidence_refs.map(String).filter(Boolean).slice(0, 20)
          : [];
        const inferenceRefs = Array.isArray(resolution.inference_refs)
          ? resolution.inference_refs.map(String).filter(Boolean).slice(0, 20)
          : undefined;
        return {
          path,
          value: resolution.value,
          status,
          confidence,
          resolution_mode: resolutionMode,
          evidence_refs: evidenceRefs,
          ...(inferenceRefs && inferenceRefs.length ? { inference_refs: inferenceRefs } : {}),
          ...(resolution.note ? { note: String(resolution.note).slice(0, 300) } : {}),
        };
      })
      .filter(Boolean) as FusionFieldResolution[]
    : [];
  return {
    resolutions,
    links: Array.isArray(parsedRecord.links) ? parsedRecord.links as FusionLink[] : [],
    inferences: Array.isArray(parsedRecord.inferences) ? parsedRecord.inferences as FusionInference[] : [],
    conflicts: Array.isArray(parsedRecord.conflicts)
      ? parsedRecord.conflicts.map((rawConflict) => {
        const conflict = asJsonRecord(rawConflict);
        const evidenceRefs = Array.isArray(conflict.evidence_refs)
          ? conflict.evidence_refs.map(String)
          : undefined;
        return {
          field: String(conflict.field || ''),
          note: String(conflict.note || ''),
          ...(evidenceRefs ? { evidence_refs: evidenceRefs } : {}),
        };
      })
      : [],
  };
}

export function validateFusionLlmResolutions(input: {
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
  const normalizeCandidateValue = (value: unknown) => normalizeFusionCandidateValueForCompare(value);
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
    const invalidEvidence = refs.some((ref) => !allowedEvidenceRefs.has(ref));
    if (invalidEvidence) {
      continue;
    }
    const invalidInference = infRefs.some((id) => !allowedInferenceIds.has(id));
    if (invalidInference) {
      continue;
    }

    if (guardedIdentityPaths.has(String(resolution.path || ''))) {
      const normalizedValue = normalizeCandidateValue(resolution.value);
      const candidateSet = candidateValuesByPath.get(String(resolution.path || '')) || new Set<string>();
      const hasDeterministicInference = infRefs.length > 0 && infRefs.every((id) => allowedInferenceIds.has(id));
      const isUnknownLike = isFusionUnknownValue(normalizeFusionResolutionValue(resolution.path, resolution.value));
      if (!isUnknownLike && !candidateSet.has(normalizedValue) && !hasDeterministicInference) {
        continue;
      }
    }

    out.push({
      ...resolution,
      evidence_refs: refs,
      ...(infRefs.length ? { inference_refs: infRefs } : {}),
    });
  }
  return out;
}

export function normalizeFusionCandidateValueForCompare(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value).toLowerCase();
    } catch {
      return '';
    }
  }
  return normalizeName(String(value || '')).toLowerCase();
}

export function buildDeterministicFusionFallbackResolutions(input: {
  sections: IterativeEnrichmentSections;
  itglueContacts: JsonRecord[];
  loggedInUser: string;
}, links: FusionLink[]): FusionFieldResolution[] {
  const out: FusionFieldResolution[] = [];
  const identityLink = links
    .filter((l) => l.kind === 'identity_alias')
    .sort((a, b) => b.confidence - a.confidence)[0];
  if (!identityLink || identityLink.confidence < 0.8) return out;
  const contactId = identityLink.from_entity.replace('itglue_contact:', '');
  const contact = input.itglueContacts.find((candidate) => String(candidate.id || '') === contactId);
  const attrs = asJsonRecord(contact?.attributes);
  const name = normalizeName(String(
    itgAttr(attrs, 'name') ||
    [itgAttr(attrs, 'first_name'), itgAttr(attrs, 'last_name')].filter(Boolean).join(' ')
  ));
  const email = String(itgAttr(attrs, 'primary_email') || '').trim().toLowerCase();
  if (name) {
    out.push({
      path: 'ticket.affected_user_name',
      value: name,
      status: 'inferred',
      confidence: Math.min(0.9, identityLink.confidence),
      resolution_mode: 'assembled',
      evidence_refs: identityLink.evidence_refs,
      inference_refs: [`inf-identity-${contactId}`],
      note: 'Deterministic fallback from IT Glue contact ↔ Ninja last-login alias link',
    });
  }
  if (email) {
    out.push({
      path: 'ticket.affected_user_email',
      value: email,
      status: 'inferred',
      confidence: Math.min(0.9, identityLink.confidence),
      resolution_mode: 'assembled',
      evidence_refs: identityLink.evidence_refs,
      inference_refs: [`inf-identity-${contactId}`],
      note: 'Deterministic fallback from IT Glue contact ↔ Ninja last-login alias link',
    });
    out.push({
      path: 'identity.user_principal_name',
      value: email,
      status: 'inferred',
      confidence: Math.min(0.88, identityLink.confidence),
      resolution_mode: 'assembled',
      evidence_refs: identityLink.evidence_refs,
      inference_refs: [`inf-identity-${contactId}`],
    });
  }
  return out;
}

export function applyFusionResolutionsToSections(
  sections: IterativeEnrichmentSections,
  resolutions: FusionFieldResolution[]
): { sections: IterativeEnrichmentSections; appliedCount: number; appliedPaths: string[] } {
  const next: IterativeEnrichmentSections = {
    ticket: { ...sections.ticket },
    identity: { ...sections.identity },
    endpoint: { ...sections.endpoint },
    network: { ...sections.network },
    infra: { ...sections.infra },
  };
  let appliedCount = 0;
  const appliedPaths: string[] = [];

  for (const resolution of resolutions) {
    const current = getEnrichmentFieldByPath(next, resolution.path);
    if (!current) continue;
    const normalized = normalizeFusionResolutionValue(resolution.path, resolution.value);
    const isUnknown = isFusionUnknownValue(normalized);
    if (!isUnknown && (!Array.isArray(resolution.evidence_refs) || resolution.evidence_refs.length === 0)) {
      continue;
    }
    const nextStatus = isUnknown ? 'unknown' : resolution.status;
    const nextConfidence = isUnknown ? 0 : Number(resolution.confidence || 0);

    const currentIsStrong = current.status === 'confirmed' && Number(current.confidence || 0) >= 0.85;
    const incomingIsWeaker =
      nextStatus !== 'conflict' &&
      nextStatus !== 'confirmed' &&
      nextConfidence < Number(current.confidence || 0);
    if (currentIsStrong && incomingIsWeaker) continue;
    if (isUnknown && current.status !== 'unknown') continue;

    const sourceRef = [
      ...(resolution.evidence_refs || []),
      ...((resolution.inference_refs || []).slice(0, 3)),
    ].join(' | ');
    const updated = buildField<unknown>({
      value: normalized,
      status: nextStatus,
      confidence: nextConfidence,
      sourceSystem: resolution.resolution_mode === 'assembled' || resolution.resolution_mode === 'inferred'
        ? 'fusion_graph_llm'
        : 'fusion_direct_llm',
      sourceRef: sourceRef || undefined,
      round: 7,
    });
    setEnrichmentFieldByPath(next, resolution.path, updated);
    appliedCount += 1;
    appliedPaths.push(resolution.path);
  }

  return { sections: next, appliedCount, appliedPaths };
}



// ML & Extraction heuristics extracted to EnrichmentEngine

export function buildFacetActions(facets: FacetContext): DigestAction[] {
  const actions: DigestAction[] = [
    {
      action: 'Confirm current symptom with requester and exact start time',
      evidence_refs: ['kind:ticket'],
      rationale: 'Baseline triage action anchored in ticket narrative',
    },
  ];
  if (facets.symptom.includes('connection')) {
    actions.push({
      action: 'Run endpoint connectivity checks and compare against last known-good baseline',
      evidence_refs: ['kind:signal', 'kind:device'],
    });
  }
  if (facets.symptom.includes('telephony') || facets.technology.includes('goto')) {
    actions.push({
      action: 'Validate VoIP registration and call path from GoTo/FQDN context',
      evidence_refs: ['kind:doc', 'kind:signal'],
    });
  }
  if (facets.symptom.includes('vpn') || facets.technology.includes('fortinet')) {
    actions.push({
      action: 'Verify firewall VPN tunnel state and identity/session logs',
      evidence_refs: ['kind:doc', 'kind:signal'],
    });
  }
  if (facets.requiresCapabilityVerification) {
    actions.push({
      action: 'Confirm device video capability against official vendor specs before final recommendation',
      evidence_refs: ['kind:device', 'kind:doc'],
    });
  }
  return actions;
}

export function resolveEvidenceRefsByKind(kind: string, facts: DigestFact[]): string[] {
  if (kind === 'kind:ticket') {
    return facts.filter((fact) => String(fact.id || "").startsWith('fact-ticket-')).map((fact) => String(fact.id || ""));
  }
  if (kind === 'kind:signal') {
    return facts.filter((fact) => String(fact.id || "").startsWith('fact-signal-')).map((fact) => String(fact.id || ""));
  }
  if (kind === 'kind:doc') {
    return facts.filter((fact) => String(fact.id || "").startsWith('fact-doc-')).map((fact) => String(fact.id || ""));
  }
  if (kind === 'kind:device') {
    return facts.filter((fact) => String(fact.id || "").startsWith('fact-device-')).map((fact) => String(fact.id || ""));
  }
  return [];
}

/**
 * Busca casos passados similares no banco
 */
