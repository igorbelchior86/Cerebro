'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import CerebroLogo from './CerebroLogo';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

/* ─── Navigation items (grouped) ─────────────── */

const USER_NAV = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="2.5" />
        <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 7v5M8 5.5v.5" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const WORKSPACE_NAV = [
  {
    id: 'connections',
    label: 'Connections',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.5 5.5a4 4 0 0 1 0 5.66l-2 2a4 4 0 0 1-5.66-5.66l1-1" />
        <path d="M5.5 10.5a4 4 0 0 1 0-5.66l2-2a4 4 0 0 1 5.66 5.66l-1 1" />
      </svg>
    ),
  },
  {
    id: 'llm',
    label: 'LLM',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4h12M2 8h8M2 12h10" />
        <circle cx="13" cy="10.5" r="2" />
      </svg>
    ),
  },
  {
    id: 'team',
    label: 'Team',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5.5" cy="5" r="2.5" />
        <path d="M1 13c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
        <circle cx="11.5" cy="5" r="2" />
        <path d="M14 13c0-2-1.5-3.5-3-3.5" />
      </svg>
    ),
  },
];

const ALL_NAV = [...USER_NAV, ...WORKSPACE_NAV];

/* ─────────────── Section content ─────────────── */

// ─── Team ─────────────────────────────────────────────────────

interface TeamMember { id: string; email: string; name?: string; role: string; created_at: string; }

function SectionTeam({ canInvite }: { canInvite: boolean }) {
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState<'member' | 'admin'>('member');
  const [invLink, setInvLink] = useState('');
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/auth/team`, { credentials: 'include' });
        if (res.ok) setMembers(await res.json());
      } catch { /* silent */ }
    }
    load();
  }, [API]);

  const handleInvite = async () => {
    if (!invEmail) return;
    setInvLoading(true); setInvError(''); setInvLink('');
    try {
      const res = await fetch(`${API}/auth/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: invEmail, role: invRole }),
      });
      const data = await res.json();
      if (!res.ok) { setInvError(data.error || 'Invite failed'); return; }
      setInvLink(data.inviteLink);
      setInvEmail('');
    } catch {
      setInvError('Network error');
    } finally { setInvLoading(false); }
  };

  const ROLE_COLORS: Record<string, { bg: string; fg: string }> = {
    owner: { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' },
    admin: { bg: 'rgba(139,92,246,0.15)', fg: '#8b5cf6' },
    member: { bg: 'rgba(107,114,128,0.15)', fg: '#9ca3af' },
  };

  return (
    <div className="space-y-6">
      {/* Member list */}
      <div className="space-y-2">
        {members.map((m) => {
          const rc = ROLE_COLORS[m.role];
          return (
            <div key={m.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
              >
                {(m.name || m.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.name || m.email}</p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {m.name ? m.email : `Joined ${new Date(m.created_at).toLocaleDateString()}`}
                </p>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ background: rc?.bg ?? 'rgba(107,114,128,0.15)', color: rc?.fg ?? '#9ca3af' }}
              >
                {m.role}
              </span>
            </div>
          );
        })}
      </div>

      {/* Invite form (owner/admin only) */}
      {canInvite && (
        <>
          <Divider />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Invite a new member</p>
          <div className="flex gap-2">
            <input
              type="email" placeholder="email@company.com" value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-root)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <select value={invRole} onChange={(e) => setInvRole(e.target.value as 'member' | 'admin')}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-root)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button onClick={handleInvite} disabled={invLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent-1)', color: '#fff', opacity: invLoading ? 0.6 : 1 }}
            >
              {invLoading ? '…' : 'Invite'}
            </button>
          </div>
          {invError && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{invError}</p>}
          {invLink && (
            <div className="mt-2 p-3 rounded-lg text-xs break-all"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Invite link: </span>{invLink}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── General (user-level) ─────────────────────────────────────

function SectionGeneral({ theme, onToggleTheme }: { theme: 'dark' | 'light', onToggleTheme: () => void }) {
  return (
    <div className="space-y-6">
      <Row label="Appearance" description="Color scheme for the interface">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} size="md" />
      </Row>
      <Divider />
      <Row label="Language" description="UI display language">
        <SelectPill value="English" disabled />
      </Row>
    </div>
  );
}

// ─── Service logos ────────────────────────────────────────────
// Real brand logos stored in /public/logos/ — fetched from official company CDNs:

const SERVICE_META = {
  autotask: {
    title: 'Autotask PSA',
    description: 'Tickets, companies, contacts and configuration items.',
    apiHint: 'Admin → API → Resources → create an API-only user.',
    logoSrc: '/logos/autotask.png',
    logoBg: '#1a2332',
  },
  ninjaone: {
    title: 'NinjaOne',
    description: 'Endpoints, alerts, patching status and monitoring data.',
    apiHint: 'Administration → Apps → API → add a Client App (client credentials).',
    logoSrc: '/logos/ninjaone.png',
    logoBg: '#163754',
  },
  itglue: {
    title: 'IT Glue',
    description: 'Documentation, runbooks, network stacks and device records.',
    apiHint: 'Account → Settings → API Keys → generate a new key.',
    logoSrc: '/logos/itglue.png',
    logoBg: '#ffffff',
  },
} as const;

type ServiceId = keyof typeof SERVICE_META;

function ServiceLogo({ id, size = 40 }: { id: ServiceId; size?: number }) {
  const meta = SERVICE_META[id];
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: meta.logoBg,
        border: '1px solid var(--border-subtle)',
        padding: '6px',
      }}
    >
      <img src={meta.logoSrc} alt={meta.title} className="w-full h-full object-contain" />
    </div>
  );
}

// ─── Connections (workspace-level) ────────────────────────────

function SectionConnections() {
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';

  type ServiceStatus = 'connected' | 'misconfigured' | 'error' | 'unknown';
  interface HealthResult { name: string; service: string; status: ServiceStatus; detail: string; latencyMs?: number; }
  interface SavedCreds { configured: boolean;[k: string]: unknown; }

  const [health, setHealth] = useState<Record<string, HealthResult>>({});
  const [saved, setSaved] = useState<Record<string, SavedCreds>>({});
  const [loading, setLoading] = useState(false);
  const [activeConfig, setActiveConfig] = useState<ServiceId | null>(null);

  const [formData, setFormData] = useState<Record<string, string>>({});

  const [bannerError, setBannerError] = useState('');

  // userTriggered=true → show error banner; false (auto-load on mount) → silent
  async function loadAll(userTriggered = false) {
    setLoading(true);
    setBannerError('');
    try {
      const [hRes, cRes] = await Promise.all([
        fetch(`${API}/integrations/health`, { credentials: 'include' }),
        fetch(`${API}/integrations/credentials`, { credentials: 'include' }),
      ]);
      if (hRes.ok) {
        const hJson = await hRes.json();
        const hMap: Record<string, HealthResult> = {};
        for (const s of (hJson.services || [])) hMap[s.service] = s;
        setHealth(hMap);
      }
      if (cRes.ok) setSaved(await cRes.json());
    } catch (err: any) {
      if (userTriggered) setBannerError(err?.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(false); }, []);

  // ─── Save / Delete actions ────────────

  async function save(service: string, creds: Record<string, string>) {
    try {
      const res = await fetch(`${API}/integrations/credentials/${service}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Save failed' }));
        setBannerError(errData.error || 'Save failed');
        return;
      }
      setActiveConfig(null);
      loadAll(true);
    } catch (err: any) {
      setBannerError(err?.message || 'Save failed');
    }
  }

  async function disconnect(service: string) {
    try {
      await fetch(`${API}/integrations/credentials/${service}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setActiveConfig(null);
      loadAll(true);
    } catch { /* silent */ }
  }

  // ─── presenters ───

  const ALL_SERVICES: ServiceId[] = ['autotask', 'ninjaone', 'itglue'];

  function statusBadge(id: string, h: HealthResult | undefined, s: SavedCreds | undefined) {
    if (!s?.configured) return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(107,114,128,0.15)', color: '#9ca3af' }}>
        Not configured
      </span>
    );
    if (h?.status === 'connected') return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
        Connected{h.latencyMs ? ` · ${h.latencyMs}ms` : ''}
      </span>
    );
    if (h?.status === 'error') return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
        Error
      </span>
    );
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
        Checking…
      </span>
    );
  }

  const FIELDS: Record<ServiceId, { key: string; label: string; type?: string; placeholder?: string; options?: { value: string; label: string }[] }[]> = {
    autotask: [
      { key: 'apiIntegrationCode', label: 'API Integration Code', placeholder: 'e.g. ABCDEF123456' },
      { key: 'username', label: 'API Username', placeholder: 'api@company.com' },
      { key: 'secret', label: 'API Secret', type: 'password', placeholder: '••••••••' },
    ],
    ninjaone: [
      { key: 'clientId', label: 'Client ID', placeholder: 'e.g. abc-123' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
      { key: 'region', label: 'Region', options: [{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }, { value: 'oc', label: 'Oceania' }] },
    ],
    itglue: [
      { key: 'apiKey', label: 'API Key', type: 'password', placeholder: '••••••••' },
      { key: 'region', label: 'Region', options: [{ value: 'us', label: 'US' }, { value: 'eu', label: 'EU' }, { value: 'au', label: 'Australia' }] },
    ],
  };

  return (
    <div className="space-y-4">
      {bannerError && (
        <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
          {bannerError}
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Manage workspace-level integrations. These apply to all members.
        </p>
        <button onClick={() => loadAll(true)} disabled={loading}
          className="text-xs font-medium px-2.5 py-1 rounded-md"
          style={{ color: 'var(--accent-1)', background: 'rgba(91,127,255,0.08)', opacity: loading ? 0.5 : 1 }}
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>

      {/* Card grid — config opens inline right after the selected card */}
      <div className="grid grid-cols-2 gap-3">
        {ALL_SERVICES.map((id) => {
          const meta = SERVICE_META[id];
          const h = health[id];
          const s = saved[id];
          const isActive = activeConfig === id;
          const fields = FIELDS[id];

          return (
            <React.Fragment key={id}>
              {/* Service card */}
              <button
                onClick={() => {
                  if (isActive) { setActiveConfig(null); }
                  else { setActiveConfig(id); setFormData({}); setBannerError(''); }
                }}
                className="flex flex-col items-start p-4 rounded-xl text-left transition-all duration-150"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${isActive ? 'var(--accent-1)' : 'var(--border-subtle)'}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-1)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)'; }}
                onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'; } (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; }}
              >
                <div className="flex items-center gap-3 w-full">
                  <ServiceLogo id={id} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{meta.title}</p>
                    <div className="mt-1">{statusBadge(id, h, s)}</div>
                  </div>
                </div>
                <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {meta.description}
                </p>
                <p className="text-[10px] mt-1.5 leading-snug italic" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                  🔑 {meta.apiHint}
                </p>
              </button>

              {/* Inline config panel — spans full grid width, right below this card */}
              {isActive && (
                <div
                  className="p-4 rounded-xl space-y-4"
                  style={{ gridColumn: '1 / -1', background: 'var(--bg-root)', border: '1px solid var(--accent-1)' }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <ServiceLogo id={id} size={32} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {s?.configured ? 'Update or disconnect' : 'Enter credentials to connect'}
                      </p>
                    </div>
                  </div>

                  {fields.map((f) => (
                    <div key={f.key}>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>{f.label}</label>
                      {f.options ? (
                        <select
                          value={formData[f.key] || (s as any)?.[f.key] || f.options?.[0]?.value || ''}
                          onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg text-sm"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        >
                          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input
                          type={f.type || 'text'}
                          placeholder={f.placeholder}
                          value={formData[f.key] || ''}
                          onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-lg text-sm"
                          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        />
                      )}
                    </div>
                  ))}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        const creds: Record<string, string> = {};
                        for (const f of fields) {
                          const v = formData[f.key] || (s as any)?.[f.key] || (f.options ? f.options[0]?.value ?? '' : '');
                          if (v) creds[f.key] = v;
                        }
                        save(id, creds);
                      }}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: 'var(--accent-1)', color: '#fff' }}
                    >
                      Save
                    </button>
                    {s?.configured && (
                      <button
                        onClick={() => disconnect(id)}
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                      >
                        Disconnect
                      </button>
                    )}
                    <button
                      onClick={() => setActiveConfig(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}


// ─── LLM (workspace-level) ────────────────────────────────────

function SectionLLM() {
  const API = process.env.NEXT_PUBLIC_API_URL || '/api';
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'admin';

  const [settings, setSettings] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/auth/workspace/settings`, { credentials: 'include' });
        if (res.ok) setSettings(await res.json());
      } catch { /* silent */ }
    }
    load();
  }, [API]);

  const handleSave = async (key: string, value: string) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/auth/workspace/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [key]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
      }
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        LLM settings apply to all workspace members. {!canEdit && 'Only admins can change these.'}
      </p>
      <Row label="Provider" description="Primary LLM provider">
        <SelectPill value={settings.llmProvider || 'gemini'} disabled={!canEdit}
          onChange={(val) => handleSave('llmProvider', val)}
          options={['gemini', 'groq', 'anthropic', 'minimax']}
        />
      </Row>
      <Divider />
      <Row label="Model" description="LLM used for diagnosis and playbook generation">
        <SelectPill value={settings.llmModel || 'gemini-2.5-flash'} disabled={!canEdit}
          onChange={(val) => handleSave('llmModel', val)}
          options={['gemini-2.5-flash', 'gemini-2.5-pro', 'gemma-3-27b-it']}
        />
      </Row>
      <Divider />
      <Row label="Fallback provider" description="Used if primary provider throttles/fails">
        <SelectPill value={settings.llmFallbackProvider || 'groq'} disabled={!canEdit}
          onChange={(val) => handleSave('llmFallbackProvider', val)}
          options={['groq', 'gemini', 'anthropic', 'minimax']}
        />
      </Row>
      <Divider />
      <Row label="Fallback model" description="Used if primary model is unavailable">
        <SelectPill value={settings.llmFallbackModel || 'llama-3.1-8b-instant'} disabled={!canEdit}
          onChange={(val) => handleSave('llmFallbackModel', val)}
          options={['llama-3.1-8b-instant', 'gemini-2.5-flash', 'claude-3-5-sonnet-20241022']}
        />
      </Row>
      <Divider />
      <Row label="Max tokens" description="Maximum tokens per LLM response">
        <SelectPill value={settings.llmMaxTokens || '3000'} disabled={!canEdit}
          onChange={(val) => handleSave('llmMaxTokens', val)}
          options={['1200', '2000', '3000', '4096', '8192']}
        />
      </Row>
      <Divider />
      <Row label="Temperature" description="Controls output creativity (lower = more deterministic)">
        <SelectPill value={settings.llmTemperature || '0.2'} disabled={!canEdit}
          onChange={(val) => handleSave('llmTemperature', val)}
          options={['0.0', '0.1', '0.2', '0.5', '0.7', '1.0']}
        />
      </Row>
      <Divider />
      <Row label="Ticket polling interval" description="How often to check for new Autotask tickets">
        <SelectPill value={settings.pollingInterval || '30 seconds'} disabled={!canEdit}
          onChange={(val) => handleSave('pollingInterval', val)}
          options={['10 seconds', '30 seconds', '60 seconds', '5 minutes']}
        />
      </Row>
      <Divider />
      <Row label="Gemini RPM limit" description="Requests per minute cap (free-tier guardrail)">
        <SelectPill value={settings.geminiLimitRpm || '5'} disabled={!canEdit}
          onChange={(val) => handleSave('geminiLimitRpm', val)}
          options={['3', '5', '10', '20']}
        />
      </Row>
      <Divider />
      <Row label="Gemini RPD limit" description="Requests per day cap (free-tier guardrail)">
        <SelectPill value={settings.geminiLimitRpd || '20'} disabled={!canEdit}
          onChange={(val) => handleSave('geminiLimitRpd', val)}
          options={['20', '50', '100', '500']}
        />
      </Row>
      <Divider />
      <Row label="Gemini TPM limit" description="Input tokens per minute cap">
        <SelectPill value={settings.geminiLimitTpm || '250000'} disabled={!canEdit}
          onChange={(val) => handleSave('geminiLimitTpm', val)}
          options={['50000', '100000', '250000', '500000']}
        />
      </Row>
      <Divider />
      <Row label="Gemini retry max" description="Retries on 429 before failing ticket">
        <SelectPill value={settings.geminiRetryMax || '2'} disabled={!canEdit}
          onChange={(val) => handleSave('geminiRetryMax', val)}
          options={['0', '1', '2', '3', '5']}
        />
      </Row>
      {saving && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Saving…</p>}
    </div>
  );
}

// ─── About ────────────────────────────────────────────────────

function SectionAbout() {
  return (
    <div className="space-y-5">
      <div
        className="flex items-center gap-3 p-4 rounded-xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <CerebroLogo size={40} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Cerebro</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>IT Automation Copilot · v0.1.0</p>
        </div>
      </div>

      <div className="space-y-2">
        {[
          { label: 'Version', value: '0.1.0' },
          { label: 'Phase', value: 'MVP — Phase 4' },
          { label: 'Stack', value: 'Next.js 14 · Node.js · PostgreSQL' },
          { label: 'LLM Adapter', value: 'Groq / OpenAI / Anthropic' },
        ].map((r) => (
          <div key={r.label} className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.label}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{r.value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        All integrations are read-only. No data is written to Autotask, NinjaOne, or IT Glue.
      </p>
    </div>
  );
}

/* ─────────────── Shared primitives ─────────────── */

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border-subtle)' }} />;
}

function SelectPill({ value, disabled, onChange, options }: {
  value: string;
  disabled?: boolean;
  onChange?: (val: string) => void;
  options?: string[];
}) {
  if (disabled || !options || !onChange) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        {value}
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1.5 rounded-lg text-xs font-medium"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

/* ─────────────── Modal ─────────────── */

export default function SettingsModal({ open, onClose, theme, onToggleTheme }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState('general');
  const { user } = useAuth();
  const canInvite = user?.role === 'owner' || user?.role === 'admin';

  const SECTION_MAP: Record<string, React.ReactNode> = {
    general: <SectionGeneral theme={theme} onToggleTheme={onToggleTheme} />,
    connections: <SectionConnections />,
    llm: <SectionLLM />,
    about: <SectionAbout />,
    team: <SectionTeam canInvite={canInvite} />,
  };
  const modalRef = useRef<HTMLDivElement>(null);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Reset section on reopen */
  useEffect(() => { if (open) setActiveSection('general'); }, [open]);

  if (!open) return null;

  const activeItem = ALL_NAV.find((n) => n.id === activeSection);

  /* Render nav button */
  function NavButton({ item }: { item: typeof ALL_NAV[number] }) {
    const isActive = item.id === activeSection;
    return (
      <button
        key={item.id}
        onClick={() => setActiveSection(item.id)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-100"
        style={{
          background: isActive ? 'var(--bg-elevated)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: isActive ? 500 : 400,
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }}
      >
        <span style={{ color: isActive ? 'var(--accent-1)' : 'var(--text-muted)' }}>
          {item.icon}
        </span>
        {item.label}
      </button>
    );
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn"
      style={{
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(16px) saturate(190%)',
        WebkitBackdropFilter: 'blur(16px) saturate(190%)'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dialog */}
      <div
        ref={modalRef}
        className="relative flex w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'var(--modal-surface)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid var(--modal-border)',
          boxShadow: 'var(--shadow-panel), inset 0 0 0 1px var(--modal-border)',
          maxHeight: '580px',
          height: '580px',
        }}
      >
        {/* Left nav */}
        <div
          className="w-52 flex flex-col flex-shrink-0 py-5"
          style={{
            background: 'var(--modal-sidebar)',
            borderRight: '1px solid var(--modal-divider)',
          }}
        >
          <p
            className="px-5 pb-3 text-sm font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Settings
          </p>
          <nav className="flex-1 px-2 space-y-0.5">
            {/* My Preferences group */}
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              My Preferences
            </p>
            {USER_NAV.map((item) => <NavButton key={item.id} item={item} />)}

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 12px' }} />

            {/* Workspace group */}
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Workspace
            </p>
            {WORKSPACE_NAV.map((item) => <NavButton key={item.id} item={item} />)}
          </nav>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Content header */}
          <div
            className="px-6 py-4 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <p className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {activeItem?.label}
            </p>
            {/* Close button */}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-100"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 1l12 12M13 1L1 13" />
              </svg>
            </button>
          </div>

          {/* Section content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {SECTION_MAP[activeSection]}
          </div>
        </div>
      </div>
    </div>
  );
}
