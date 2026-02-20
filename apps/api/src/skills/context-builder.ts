// ─────────────────────────────────────────────────────────────
// Cross-reference Skills — "Recipes" for MVP triage pipeline.
//
// Each skill:
//   1. Resolves org IDs across sources
//   2. Fetches in parallel
//   3. Formats with formatters.ts (token-efficient)
//   4. Returns a ready-to-inject string
//
// Low-temperature by design: pure data plumbing, no LLM calls.
// ─────────────────────────────────────────────────────────────

import { ITGlueClient } from '../clients/itglue.js';
import { NinjaOneClient } from '../clients/ninjaone.js';
import {
  buildOrgContextBlock,
  formatNinjaDeviceList,
  formatNinjaAlertList,
  type NinjaDeviceRaw,
  type NinjaAlertRaw,
  type ITGlueOrgRaw,
  type ITGlueConfigRaw,
  type ITGlueContactRaw,
  type ITGlueDocRaw,
} from './formatters.js';

// ─── Org ID resolution ────────────────────────────────────────

function fuzzyMatch(name: string, candidate: string): boolean {
  const n = name.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  return c === n || c.includes(n) || n.includes(c);
}

async function resolveITGlueOrgId(
  orgName: string,
  itglue: ITGlueClient
): Promise<{ id: string; name: string } | null> {
  const orgs = await itglue.getOrganizations();
  const match = orgs.find(o => fuzzyMatch(orgName, o.attributes?.name ?? ''));
  return match ? { id: String(match.id), name: match.attributes?.name ?? orgName } : null;
}

async function resolveNinjaOrgId(
  orgName: string,
  ninja: NinjaOneClient
): Promise<{ id: number; name: string } | null> {
  type NinjaOrg = { id: number; name: string };
  const orgs: NinjaOrg[] = await ninja.listOrganizations();
  const match = orgs.find(o => fuzzyMatch(orgName, o.name ?? ''));
  return match ? { id: match.id, name: match.name } : null;
}

// ─── Skill 1: orgSnapshot ─────────────────────────────────────
//
// Returns a full org context block.
// Use for initial triage context injection.
//
// Inputs: org name (fuzzy), both clients
// Output: compact text block (600–900 tokens typical)

export async function orgSnapshot(
  orgName: string,
  itglue: ITGlueClient,
  ninja: NinjaOneClient
): Promise<string> {
  // Resolve both IDs in parallel
  const [itglueRef, ninjaRef] = await Promise.all([
    resolveITGlueOrgId(orgName, itglue).catch(() => null),
    resolveNinjaOrgId(orgName, ninja).catch(() => null),
  ]);

  if (!itglueRef && !ninjaRef) {
    return `[orgSnapshot] No org found matching "${orgName}" in IT Glue or NinjaOne.`;
  }

  // Fetch all data sources in parallel
  const [orgDetails, configs, contacts, docs, devices, alerts] = await Promise.all([
    itglueRef
      ? itglue.getOrganizationById(itglueRef.id).catch(() => null)
      : Promise.resolve(null),
    itglueRef
      ? itglue.getConfigurations(itglueRef.id).catch(() => [])
      : Promise.resolve([]),
    itglueRef
      ? itglue.getContacts(itglueRef.id).catch(() => [])
      : Promise.resolve([]),
    itglueRef
      ? itglue.getOrganizationDocuments(itglueRef.id).catch(() => [])
      : Promise.resolve([]),
    ninjaRef
      ? ninja.listDevicesByOrganization(String(ninjaRef.id)).catch(() => [])
      : Promise.resolve([]),
    ninjaRef
      ? ninja.listAlerts(String(ninjaRef.id)).catch(() => [])
      : Promise.resolve([]),
  ]);

  const resolvedName = itglueRef?.name ?? ninjaRef?.name ?? orgName;

  return buildOrgContextBlock({
    orgName: resolvedName,
    itglueOrg: orgDetails as ITGlueOrgRaw | null ?? null,
    itglueConfigs: (configs as ITGlueConfigRaw[]) ?? [],
    itglueContacts: (contacts as ITGlueContactRaw[]) ?? [],
    itglueDocs: (docs as ITGlueDocRaw[]) ?? [],
    ninjaDevices: (devices as NinjaDeviceRaw[]) ?? [],
    ninjaAlerts: (alerts as NinjaAlertRaw[]) ?? [],
  });
}

// ─── Skill 2: deviceTriage ────────────────────────────────────
//
// Returns device status + all active alerts for a device.
// Use for "why is X broken" type queries.

export async function deviceTriage(
  deviceName: string,
  ninja: NinjaOneClient,
  orgName?: string
): Promise<string> {
  // Get all devices (optionally scoped to org)
  let devices: NinjaDeviceRaw[] = [];

  if (orgName) {
    const ninjaRef = await resolveNinjaOrgId(orgName, ninja).catch(() => null);
    if (ninjaRef) {
      devices = (await ninja.listDevicesByOrganization(String(ninjaRef.id)).catch(() => [])) as NinjaDeviceRaw[];
    }
  } else {
    devices = (await ninja.listDevices({ limit: 500 }).catch(() => [])) as NinjaDeviceRaw[];
  }

  const device = devices.find(d =>
    fuzzyMatch(deviceName, d.systemName ?? d.dnsName ?? String(d.id))
  );

  if (!device) {
    return `[deviceTriage] Device "${deviceName}" not found${orgName ? ` in org "${orgName}"` : ''}.`;
  }

  const deviceId = Number(device.id);
  const alerts = (await ninja.listAlerts(device.organizationId != null ? String(device.organizationId) : undefined).catch(() => [])) as NinjaAlertRaw[];
  const deviceAlerts = alerts.filter(a => a.deviceId === deviceId);

  const deviceMap = new Map<number, string>([[deviceId, device.systemName ?? deviceName]]);

  const sections = [
    `=== DEVICE TRIAGE: ${device.systemName ?? device.dnsName ?? deviceName} ===`,
    formatNinjaDeviceList([device]),
    formatNinjaAlertList(deviceAlerts, deviceMap),
  ];

  return sections.join('\n\n');
}

// ─── Skill 3: networkContext ──────────────────────────────────
//
// Returns IT Glue configs + docs for an org.
// Use for network topology / infrastructure context.

export async function networkContext(
  orgName: string,
  itglue: ITGlueClient
): Promise<string> {
  const itglueRef = await resolveITGlueOrgId(orgName, itglue).catch(() => null);

  if (!itglueRef) {
    return `[networkContext] Org "${orgName}" not found in IT Glue.`;
  }

  const [configs, docs] = await Promise.all([
    itglue.getConfigurations(itglueRef.id).catch(() => []),
    itglue.getOrganizationDocuments(itglueRef.id).catch(() => []),
  ]);

  const sections = [
    `=== NETWORK CONTEXT: ${itglueRef.name.toUpperCase()} ===`,
  ];

  const cfgList = (configs as ITGlueConfigRaw[]) ?? [];
  const docList = (docs as ITGlueDocRaw[]) ?? [];

  if (cfgList.length) {
    // Group configs by type
    const byType = new Map<string, ITGlueConfigRaw[]>();
    for (const c of cfgList) {
      const t = c.attributes?.['configuration-type-name'] ?? 'Other';
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(c);
    }
    for (const [type, items] of byType) {
      const lines = items.map(c => {
        const a = c.attributes ?? {};
        const host = a.hostname ? ` | ${a.hostname}` : '';
        const ip = a['primary-ip-address'] ? ` | ${a['primary-ip-address']}` : '';
        const os = a['operating-system-name'] ? ` | ${a['operating-system-name']}` : '';
        const active = a.active === false ? ' | INACTIVE' : '';
        return `  • ${a.name ?? `ID:${c.id}`}${host}${ip}${os}${active}`;
      });
      sections.push(`[${type}] (${items.length})\n${lines.join('\n')}`);
    }
  } else {
    sections.push('[IT Glue Configs] None recorded');
  }

  if (docList.length) {
    const lines = docList.slice(0, 15).map(d => `  • ${d.attributes?.name ?? `ID:${d.id}`}`);
    sections.push(`[IT Glue Docs] (${docList.length})\n${lines.join('\n')}`);
  }

  return sections.join('\n\n');
}
