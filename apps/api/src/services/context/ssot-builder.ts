// ─────────────────────────────────────────────────────────────
// SSOT Builder
// Builds the canonical TicketSSOT from enrichment sections and
// applies intake anti-regression to preserve high-quality values.
// ─────────────────────────────────────────────────────────────
import { normalizeName, extractFirstEmail, shouldPreferCompanyCandidateOverIntake } from './prepare-context-helpers.js';
import type {
  IterativeEnrichmentSections,
} from './prepare-context.types.js';
import type { TicketSSOT, TicketLike } from './prepare-context.types.js';

export function buildTicketSSOT(sections: IterativeEnrichmentSections): TicketSSOT {
  const ticket = sections.ticket;
  const identity = sections.identity;
  const endpoint = sections.endpoint;
  const network = sections.network;
  const infra = sections.infra;

  return {
    ticket_id: String(ticket.ticket_id.value || 'unknown'),
    company: String(ticket.company.value || 'unknown'),
    requester_name: String(ticket.requester_name.value || 'unknown'),
    requester_email: String(ticket.requester_email.value || 'unknown'),
    affected_user_name: String(ticket.affected_user_name.value || ticket.requester_name.value || 'unknown'),
    affected_user_email: String(ticket.affected_user_email.value || ticket.requester_email.value || 'unknown'),
    created_at: String(ticket.created_at.value || 'unknown'),
    title: String(ticket.title.value || 'unknown'),
    description_clean: String(ticket.description_clean.value || 'unknown'),
    user_principal_name: String(identity.user_principal_name.value || 'unknown'),
    account_status: String(identity.account_status.value || 'unknown'),
    mfa_state: String(identity.mfa_state.value || 'unknown'),
    licenses_summary: String(identity.licenses_summary.value || 'Unknown'),
    groups_top: String(identity.groups_top.value || 'unknown'),
    device_name: String(endpoint.device_name.value || 'unknown'),
    device_type: String(endpoint.device_type.value || 'unknown'),
    os_name: String(endpoint.os_name.value || 'unknown'),
    os_version: String(endpoint.os_version.value || 'unknown'),
    last_check_in: String(endpoint.last_check_in.value || 'unknown'),
    security_agent: endpoint.security_agent.value as TicketSSOT['security_agent'],
    user_signed_in: String(endpoint.user_signed_in.value || 'unknown'),
    location_context: String(network.location_context.value || 'unknown'),
    public_ip: String(network.public_ip.value || 'unknown'),
    isp_name: String(network.isp_name.value || 'unknown'),
    vpn_state: String(network.vpn_state.value || 'unknown'),
    phone_provider: String(network.phone_provider.value || 'unknown'),
    phone_provider_name: String(network.phone_provider_name.value || 'unknown'),
    firewall_make_model: String(infra.firewall_make_model.value || 'unknown'),
    wifi_make_model: String(infra.wifi_make_model.value || 'unknown'),
    switch_make_model: String(infra.switch_make_model.value || 'unknown'),
  };
}

export function applyIntakeAntiRegressionToSSOT(
  ssot: TicketSSOT,
  input: {
    ticket: TicketLike;
    normalizedTicket: {
      requesterName?: string;
      requesterEmail?: string;
      affectedUserName?: string;
      affectedUserEmail?: string;
      title?: string;
      descriptionCanonical?: string;
      descriptionUi?: string;
    } | null;
    companyName?: string;
    autotaskAuthoritativeSeed?: TicketSSOT['autotask_authoritative'] | null;
  }
): TicketSSOT {
  const out: TicketSSOT = { ...ssot };

  const isUnknown = (v: unknown) => {
    const s = String(v ?? '').trim().toLowerCase();
    return !s || s === 'unknown' || s === 'n/a' || s === 'none' || s === 'null';
  };
  const pickBetter = (current: unknown, ...candidates: unknown[]) => {
    if (!isUnknown(current)) return String(current).trim();
    for (const c of candidates) {
      if (!isUnknown(c)) return String(c).trim();
    }
    return String(current || 'unknown').trim() || 'unknown';
  };

  const ticket = input.ticket;
  const normalized = input.normalizedTicket || null;
  const authoritative = input.autotaskAuthoritativeSeed || null;
  const intakeCompanyRaw = String(ticket.company || '').trim();
  const inferredCompanyRaw = String(input.companyName || '').trim();
  const normalizeCompanyComparable = (value: string) =>
    normalizeName(normalizeName(String(value || '')));

  const currentCompanyRaw = String(out.company || '').trim();
  const canOverrideDomainDerivedIntakeWithCurrent =
    !isUnknown(currentCompanyRaw) && shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, currentCompanyRaw);
  const canOverrideDomainDerivedIntakeWithInferred =
    !isUnknown(inferredCompanyRaw) && shouldPreferCompanyCandidateOverIntake(intakeCompanyRaw, inferredCompanyRaw);

  if (authoritative) {
    out.autotask_authoritative = authoritative;
    if (authoritative.ticket_number) {
      out.ticket_id = String(authoritative.ticket_number);
    }
    if (authoritative.title) {
      out.title = String(authoritative.title);
    }
    // Preserve normalized description in `description_clean`, but ensure the raw manual value is retained in SSOT.
    // UI/API layers can prefer `autotask_authoritative.description` where they need the operator-entered text.
    if (!isUnknown(authoritative.company_name)) {
      out.company = String(authoritative.company_name).trim();
    }
    if (!isUnknown(authoritative.contact_name)) {
      out.requester_name = normalizeName(String(authoritative.contact_name || ''));
    }
    if (!isUnknown(authoritative.contact_email)) {
      out.requester_email = String(authoritative.contact_email || '').trim().toLowerCase();
    }
  }

  // Company is display-critical. Preserve intake formatting unless the intake value is a domain-derived fallback
  // and a better display-ready company name was inferred or already assembled in the SSOT.
  if (!isUnknown(intakeCompanyRaw) && !canOverrideDomainDerivedIntakeWithCurrent && !canOverrideDomainDerivedIntakeWithInferred) {
    out.company = intakeCompanyRaw;
  } else if (!isUnknown(inferredCompanyRaw)) {
    if (
      isUnknown(out.company) ||
      normalizeCompanyComparable(String(out.company || '')) === normalizeCompanyComparable(inferredCompanyRaw)
    ) {
      out.company = inferredCompanyRaw;
    } else {
      out.company = pickBetter(out.company, inferredCompanyRaw);
    }
  } else {
    out.company = pickBetter(out.company);
  }

  out.requester_name = pickBetter(
    out.requester_name,
    normalizeName(ticket.canonicalRequesterName || ''),
    normalizeName(normalized?.requesterName || ''),
    normalizeName(ticket.requester || '')
  );

  out.requester_email = pickBetter(
    out.requester_email,
    String(ticket.canonicalRequesterEmail || '').trim().toLowerCase(),
    String(normalized?.requesterEmail || '').trim().toLowerCase(),
    extractFirstEmail(ticket.requester || ''),
    extractFirstEmail(ticket.rawBody || ''),
    extractFirstEmail(ticket.description || '')
  );

  out.affected_user_name = pickBetter(
    out.affected_user_name,
    normalizeName(ticket.canonicalAffectedName || ''),
    normalizeName(normalized?.affectedUserName || '')
  );

  out.affected_user_email = pickBetter(
    out.affected_user_email,
    String(ticket.canonicalAffectedEmail || '').trim().toLowerCase(),
    String(normalized?.affectedUserEmail || '').trim().toLowerCase()
  );

  out.title = pickBetter(
    out.title,
    String(normalized?.title || '').trim(),
    String(ticket.title || '').trim()
  );

  out.description_clean = pickBetter(
    out.description_clean,
    String(normalized?.descriptionUi || '').trim(),
    String(normalized?.descriptionCanonical || '').trim(),
    String(ticket.description || '').trim()
  );

  out.created_at = pickBetter(
    out.created_at,
    String(ticket.createDate || '').trim()
  );

  return out;
}
