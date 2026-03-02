import type {
  IterativeEnrichmentSections,
  EnrichmentField,
  SourceFinding,
  IterativeEnrichmentProfile,
  TicketLike,
  EntityResolution,
  ItglueEnrichedPayload,
  Doc,
  Signal,
  ITGlueWanCandidate,
  ITGlueInfraCandidate
} from './prepare-context.types.js';
import type { NinjaOneClient } from '../../clients/ninjaone.js';
import type { ITGlueClient } from '../../clients/itglue.js';
import { callLLM } from '../ai/llm-adapter.js';

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
  });
  const infraSection = buildInfraEnrichmentSection({
    itglueConfigs: input.itglueConfigs,
    itgluePasswords: input.itgluePasswords,
    itglueAssets: input.itglueAssets,
    itglueEnriched: input.itglueEnriched || null,
    docs: input.docs,
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
    created_at: buildField({
      value: new Date().toISOString(),
      status: 'confirmed',
      confidence: 1,
      sourceSystem: 'system',
      sourceRef: 'generated',
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
}): IterativeEnrichmentSections['network'] {
  const wanCandidate = extractITGlueWanCandidate({
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
  const itglueLlmIsp = pickEnrichedValue(input.itglueEnriched, 'isp_name');
  const ispName = itglueLlmIsp || wanCandidate?.isp_name || inferIspName({
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
      confidence: publicIp ? 1 : 0,
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
}): IterativeEnrichmentSections['infra'] {
  const metadataCandidates = extractITGlueInfraCandidates({
    itgluePasswords: input.itgluePasswords,
    itglueConfigs: input.itglueConfigs,
    itglueAssets: input.itglueAssets,
    docs: input.docs,
  });
  const firewallValue = pickEnrichedValue(input.itglueEnriched, 'firewall_make_model');
  const wifiValue = pickEnrichedValue(input.itglueEnriched, 'wifi_make_model');
  const switchValue = pickEnrichedValue(input.itglueEnriched, 'switch_make_model');
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
    : metadataCandidates.firewall || extractInfraMakeModel('firewall', input.itglueConfigs, input.docs);
  const wifi = wifiValue
    ? makeEnriched(wifiValue)
    : metadataCandidates.wifi || extractInfraMakeModel('wifi', input.itglueConfigs, input.docs);
  const sw = switchValue
    ? makeEnriched(switchValue)
    : metadataCandidates.switch || extractInfraMakeModel('switch', input.itglueConfigs, input.docs);

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

export function inferIspName(input: {
  ticketNarrative: string;
  docs: Doc[];
  itglueConfigs: any[];
}): string {
  const sourceText = [
    input.ticketNarrative,
    ...input.docs.map((doc) => `${doc.title} ${doc.snippet}`),
    ...input.itglueConfigs.map((cfg) => JSON.stringify(cfg?.attributes || {})),
  ]
    .join(' ')
    .toLowerCase();
  const providers: Array<{ name: string; pattern: RegExp }> = [
    { name: 'Comcast', pattern: /\bcomcast\b|\bxfinity\b/ },
    { name: 'AT&T', pattern: /\bat&t\b|\batt\b/ },
    { name: 'Verizon', pattern: /\bverizon\b/ },
    { name: 'Spectrum', pattern: /\bspectrum\b|\bcharter\b/ },
    { name: 'Cox', pattern: /\bcox\b/ },
    { name: 'Frontier', pattern: /\bfrontier\b/ },
    { name: 'Lumen/CenturyLink', pattern: /\bcenturylink\b|\blumen\b/ },
    { name: 'Optimum', pattern: /\boptimum\b|\baltice\b/ },
  ];
  const found = providers.find((provider) => provider.pattern.test(sourceText));
  return found ? found.name : '';
}

export function extractITGlueWanCandidate(input: {
  ticketNarrative: string;
  itglueAssets: any[];
  itglueConfigs: any[];
  docs: Doc[];
}): ITGlueWanCandidate | null {
  const candidates: ITGlueWanCandidate[] = [];

  const scanRecord = (record: any, sourceSystem: ITGlueWanCandidate['source_system'], sourceRef: string) => {
    const attrs = record?.attributes || record || {};
    const pairs = collectTextPairs(attrs);
    const allText = pairs.map((p) => `${p.key}:${p.value}`).join(' | ');
    if (!/\b(internet|wan|isp|provider|carrier|broadband|fiber|cable|upload speed|download speed|link type)\b/i.test(allText)) {
      return;
    }

    let ispName = '';
    let locationHint = '';
    let publicIp = '';
    let score = 0.42;

    for (const pair of pairs) {
      const key = pair.key.toLowerCase();
      const value = pair.value.trim();
      if (!value) continue;
      if (/(^|[._\s-])(provider|isp|carrier)(name)?$/.test(key) && !/^(yes|no|true|false)$/i.test(value)) {
        ispName = normalizeVendorPhrase(value) || ispName;
        score += 0.28;
      }
      if (/(^|[._\s-])(location|site|address)(s)?$/.test(key) && value.length >= 4) {
        locationHint = locationHint || value;
        score += 0.08;
      }
      if ((/(^|[._\s-])(ip|public ip)( address)?(es)?$/.test(key) || isPublicIPv4(value)) && isPublicIPv4(value)) {
        publicIp = publicIp || value;
        score += 0.08;
      }
    }

    const label = normalizeName(String(attrs.name || attrs.title || attrs.hostname || ''));
    if (!ispName && label) {
      const labelMatch = label.match(/^(.+?)\s+(cable|fiber|internet|broadband|communications?|telecom)$/i);
      if (labelMatch?.[1]) {
        ispName = normalizeVendorPhrase(labelMatch[1]) || '';
        score += 0.14;
      }
    }

    if (!ispName && label) {
      const fallbackIsp = inferIspName({
        ticketNarrative: `${input.ticketNarrative}\n${label}\n${allText}`.slice(0, 2000),
        docs: [],
        itglueConfigs: [],
      });
      if (fallbackIsp) {
        ispName = fallbackIsp;
        score += 0.08;
      }
    }

    if (!ispName && !locationHint && !publicIp) return;
    candidates.push({
      isp_name: ispName,
      location_hint: locationHint,
      public_ip: publicIp,
      confidence: Number(Math.min(0.92, score).toFixed(3)),
      source_ref: sourceRef,
      source_system: sourceSystem,
    });
  };

  for (const asset of (input.itglueAssets || []).slice(0, 400)) {
    scanRecord(asset, 'itglue_asset', `itglue_asset:${String(asset?.id || 'unknown')}`);
  }
  for (const cfg of (input.itglueConfigs || []).slice(0, 300)) {
    scanRecord(cfg, 'itglue_config', `itglue_config:${String(cfg?.id || 'unknown')}`);
  }
  for (const doc of input.docs.slice(0, 20)) {
    const text = `${doc.title} ${doc.snippet}`;
    const m = text.match(/\b([A-Z][A-Za-z0-9&.' -]{1,40})\s+(cable|fiber|internet)\b/i);
    const isp = m?.[1] ? normalizeVendorPhrase(m[1]) : '';
    if (!isp) continue;
    candidates.push({
      isp_name: isp,
      confidence: 0.52,
      source_ref: `itglue_doc:${String(doc.id)}`,
      source_system: 'itglue_doc',
    });
  }

  return candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

export function extractITGlueInfraCandidates(input: {
  itgluePasswords: any[];
  itglueConfigs: any[];
  itglueAssets: any[];
  docs: Doc[];
}): {
  firewall: {
    value: string;
    status: EnrichmentField<string>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string;
    round: number;
  } | null;
  wifi: {
    value: string;
    status: EnrichmentField<string>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string;
    round: number;
  } | null;
  switch: {
    value: string;
    status: EnrichmentField<string>['status'];
    confidence: number;
    sourceSystem: string;
    sourceRef?: string;
    round: number;
  } | null;
} {
  const candidates: ITGlueInfraCandidate[] = [];
  const vendorPatterns: Array<{ kind: ITGlueInfraCandidate['kind'] | 'multi'; canonical: string; pattern: RegExp }> = [
    { kind: 'firewall', canonical: 'Fortinet FortiGate', pattern: /\bfortigate\b|\bfortinet\b|\bfg-\d+[a-z-]*\b/i },
    { kind: 'firewall', canonical: 'SonicWall', pattern: /\bsonicwall\b/i },
    { kind: 'firewall', canonical: 'Palo Alto', pattern: /\bpalo\s?alto\b|\bpa-\d+\b/i },
    { kind: 'firewall', canonical: 'WatchGuard', pattern: /\bwatchguard\b/i },
    { kind: 'firewall', canonical: 'Sophos', pattern: /\bsophos\b/i },
    { kind: 'wifi', canonical: 'UniFi', pattern: /\bunifi\b|\bubiquiti\b/i },
    { kind: 'wifi', canonical: 'Meraki', pattern: /\bmeraki\b/i },
    { kind: 'wifi', canonical: 'Aruba', pattern: /\baruba\b|\binstant on\b/i },
    { kind: 'wifi', canonical: 'Ruckus', pattern: /\bruckus\b/i },
    { kind: 'switch', canonical: 'Cisco', pattern: /\bcisco\b|\bcatalyst\b/i },
    { kind: 'switch', canonical: 'Aruba', pattern: /\baruba\b|\bprocurve\b/i },
    { kind: 'switch', canonical: 'Netgear', pattern: /\bnetgear\b/i },
    { kind: 'switch', canonical: 'UniFi', pattern: /\bunifi\b.*\bswitch\b|\bswitch\b.*\bunifi\b/i },
    { kind: 'multi', canonical: 'UniFi', pattern: /\bunifi\b/i },
  ];
  const inferKind = (text: string): ITGlueInfraCandidate['kind'] | null => {
    if (/\bfirewall\b|\bfortigate\b|\bsonicwall\b|\bwatchguard\b|\bpalo\s?alto\b/.test(text)) return 'firewall';
    if (/\bwifi\b|\bwireless\b|\bssid\b|\baccess point\b|\bcontroller\b/.test(text)) return 'wifi';
    if (/\bswitch\b|\bcatalyst\b|\bprocurve\b|\bstacking\b/.test(text)) return 'switch';
    return null;
  };
  const maybePush = (sourceSystem: ITGlueInfraCandidate['source_system'], sourceRef: string, label: string, contextHint: string, baseScore: number) => {
    const combined = `${label} ${contextHint}`.toLowerCase();
    if (!combined.trim()) return;
    const inferredKind = inferKind(combined);
    for (const vp of vendorPatterns) {
      if (!vp.pattern.test(combined)) continue;
      const kind = vp.kind === 'multi' ? (inferredKind || 'wifi') : vp.kind;
      if (!kind) continue;
      let value = vp.canonical;
      const modelMatch =
        label.match(/\b(FortiGate\s+[A-Z0-9-]+)\b/i) ||
        label.match(/\b(FG-\d+[A-Z-]*)\b/i) ||
        label.match(/\b(CAT-FG-\d+[A-Z-]*)\b/i) ||
        label.match(/\b(SonicWall(?:\s*\([^)]+\))?)\b/i) ||
        label.match(/\b(UniFi\s+(Controller|Switch|Cloud Portal|Video))\b/i);
      if (modelMatch?.[1]) value = normalizeName(modelMatch[1]);
      let score = baseScore;
      if (/\b(local access|controller|ssid)\b/.test(combined)) score += 0.08;
      if (/\bfirewall\b/.test(contextHint.toLowerCase()) && kind === 'firewall') score += 0.1;
      if (/\bwifi\b/.test(contextHint.toLowerCase()) && kind === 'wifi') score += 0.1;
      candidates.push({
        kind,
        value,
        confidence: Number(Math.min(0.9, score).toFixed(3)),
        source_ref: sourceRef,
        source_system: sourceSystem,
      });
    }
  };

  for (const p of (input.itgluePasswords || []).slice(0, 500)) {
    const a = p?.attributes || {};
    const name = normalizeName(String(a.name || a['resource-name'] || a.title || ''));
    const category = normalizeName(String(
      a.category || a.password_category || a.passwordCategory || a.password_category_name || a['password-category-name'] || ''
    ));
    const username = normalizeName(String(a.username || ''));
    maybePush('itglue_password_metadata', `itglue_password:${String(p?.id || name || 'unknown')}`, name, `${category} ${username}`, 0.6);
  }
  for (const cfg of (input.itglueConfigs || []).slice(0, 300)) {
    const a = cfg?.attributes || {};
    const name = normalizeName(String(itgAttr(a, 'name') || itgAttr(a, 'hostname') || ''));
    const vendor = normalizeName(String(
      itgAttr(a, 'manufacturer') ||
      itgAttr(a, 'manufacturer_name') ||
      itgAttr(a, 'vendor') ||
      itgAttr(a, 'brand') ||
      ''
    ));
    const model = normalizeName(String(
      itgAttr(a, 'model') ||
      itgAttr(a, 'model_name') ||
      itgAttr(a, 'product_model') ||
      ''
    ));
    const typeName = normalizeName(String(itgAttr(a, 'configuration_type_name') || itgAttr(a, 'type') || ''));
    maybePush('itglue_config', `itglue_config:${String(cfg?.id || name || 'unknown')}`, [vendor, model, name].filter(Boolean).join(' '), typeName, 0.72);
  }
  for (const asset of (input.itglueAssets || []).slice(0, 300)) {
    const a = asset?.attributes || {};
    const text = JSON.stringify(a || {}).slice(0, 1000);
    const name = normalizeName(String(a.name || a.title || ''));
    const typeName = normalizeName(String(a['flexible-asset-type-name'] || a.type || ''));
    maybePush('itglue_config', `itglue_asset:${String(asset?.id || name || 'unknown')}`, `${name} ${text}`, typeName, 0.66);
  }
  for (const doc of input.docs.slice(0, 20)) {
    maybePush('itglue_doc', `itglue_doc:${String(doc.id)}`, `${doc.title} ${doc.snippet}`.slice(0, 700), '', 0.46);
  }

  const pick = (kind: ITGlueInfraCandidate['kind']) => {
    const best = candidates.filter((c) => c.kind === kind).sort((a, b) => b.confidence - a.confidence)[0];
    if (!best) return null;
    return {
      value: best.value,
      status: 'inferred' as const,
      confidence: best.confidence,
      sourceSystem: best.source_system,
      sourceRef: best.source_ref,
      round: 2,
    };
  };
  return { firewall: pick('firewall'), wifi: pick('wifi'), switch: pick('switch') };
}

export function extractInfraMakeModel(
  kind: 'firewall' | 'wifi' | 'switch',
  configs: any[],
  docs: Doc[]
): {
  value: string;
  status: EnrichmentField<string>['status'];
  confidence: number;
  sourceSystem: string;
  sourceRef?: string;
  round: number;
} {
  const configMatchers: Record<'firewall' | 'wifi' | 'switch', RegExp> = {
    firewall: /\bfirewall\b|\bfortigate\b|\bfortinet\b|\bsonicwall\b|\bpalo\s?alto\b|\bwatchguard\b|\bmx\d+\b/i,
    wifi: /\bwifi\b|\bwireless\b|\baccess\s?point\b|\bap\b|\bmeraki\s?mr\b|\bunifi\b|\baruba\b|\bruckus\b/i,
    switch: /\bswitch\b|\bcatalyst\b|\bprocurve\b|\baruba\b|\bnetgear\b|\bunifi\s?switch\b/i,
  };

  for (const config of configs || []) {
    const attrs = config?.attributes || {};
    const text = JSON.stringify(attrs);
    if (!configMatchers[kind].test(text)) continue;
    const vendor = String(
      itgAttr(attrs, 'manufacturer') ||
      itgAttr(attrs, 'manufacturer_name') ||
      itgAttr(attrs, 'vendor') ||
      itgAttr(attrs, 'brand') ||
      ''
    ).trim();
    const model = String(
      itgAttr(attrs, 'model') ||
      itgAttr(attrs, 'model_name') ||
      itgAttr(attrs, 'product_model') ||
      ''
    ).trim();
    const name = String(itgAttr(attrs, 'name') || itgAttr(attrs, 'hostname') || '').trim();
    const value = [vendor, model].filter(Boolean).join(' ').trim() || name || 'unknown';
    if (!value || value === 'unknown') continue;
    return {
      value,
      status: 'confirmed',
      confidence: 0.8,
      sourceSystem: 'itglue',
      sourceRef: `itglue_config:${String(config?.id || name || 'unknown')}`,
      round: 1,
    };
  }

  for (const doc of docs || []) {
    const text = `${doc.title} ${doc.snippet}`;
    if (!configMatchers[kind].test(text)) continue;
    return {
      value: String(doc.title || 'unknown').trim() || 'unknown',
      status: 'inferred',
      confidence: 0.55,
      sourceSystem: 'itglue',
      sourceRef: `itglue_doc:${doc.id}`,
      round: 2,
    };
  }

  return {
    value: 'unknown',
    status: 'unknown',
    confidence: 0,
    sourceSystem: 'unknown',
    round: 1,
  };
}

export function isPublicIPv4(value: string): boolean {
  const match = /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
  if (!match) return false;
  const octets = value.split('.').map((part) => Number(part));
  const first = octets[0] ?? -1;
  const second = octets[1] ?? -1;
  if (octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return false;
  if (first === 10) return false;
  if (first === 127) return false;
  if (first === 192 && second === 168) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  return true;
}

export function collectTextPairs(
  obj: unknown,
  prefix = '',
  depth = 0,
  out: Array<{ key: string; value: string }> = []
): Array<{ key: string; value: string }> {
  if (obj === null || obj === undefined || depth > 4) return out;
  if (Array.isArray(obj)) {
    for (const item of obj.slice(0, 20)) collectTextPairs(item, prefix, depth + 1, out);
    return out;
  }
  if (typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>).slice(0, 200)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      const value = String(v).replace(/\s+/g, ' ').trim();
      if (value) out.push({ key, value });
    } else {
      collectTextPairs(v, key, depth + 1, out);
    }
  }
  return out;
}

export function normalizeVendorPhrase(value: string): string {
  const text = normalizeName(String(value || ''))
    .replace(/\b(primary|secondary|backup)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > 80) return '';
  return text;
}

export function pickEnrichedValue(payload: ItglueEnrichedPayload | null, key: string): string | null {
  if (!payload || !payload.fields) return null;
  const field = payload.fields[key];
  if (!field || (field.confidence || 0) < 0.6) return null;
  return field.value || null;
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
      if (fieldKey === 'created_at') continue;
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

export function extractEmails(text: string): string[] {
  const source = String(text || '').toLowerCase();
  const matches = source.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) || [];
  return [...new Set(matches.map((m) => m.trim()))];
}

export function extractFirstEmail(text: string): string | null {
  const emails = extractEmails(text);
  return emails.length > 0 ? emails[0] || null : null;
}
// --- RESTORED HELPERS ---

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

  // Split common business suffixes when domain is concatenated (e.g. stintinomanagement)
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

export async function normalizeTicketForPipeline(ticket: TicketLike): Promise<{
  title: string;
  descriptionCanonical: string;
  descriptionUi: string;
  descriptionDisplayMarkdown: string;
  descriptionDisplayFormat: 'plain' | 'markdown_llm';
  requesterName: string;
  requesterEmail: string;
  affectedUserName: string;
  affectedUserEmail: string;
  organizationHint: string;
  deviceHints: string[];
  symptoms: string[];
  technologyFacets: string[];
  method: 'llm' | 'deterministic_fallback';
  confidence: number;
}> {
  const narrative = buildTicketNarrative(ticket);
  const fallback = normalizeTicketDeterministically(ticket.title || '', narrative);

  try {
    const prompt = `Normalize this IT support ticket text and return ONLY valid JSON.

Rules:
1. description_canonical: Keep the original text and intent, but remove signatures, legal disclaimers, external portal boilerplate, and phishing warnings. This field should be plain text suitable for downstream pipeline parsing.
2. description_ui: Reinterpret and radically simplify the ticket for the technician UI. Focus EXCLUSIVELY on "what the user wants" or "what is broken". Be direct and concise.
3. Preserve concrete facts: people, emails, phones, device models/serials, organization hints.
4. DO NOT confuse requester and affected user. If requester is asking on behalf of a different/new employee and the affected employee name is not explicitly stated, keep the affected employee unnamed (e.g., "new employee (name not provided)").
5. Keep output concise and factual.

Output JSON schema:
{
  "title": "string",
  "description_canonical": "string",
  "description_ui": "string",
  "requester_name": "string",
  "requester_email": "string",
  "affected_user_name": "string",
  "affected_user_email": "string",
  "organization_hint": "string",
  "device_hints": ["string"],
  "symptoms": ["string"],
  "technology_facets": ["string"],
  "confidence": 0.0
}

Ticket text:
"""${narrative.slice(0, 12000)}"""`;

    const llm = await callLLM(prompt);
    const parsed = extractJsonObject(llm.content);
    const title = String(parsed?.title || '').trim();
    const descriptionCanonical = postProcessCanonicalTicketText(String(parsed?.description_canonical || ''));
    let descriptionUi = postProcessUiTicketText(String(parsed?.description_ui || ''));
    const requesterName = normalizeName(String(parsed?.requester_name || '').trim());
    const requesterEmail = String(parsed?.requester_email || '').trim().toLowerCase();
    const affectedUserName = normalizeName(String(parsed?.affected_user_name || '').trim());
    const affectedUserEmail = String(parsed?.affected_user_email || '').trim().toLowerCase();
    const organizationHint = String(parsed?.organization_hint || '').trim();
    const deviceHints = Array.isArray(parsed?.device_hints) ? parsed.device_hints.map(String) : [];
    const symptoms = Array.isArray(parsed?.symptoms) ? parsed.symptoms.map(String) : [];
    const technologyFacets = Array.isArray(parsed?.technology_facets) ? parsed.technology_facets.map(String) : [];
    const confidenceRaw = Number(parsed?.confidence);
    const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.75;
    descriptionUi = guardTicketUiRoleAssignment({
      descriptionUi,
      requesterName,
      ticketRequester: ticket.requester || '',
      canonicalText: descriptionCanonical || fallback.descriptionClean,
      narrative,
    });

    if (descriptionCanonical.length >= 10 || descriptionUi.length >= 10) {
      const canonicalRequesterEmail = requesterEmail || extractFirstEmail(ticket.requester || '') || extractFirstEmail(narrative) || '';
      const canonicalRequesterName = requesterName || normalizeName(ticket.requester || '') || '';
      const canonicalAffectedName = affectedUserName || canonicalRequesterName || '';
      const canonicalAffectedEmail = affectedUserEmail || canonicalRequesterEmail || '';
      const canonicalDisplayText = descriptionCanonical || postProcessCanonicalTicketText(fallback.descriptionClean);
      let descriptionDisplayMarkdown = '';
      const strictFormat = await formatDisplayMarkdownVerbatimWithLLM(canonicalDisplayText).catch(() => '');
      if (isDisplayMarkdownVerbatimEnough(canonicalDisplayText, strictFormat)) {
        descriptionDisplayMarkdown = strictFormat;
      }
      return {
        title: title || fallback.title,
        descriptionCanonical: canonicalDisplayText,
        descriptionUi:
          descriptionUi ||
          guardTicketUiRoleAssignment({
            descriptionUi: postProcessUiTicketText(fallback.descriptionClean),
            requesterName: canonicalRequesterName,
            ticketRequester: ticket.requester || '',
            canonicalText: descriptionCanonical || fallback.descriptionClean,
            narrative,
          }),
        descriptionDisplayMarkdown:
          descriptionDisplayMarkdown ||
          canonicalDisplayText,
        descriptionDisplayFormat: descriptionDisplayMarkdown ? 'markdown_llm' : 'plain',
        requesterName: canonicalRequesterName,
        requesterEmail: canonicalRequesterEmail,
        affectedUserName: canonicalAffectedName,
        affectedUserEmail: canonicalAffectedEmail,
        organizationHint,
        deviceHints,
        symptoms,
        technologyFacets,
        method: 'llm',
        confidence,
      };
    }
  } catch {
    // deterministic fallback below
  }

  return {
    ...fallback,
    descriptionCanonical: postProcessCanonicalTicketText(fallback.descriptionClean),
    descriptionUi: guardTicketUiRoleAssignment({
      descriptionUi: postProcessUiTicketText(fallback.descriptionClean),
      requesterName: fallback.requesterName,
      ticketRequester: ticket.requester || '',
      canonicalText: fallback.descriptionClean,
      narrative,
    }),
    descriptionDisplayMarkdown: postProcessCanonicalTicketText(fallback.descriptionClean),
    descriptionDisplayFormat: 'plain',
    organizationHint: '',
    deviceHints: [],
    symptoms: [],
    technologyFacets: [],
    method: 'deterministic_fallback',
    confidence: 0.55,
  };
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

  // Strip obvious HTML leftovers and encoded noise
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

  // Drop boilerplate and disclaimers (Autotask/email wrappers)
  text = text
    .replace(/\*{3}\s*please enter replies above this line\s*\*{3}[\s\S]*$/i, ' ')
    .replace(/thank you for contacting us[\s\S]*?the details of the ticket are listed below\.?/i, ' ')
    .replace(/you can access your service ticket via our client portal by clicking the following link:[\s\S]*$/i, ' ')
    .replace(/if you do not have access to the client portal[\s\S]*$/i, ' ')
    .replace(/sincerely,\s*refresh support team[\s\S]*$/i, ' ')
    .replace(/caution[\s\S]*?this email originated outside the organization[\s\S]*$/i, ' ')
    .replace(/do not click any links? or attachments? unless you know the sender[\s\S]*$/i, ' ');

  // Remove safe links / raw URLs while preserving nearby text
  text = text
    .replace(/https?:\/\/nam\d+\.safelinks\.protection\.outlook\.com\/\S+/gi, ' ')
    .replace(/https?:\/\/\S+/gi, ' ');

  // Keep the likely user request portion if an embedded "Description:" exists
  const descMatch = text.match(/\bdescription\s*:\s*([\s\S]+)$/i);
  if (descMatch?.[1]) {
    text = descMatch[1];
  }

  // Trim auto-ack ticket metadata that often precedes the real request
  text = text
    .replace(/\bticket\s*#?\s*:\s*T\d{8}\.\d+\b/gi, ' ')
    .replace(/\bcreated on\s+\d{1,2}\/\d{1,2}\/\d{4}[\s\S]*?\bby\s+[A-Za-z .'-]+/gi, ' ')
    .replace(/\btitle\s*:\s*[^.:\n]+/gi, ' ');

  // Normalize whitespace and cut trailing repeated signatures/disclaimers again after transforms
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

  // Strip raw HTML if the model leaked markup; keep markdown intact.
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

  // Remove common wrappers if they slipped through, but preserve signature content.
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

export async function formatDisplayMarkdownVerbatimWithLLM(sourceText: string): Promise<string> {
  const text = String(sourceText || '').trim();
  if (!text) return '';
  const prompt = `Format the following ticket text as Markdown for readability.

CRITICAL RULES (strict):
- Preserve the original wording for the ticket content and signature details.
- Do NOT paraphrase, summarize, reinterpret, rename, or reorder facts.
- You MAY add minimal formatting labels/headings for structure (for example: "Request", "Signature", "Notes") when helpful.
- You MAY add Markdown syntax, whitespace, line breaks, bullets, and tables.
- Keep added labels minimal and generic; do not invent new facts.
- If the text contains a repeated roster/list of people (for example onboarding users: 3 or more person-like entries), prefer a Markdown table instead of plain paragraphs.
  - If field extraction is clear, use columns like Name | Employment Type | Device Type (and optionally other obvious columns).
  - If field extraction is NOT clear, still use a table (for example Name | Details) and preserve the original wording inside cells.
  - Do not drop ambiguous rows; preserve them verbatim in a row/cell.
- Preserve the signature/contact block if present.
- Output Markdown only (no code fences, no explanation).

Text:
"""${text.slice(0, 12000)}"""`;
  const llm = await callLLM(prompt);
  return postProcessDisplayMarkdownTicketText(String(llm.content || ''));
}

export function isDisplayMarkdownVerbatimEnough(sourceText: string, markdownText: string): boolean {
  const source = normalizeDisplayTextForVerbatimGuard(sourceText);
  const rendered = normalizeDisplayTextForVerbatimGuard(stripMarkdownForDisplayGuard(markdownText));
  if (!source || !rendered) return false;

  const sourceTokens = source.split(' ').filter(Boolean);
  const renderedTokens = rendered.split(' ').filter(Boolean);
  if (!sourceTokens.length || !renderedTokens.length) return false;

  // Exact match after markdown stripping/whitespace normalization is ideal.
  if (source === rendered) return true;

  // Coverage by subsequence: source wording should still appear in order.
  let matched = 0;
  let j = 0;
  for (let i = 0; i < sourceTokens.length && j < renderedTokens.length; i += 1) {
    const token = sourceTokens[i];
    while (j < renderedTokens.length && renderedTokens[j] !== token) j += 1;
    if (j < renderedTokens.length && renderedTokens[j] === token) {
      matched += 1;
      j += 1;
    }
  }

  const coverage = matched / Math.max(1, sourceTokens.length);
  const sourceSet = new Set(sourceTokens);
  const formattingWords = new Set([
    'request', 'requests', 'requester', 'signature', 'contact', 'notes', 'goal', 'priority',
    'users', 'items', 'details', 'name', 'role', 'employment', 'location', 'device',
  ]);
  let novel = 0;
  for (const token of renderedTokens) {
    if (!sourceSet.has(token) && !formattingWords.has(token)) novel += 1;
  }
  const novelRatio = novel / Math.max(1, renderedTokens.length);
  const lengthRatio = rendered.length / Math.max(1, source.length);

  // Allow formatting headers/table labels, but reject meaningful rewrites.
  // If the source is short, require tighter length/coverage because a few new words can dominate.
  if (sourceTokens.length < 12) {
    return coverage >= 0.9 && novelRatio <= 0.12 && lengthRatio >= 0.75 && lengthRatio <= 1.4;
  }
  return coverage >= 0.9 && novelRatio <= 0.08 && lengthRatio >= 0.7 && lengthRatio <= 1.5;
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

  // Fallback: detect a trailing contact-card style block around the first contact signal near the tail.
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

  // Sign-off on its own line when present.
  sig = sig.replace(/^(thanks|thank you|regards|best regards|cheers)[,!]?\s+/i, (_m, word) => `${word.replace(/\b\w/g, (c: string) => c.toUpperCase())},\n`);

  // Put common contact labels on their own lines.
  sig = sig.replace(/\s+(?=(?:Direct|Phone|Mobile|Cell|Office|Email|Website)\s*:)/g, '\n');

  // Put email / website / phones on their own lines if inline.
  sig = sig
    .replace(/\s+(?=[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
    .replace(/\s+(?=www\.[a-z0-9.-]+\.[a-z]{2,}\b)/ig, '\n')
    .replace(/\s+(?=(?:\+?1[\s.-]*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]?\d{4}\b)/g, '\n');

  // Break before common titles and address starts when they were flattened.
  sig = sig
    .replace(/\s+(?=(?:Sr\.?\s+)?(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n')
    .replace(/\s+(?=\d{2,6}\s+[A-Za-z])/g, '\n');

  // Handle compact signature markers like "e john@..." / "c 781..." used in some email signatures.
  sig = sig
    .replace(/\s+(?=\be\s+[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b)/ig, '\n')
    .replace(/\s+(?=\bc\s+\d{3}[.\-\s]\d{3}[.\-\s]\d{4}\b)/ig, '\n');

  // Rejoin common label/value pairs and title suffix splits if previous rules over-split.
  sig = sig
    .replace(/\b(Direct|Phone|Mobile|Cell|Office|Email|Website):\s*\n\s*/g, '$1: ')
    .replace(/\n(Sr\.|Jr\.)\s*\n(?=(?:Project Engineer|Web Director|Comptroller|Director|Manager|Engineer|Administrator|Coordinator|President|Owner)\b)/g, '\n$1 ');

  // Keep lines tidy.
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

  // Rewrite to preserve requester role and keep affected user unnamed unless explicitly present.
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

export function escapeRegex(value: string): string {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

export function inferPhoneProvider(input: {
  ticketText: string;
  docs: Doc[];
  itglueConfigs: any[];
  itgluePasswords: any[];
  signals: Signal[];
}): string | null {
  const sourceText = [
    input.ticketText,
    ...input.docs.map((d) => `${d.title} ${d.snippet}`),
    ...input.itglueConfigs.map((c: any) => JSON.stringify(c?.attributes || {})),
    ...input.itgluePasswords.map((p: any) => JSON.stringify(p?.attributes || {})),
    ...input.signals.map((s) => `${s.source} ${s.type} ${s.summary}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const providerMatchers: Array<{ name: string; pattern: RegExp }> = [
    { name: 'GoTo Connect', pattern: /\bgoto(\s?connect)?\b|\bgotoconnect\b/ },
    { name: 'RingCentral', pattern: /\bring\s?central\b/ },
    { name: '8x8', pattern: /\b8x8\b/ },
    { name: 'Zoom Phone', pattern: /\bzoom\s?phone\b/ },
    { name: 'Microsoft Teams Phone', pattern: /\bteams\s?phone\b|\bmicrosoft\s?teams\b/ },
    { name: 'Vonage', pattern: /\bvonage\b/ },
    { name: 'Dialpad', pattern: /\bdialpad\b/ },
  ];
  const found = providerMatchers.find((m) => m.pattern.test(sourceText));
  return found ? found.name : null;
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

export function extractLoggedInUser(deviceDetails: any): string | null {
  if (!deviceDetails || typeof deviceDetails !== 'object') return null;
  const directKeys = ['loggedInUser', 'currentUser', 'lastLoggedInUser', 'consoleUser', 'username', 'userName'];
  for (const key of directKeys) {
    const value = deviceDetails[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const props = deviceDetails.properties;
  if (props && typeof props === 'object') {
    for (const [key, value] of Object.entries(props)) {
      if (!/user|login|logon|account/i.test(String(key))) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

export async function resolveLastLoggedInContext(
  ninjaoneClient: NinjaOneClient,
  deviceId: string,
  normalizeTimeValue: (value: string) => string
): Promise<{ userName: string; logonTime: string }> {
  const direct = await ninjaoneClient.getDeviceLastLoggedOnUser(deviceId).catch(() => null);
  const directUser = String(direct?.userName || '').trim();
  const directTime = normalizeTimeValue(String(direct?.logonTime || ''));
  if (directUser) return { userName: directUser, logonTime: directTime };

  const report = await ninjaoneClient.listLastLoggedOnUsers({ pageSize: 1000 }).catch(() => null);
  const rows = Array.isArray(report?.results) ? report.results : [];
  const match = rows.find((row: any) => String(row.deviceId) === String(deviceId));
  const reportUser = String(match?.userName || '').trim();
  const reportTime = normalizeTimeValue(String(match?.logonTime || ''));
  if (reportUser) return { userName: reportUser, logonTime: reportTime };

  return { userName: '', logonTime: '' };
}

export function resolveDeviceOsLabel(device: any, details: any): string {
  const name = String(device?.osName || details?.osName || details?.os?.name || '').trim();
  const version = String(
    device?.osVersion ||
    details?.osVersion ||
    [details?.os?.buildNumber, details?.os?.releaseId].filter(Boolean).join(' / ') ||
    ''
  ).trim();
  const combined = [name, version].filter(Boolean).join(' ');
  return combined || 'Unknown';
}

export async function buildNinjaContextSignals(input: {
  ninjaoneClient: NinjaOneClient;
  deviceId: string;
  orgId: string | null;
  tenantId: string | null;
  sourceWorkspace: string;
  normalizeTimeValue: (value: string) => string;
}): Promise<Signal[]> {
  const signals: Signal[] = [];
  const [activities, interfaces, softwareRows] = await Promise.all([
    input.ninjaoneClient.getDeviceActivities(input.deviceId, { pageSize: 30 }).catch(() => []),
    input.ninjaoneClient.getDeviceNetworkInterfaces(input.deviceId).catch(() => []),
    input.ninjaoneClient.querySoftware({ pageSize: 200, df: `deviceId = ${input.deviceId}` }).catch(() => []),
  ]);

  for (const activity of activities.slice(0, 8)) {
    const summary = String(
      activity.message ||
      activity.activity ||
      activity.activityType ||
      activity.activityClass ||
      'device activity'
    ).trim();
    signals.push({
      id: `ninja-activity-${input.deviceId}-${String(activity.id || summary).slice(0, 48)}`,
      source: 'ninja',
      timestamp: input.normalizeTimeValue(String(activity.createTime || activity.timestamp || '')) || new Date().toISOString(),
      type: 'ticket_note',
      summary: `Activity: ${summary}`,
      raw_ref: activity,
      tenant_id: input.tenantId,
      org_id: input.orgId,
      source_workspace: input.sourceWorkspace,
    });
  }

  for (const iface of interfaces.slice(0, 4)) {
    const name = String(iface.adapterName || iface.interfaceName || 'interface').trim();
    const ips = Array.isArray(iface.ipAddress) ? iface.ipAddress : [iface.ipAddress];
    const ip = ips.map((v: unknown) => String(v || '').trim()).filter(Boolean)[0] || 'no-ip';
    signals.push({
      id: `ninja-iface-${input.deviceId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      source: 'ninja',
      timestamp: new Date().toISOString(),
      type: 'health_ok',
      summary: `Interface ${name}: ${ip}`,
      raw_ref: iface,
      tenant_id: input.tenantId,
      org_id: input.orgId,
      source_workspace: input.sourceWorkspace,
    });
  }

  for (const sw of softwareRows.slice(0, 10)) {
    const swName = String(sw.name || '').trim();
    if (!swName) continue;
    const version = String(sw.version || '').trim();
    const publisher = String(sw.publisher || '').trim();
    signals.push({
      id: `ninja-sw-${input.deviceId}-${swName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`,
      source: 'ninja',
      timestamp: input.normalizeTimeValue(String(sw.timestamp || '')) || new Date().toISOString(),
      type: 'ticket_note',
      summary: `Software: ${swName}${version ? ` ${version}` : ''}${publisher ? ` (${publisher})` : ''}`,
      raw_ref: sw,
      tenant_id: input.tenantId,
      org_id: input.orgId,
      source_workspace: input.sourceWorkspace,
    });
  }

  return signals;
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

    // Prevent false positives like "CAT Resources" -> "Composite Resources" (shared generic token only).
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

export function extractEmailDomains(text: string): string[] {
  const source = String(text || '').toLowerCase();
  const matches = source.match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/g) || [];
  const domains = matches
    .map((m) => m.split('@')[1] || '')
    .map((d) => d.trim())
    .filter(Boolean);
  return [...new Set(domains)].slice(0, 3);
}

export async function resolveNinjaOrg(
  ninjaoneClient: NinjaOneClient,
  companyName: string
): Promise<{ id: number; name: string } | null> {
  const orgs = await ninjaoneClient.listOrganizations();
  const ranked = orgs
    .map((o: any) => ({
      org: o,
      score: scoreOrgNameMatch(companyName, String(o?.name || '')),
    }))
    .filter((r: { score: number }) => r.score >= 0.8)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  const found = ranked[0]?.org || null;
  return found ? { id: Number(found.id), name: String(found.name) } : null;
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
      score: scoreOrgNameMatch(
        companyName,
        String(itgAttr(o?.attributes || {}, 'name') || ''),
        String(itgAttr(o?.attributes || {}, 'short_name') || '')
      ),
    }))
    .filter((r: { score: number }) => r.score >= 0.8)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);
  const byName = rankedByName[0]?.org;
  if (byName) {
    return { id: String(byName.id), name: String(itgAttr(byName?.attributes || {}, 'name') || companyName) };
  }

  const ignoreDomainSuffixes = [
    'outlook.com',
    'office.com',
    'microsoft.com',
    'autotask.net',
    'itclientportal.com',
    'safelinks.protection.outlook.com',
    'protection.outlook.com',
    'refreshtech.com',
  ];
  const domains = extractEmailDomains(hintText || '').filter(
    (d: string) => !ignoreDomainSuffixes.some((suffix) => d === suffix || d.endsWith(`.${suffix}`))
  );
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
    .filter((r: { score: number }) => r.score >= 0.75)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

  const byDomain = rankedByDomain[0]?.org;
  return byDomain ? { id: String(byDomain.id), name: String(itgAttr(byDomain?.attributes || {}, 'name') || companyName) } : null;

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

export function normalizeSimpleToken(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function generateNameAliases(name: string): Set<string> {
  const aliases = new Set<string>();
  const normalized = normalizeName(name);
  const parts = normalized.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return aliases;
  const first = parts[0];
  const last = parts[parts.length - 1];
  aliases.add(normalizeSimpleToken(normalized));
  if (first) aliases.add(first);
  if (last) aliases.add(last);
  if (first && last) {
    aliases.add(`${first[0]}${last}`);
    aliases.add(`${first}.${last}`);
    aliases.add(`${first}_${last}`);
    aliases.add(`${first}${last[0]}`);
  }
  return new Set([...aliases].map((a) => normalizeSimpleToken(a)).filter(Boolean));
}

export function extractSoftwareHintsFromTicket(text: string): string[] {
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
