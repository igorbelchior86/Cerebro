// ─────────────────────────────────────────────────────────────
// Formatters — Convert raw API payloads into compact, token-efficient
// text blocks for LLM context injection.
//
// Rules:
//  • Never return raw JSON — always pre-summarize
//  • Omit null / empty fields entirely
//  • Max one line per item
//  • Timestamps as relative ("2h ago") not ISO strings
// ─────────────────────────────────────────────────────────────

// ─── Shared helpers ───────────────────────────────────────────

function relativeTime(unixOrIso: number | string | null | undefined): string {
  if (!unixOrIso) return 'unknown';
  const ms = typeof unixOrIso === 'number' ? unixOrIso * 1000 : Date.parse(String(unixOrIso));
  if (isNaN(ms)) return 'unknown';
  const diffMs = Date.now() - ms;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function nodeClassLabel(nc: string | undefined): string {
  const map: Record<string, string> = {
    WINDOWS_WORKSTATION: 'Workstation',
    WINDOWS_SERVER: 'Server',
    MAC: 'Mac',
    LINUX_WORKSTATION: 'Linux WS',
    LINUX_SERVER: 'Linux Server',
    NMS_SWITCH: 'Switch',
    NMS_FIREWALL: 'Firewall',
    NMS_PRINTER: 'Printer',
    NMS_OTHER: 'Network Device',
    VMWARE_VM_GUEST: 'VM Guest',
    VMWARE_VM_HOST: 'VM Host',
  };
  return nc ? (map[nc] ?? nc) : 'Device';
}

function alertSeverityPrefix(sourceType: string | undefined): string {
  if (!sourceType) return '⚠';
  const t = sourceType.toUpperCase();
  if (t.includes('CRITICAL') || t.includes('OFFLINE') || t.includes('DOWN') || t.includes('FAIL')) return '🔴';
  if (t.includes('WARNING') || t.includes('DISK') || t.includes('CPU') || t.includes('MEMORY')) return '🟡';
  return '🔵';
}

// ─── NinjaOne Formatters ──────────────────────────────────────

export interface NinjaDeviceRaw {
  id?: number | string;
  systemName?: string;
  dnsName?: string;
  offline?: boolean;
  nodeClass?: string;
  organizationId?: number;
  locationId?: number;
  lastContact?: number;
  approvalStatus?: string;
  [key: string]: unknown;
}

export interface NinjaAlertRaw {
  uid?: string;
  deviceId?: number;
  message?: string;
  createTime?: number;
  sourceType?: string;
  subject?: string;
  conditionName?: string;
  [key: string]: unknown;
}

/**
 * Compact device list line: "• HOSTNAME | Type | online/OFFLINE | last Xh ago | ID:N"
 */
export function formatNinjaDevice(d: NinjaDeviceRaw): string {
  const name = d.systemName ?? d.dnsName ?? `ID:${d.id}`;
  const type = nodeClassLabel(d.nodeClass);
  const status = d.offline ? 'OFFLINE' : 'online';
  const last = relativeTime(d.lastContact);
  return `• ${name} | ${type} | ${status} | last: ${last} | ID:${d.id}`;
}

export function formatNinjaDeviceList(devices: NinjaDeviceRaw[], orgName?: string): string {
  if (!devices.length) return orgName ? `[NinjaOne] No devices found for ${orgName}` : '[NinjaOne] No devices found';
  const header = orgName ? `[NinjaOne Devices – ${orgName}] (${devices.length})` : `[NinjaOne Devices] (${devices.length})`;
  const offline = devices.filter(d => d.offline).length;
  const summary = offline > 0 ? ` ⚠ ${offline} OFFLINE` : '';
  return `${header}${summary}\n` + devices.map(formatNinjaDevice).join('\n');
}

/**
 * Compact alert line: "🔴 HOSTNAME: short message (Xh ago)"
 */
export function formatNinjaAlert(a: NinjaAlertRaw, deviceName?: string): string {
  const icon = alertSeverityPrefix(a.sourceType);
  const name = deviceName ?? `Device#${a.deviceId}`;
  // Truncate message to 100 chars
  const msg = (a.message ?? a.conditionName ?? 'Unknown alert').slice(0, 120);
  const age = relativeTime(a.createTime);
  return `${icon} ${name}: ${msg} (${age})`;
}

export function formatNinjaAlertList(
  alerts: NinjaAlertRaw[],
  deviceMap?: Map<number, string>,
  orgName?: string
): string {
  if (!alerts.length) return orgName ? `[NinjaOne Alerts – ${orgName}] None` : '[NinjaOne Alerts] None';
  const critical = alerts.filter(a => alertSeverityPrefix(a.sourceType) === '🔴').length;
  const warning = alerts.filter(a => alertSeverityPrefix(a.sourceType) === '🟡').length;
  const header = orgName
    ? `[NinjaOne Alerts – ${orgName}] (${alerts.length} total: ${critical} critical, ${warning} warning)`
    : `[NinjaOne Alerts] (${alerts.length} total: ${critical} critical, ${warning} warning)`;
  // Show max 20 alerts to stay token-efficient
  const shown = alerts.slice(0, 20);
  const lines = shown.map(a => formatNinjaAlert(a, deviceMap?.get(a.deviceId ?? -1)));
  if (alerts.length > 20) lines.push(`  ... and ${alerts.length - 20} more`);
  return header + '\n' + lines.join('\n');
}

// ─── IT Glue Formatters ───────────────────────────────────────

export interface ITGlueOrgRaw {
  id?: string;
  attributes?: {
    name?: string;
    'organization-type-name'?: string;
    'organization-status-name'?: string;
    alert?: string | null;
    'quick-notes'?: string | null;
    'psa-integration'?: string;
    'short-name'?: string;
    'primary-domain'?: string;
    [key: string]: unknown;
  };
}

export interface ITGlueConfigRaw {
  id?: string;
  attributes?: {
    name?: string;
    'configuration-type-name'?: string;
    hostname?: string;
    'primary-ip-address'?: string;
    'operating-system-name'?: string;
    active?: boolean;
    [key: string]: unknown;
  };
}

export interface ITGlueContactRaw {
  id?: string;
  attributes?: {
    name?: string;
    'first-name'?: string;
    'last-name'?: string;
    title?: string;
    'organization-name'?: string;
    important?: boolean | null;
    'contact-emails'?: Array<{ primary?: boolean; value?: string; 'label-name'?: string }>;
    'contact-phones'?: Array<{ primary?: boolean; 'formatted-value'?: string; 'label-name'?: string }>;
    [key: string]: unknown;
  };
}

export interface ITGluePasswordRaw {
  id?: string;
  attributes?: {
    name?: string;
    username?: string;
    url?: string;
    'password-category-name'?: string;
    'otp-enabled'?: boolean;
    archived?: boolean;
    [key: string]: unknown;
  };
}

export interface ITGlueDocRaw {
  id?: string;
  attributes?: {
    name?: string;
    'organization-name'?: string;
    'document-url'?: string;
    'updated-at'?: string;
    [key: string]: unknown;
  };
}

export function formatITGlueOrg(org: ITGlueOrgRaw): string {
  const a = org.attributes ?? {};
  const parts = [`[IT Glue Org] ${a.name ?? 'Unknown'} (ID: ${org.id})`];
  if (a['organization-type-name']) parts.push(`Type: ${a['organization-type-name']}`);
  if (a['organization-status-name']) parts.push(`Status: ${a['organization-status-name']}`);
  if (a.alert) parts.push(`⚠ Alert: ${a.alert}`);
  if (a['quick-notes']) parts.push(`Notes: ${String(a['quick-notes']).slice(0, 200)}`);
  if (a['psa-integration'] && a['psa-integration'] !== 'orphaned') parts.push(`PSA: ${a['psa-integration']}`);
  return parts.join(' | ');
}

export function formatITGlueConfigList(configs: ITGlueConfigRaw[], orgName?: string): string {
  if (!configs.length) return orgName ? `[IT Glue Configs – ${orgName}] None` : '[IT Glue Configs] None';
  const header = orgName ? `[IT Glue Configs – ${orgName}] (${configs.length})` : `[IT Glue Configs] (${configs.length})`;
  const lines = configs.map(c => {
    const a = c.attributes ?? {};
    const name = a.name ?? `ID:${c.id}`;
    const type = a['configuration-type-name'] ?? '';
    const host = a.hostname ? ` | host:${a.hostname}` : '';
    const ip = a['primary-ip-address'] ? ` | ip:${a['primary-ip-address']}` : '';
    const os = a['operating-system-name'] ? ` | ${a['operating-system-name']}` : '';
    const active = a.active === false ? ' | INACTIVE' : '';
    return `• ${name}${type ? ` [${type}]` : ''}${host}${ip}${os}${active}`;
  });
  return header + '\n' + lines.join('\n');
}

export function formatITGlueContactList(contacts: ITGlueContactRaw[], orgName?: string): string {
  if (!contacts.length) return orgName ? `[IT Glue Contacts – ${orgName}] None` : '[IT Glue Contacts] None';
  const header = orgName ? `[IT Glue Contacts – ${orgName}] (${contacts.length})` : `[IT Glue Contacts] (${contacts.length})`;
  const lines = contacts.map(c => {
    const a = c.attributes ?? {};
    const name = a.name ?? `${a['first-name'] ?? ''} ${a['last-name'] ?? ''}`.trim();
    const title = a.title ? ` | ${a.title}` : '';
    const email = a['contact-emails']?.find(e => e.primary)?.value ?? a['contact-emails']?.[0]?.value ?? '';
    const phone = a['contact-phones']?.find(p => p.primary)?.['formatted-value'] ?? '';
    const important = a.important ? ' ⭐' : '';
    const contact = [email, phone].filter(Boolean).join(' / ');
    return `• ${name}${title}${important}${contact ? ` | ${contact}` : ''}`;
  });
  return header + '\n' + lines.join('\n');
}

export function formatITGluePasswordList(passwords: ITGluePasswordRaw[], orgName?: string): string {
  if (!passwords.length) return orgName ? `[IT Glue Passwords – ${orgName}] None` : '[IT Glue Passwords] None';
  const active = passwords.filter(p => !p.attributes?.archived);
  const header = orgName
    ? `[IT Glue Passwords – ${orgName}] (${active.length} active)`
    : `[IT Glue Passwords] (${active.length} active)`;
  const lines = active.map(p => {
    const a = p.attributes ?? {};
    const cat = a['password-category-name'] ? ` [${a['password-category-name']}]` : '';
    const user = a.username ? ` | user: ${a.username}` : '';
    const url = a.url ? ` | ${a.url}` : '';
    const otp = a['otp-enabled'] ? ' | OTP' : '';
    return `• ${a.name ?? 'Unnamed'}${cat}${user}${url}${otp}`;
  });
  return header + '\n' + lines.join('\n');
}

export function formatITGlueDocList(docs: ITGlueDocRaw[], orgName?: string): string {
  if (!docs.length) return orgName ? `[IT Glue Docs – ${orgName}] None` : '[IT Glue Docs] None';
  const header = orgName ? `[IT Glue Docs – ${orgName}] (${docs.length})` : `[IT Glue Docs] (${docs.length})`;
  const lines = docs.map(d => {
    const a = d.attributes ?? {};
    const updated = a['updated-at'] ? ` | updated: ${relativeTime(a['updated-at'])}` : '';
    return `• ${a.name ?? `ID:${d.id}`}${updated}`;
  });
  return header + '\n' + lines.join('\n');
}

// ─── Cross-reference formatter ────────────────────────────────

/**
 * Builds a compact, complete org context block for LLM injection.
 * Token budget: ~600–900 tokens for a typical org.
 */
export function buildOrgContextBlock(params: {
  orgName: string;
  itglueOrg?: ITGlueOrgRaw | null;
  itglueConfigs?: ITGlueConfigRaw[];
  itglueContacts?: ITGlueContactRaw[];
  itglueDocs?: ITGlueDocRaw[];
  ninjaDevices?: NinjaDeviceRaw[];
  ninjaAlerts?: NinjaAlertRaw[];
}): string {
  const { orgName, itglueOrg, itglueConfigs, itglueContacts, itglueDocs, ninjaDevices, ninjaAlerts } = params;
  const sections: string[] = [`=== ${orgName.toUpperCase()} ===`];

  if (itglueOrg) sections.push(formatITGlueOrg(itglueOrg));
  if (itglueContacts?.length) sections.push(formatITGlueContactList(itglueContacts, orgName));
  if (itglueConfigs?.length) sections.push(formatITGlueConfigList(itglueConfigs, orgName));
  if (itglueDocs?.length) sections.push(formatITGlueDocList(itglueDocs, orgName));

  // Build device name map for alert resolution
  const deviceMap = new Map<number, string>();
  for (const d of ninjaDevices ?? []) {
    if (d.id != null) deviceMap.set(Number(d.id), d.systemName ?? d.dnsName ?? String(d.id));
  }

  if (ninjaDevices?.length) sections.push(formatNinjaDeviceList(ninjaDevices, orgName));
  if (ninjaAlerts !== undefined) sections.push(formatNinjaAlertList(ninjaAlerts, deviceMap, orgName));

  return sections.join('\n\n');
}
