'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SettingsModal from './SettingsModal';
import UserProfileDropdown from './UserProfileDropdown';
import ProfileModal from './ProfileModal';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';

export interface ActiveTicket {
  id: string;
  ticket_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  title?: string;
  description?: string;
  company?: string;
  requester?: string;
  org?: string;
  site?: string;
  age?: string;
  meta?: string;
  created_at?: string;
}

interface ChatSidebarProps {
  tickets: ActiveTicket[];
  currentTicketId?: string;
  onSelectTicket?: (ticketId: string) => void;
  isLoading?: boolean;
}

const SIDEBAR_STATE_KEY = 'chatSidebarState.v1';

const PRIORITY_COLOR: Record<string, string> = {
  P1: '#F97316',
  P2: '#EAB308',
  P3: '#5B7FFF',
  P4: 'rgba(228,234,248,0.14)',
};

const STATUS_CONFIG = {
  completed: { color: '#1DB98A', bg: 'rgba(29,185,138,0.09)', border: 'rgba(29,185,138,0.2)', dot: '#1DB98A', localeKey: 'statusDone', pulse: false },
  processing: { color: '#5B7FFF', bg: 'rgba(91,127,255,0.10)', border: 'rgba(91,127,255,0.22)', dot: '#5B7FFF', localeKey: 'statusProcessing', pulse: true },
  pending: { color: '#EAB308', bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.22)', dot: '#EAB308', localeKey: 'statusPending', pulse: true },
  failed: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)', dot: '#F87171', localeKey: 'statusFailed', pulse: false },
};

const FILTERS = [
  { id: 'all', localeKey: 'filterAll' },
  { id: 'processing', localeKey: 'statusProcessing' },
  { id: 'completed', localeKey: 'statusDone' },
  { id: 'failed', localeKey: 'statusFailed' },
];
const FILTER_IDS = new Set(FILTERS.map((f) => f.id));

const STATUS_LABEL: Record<ActiveTicket['status'], string> = {
  completed: 'DONE',
  processing: 'PROCESSING',
  pending: 'WAITING',
  failed: 'FAILED',
};

function MetaIcon({ type }: { type: 'clock' | 'company' | 'user' }) {
  const common = { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' } as const;
  if (type === 'clock') {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.8V8.1L10.5 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === 'company') {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M2.5 13.5h11M4.2 13.5V3.2h7.6v10.3M6.3 5.2h.01M9.7 5.2h.01M6.3 7.7h.01M9.7 7.7h.01M6.3 10.2h.01M9.7 10.2h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="8" cy="5.8" r="2.3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.6 13.5c.6-2.1 2.3-3.2 4.4-3.2s3.8 1.1 4.4 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function normalizeText(value?: string, fallback = ''): string {
  const raw = (value ?? '').trim();
  if (!raw) return fallback;

  const withoutTags = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => HTML_ENTITY_MAP[m] ?? ' ');
  return decoded.replace(/\s+/g, ' ').trim() || fallback;
}

function normalizeTicketTitle(value?: string, fallback = ''): string {
  const normalized = normalizeText(value, fallback);
  return normalized.replace(/\s+Description\s*:\s*.*$/i, '').trim() || fallback;
}

function formatCreatedAt(createdAt?: string, age?: string, justNowFallback = 'just now'): string {
  if (age && age.trim() !== '') return normalizeText(age, justNowFallback);
  if (!createdAt) return justNowFallback;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return justNowFallback;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatSidebar({ tickets, currentTicketId, onSelectTicket, isLoading }: ChatSidebarProps) {
  const t = useTranslations('ChatSidebar');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, updateProfile } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [clock, setClock] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef(false);

  const persistSidebarState = useCallback((nextFilter: string, nextScrollTop?: number) => {
    if (typeof window === 'undefined') return;
    const scrollTop = typeof nextScrollTop === 'number' ? nextScrollTop : listRef.current?.scrollTop ?? 0;
    sessionStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({ filter: nextFilter, scrollTop }));
  }, []);

  // Fallback defaults
  const userName = user?.name || "John Technician";
  const userInitials = userName.substring(0, 2).toUpperCase();
  const jobTitle = user?.preferences?.jobTitle || (user?.role === 'owner' ? t('roleOwner') : user?.role === 'admin' ? t('roleAdmin') : t('roleL2'));
  const avatar = user?.avatar || undefined;

  // Sync with local storage on mount to prevent clobbering
  useEffect(() => {
    const local = localStorage.getItem('theme') as 'dark' | 'light';
    if (local === 'dark' || local === 'light') {
      setTheme(local);
    }
  }, []);

  // Init theme from user preferences once loaded
  useEffect(() => {
    if (user?.preferences?.theme) {
      setTheme(user.preferences.theme);
      localStorage.setItem('theme', user.preferences.theme);
    }
  }, [user?.preferences?.theme]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (restoredRef.current || typeof window === 'undefined') return;

    const urlFilter = searchParams.get('sidebarFilter');
    const rawSaved = sessionStorage.getItem(SIDEBAR_STATE_KEY);
    let saved: { filter?: string; scrollTop?: number } = {};
    if (rawSaved) {
      try {
        saved = JSON.parse(rawSaved) as { filter?: string; scrollTop?: number };
      } catch {
        saved = {};
      }
    }
    const candidateFilter = urlFilter || saved.filter || 'all';
    const restoredFilter = FILTER_IDS.has(candidateFilter) ? candidateFilter : 'all';
    setFilter(restoredFilter);

    requestAnimationFrame(() => {
      if (listRef.current && typeof saved.scrollTop === 'number') {
        listRef.current.scrollTop = saved.scrollTop;
      }
    });

    restoredRef.current = true;
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('sidebarFilter', filter);
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    persistSidebarState(filter);
  }, [filter, pathname, searchParams, persistSidebarState]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Persist to user profile preferences
    if (user) {
      updateProfile({ preferences: { ...user.preferences, theme: newTheme } });
    }
  };

  const completed = tickets.filter((t) => t.status === 'completed').length;
  const processing = tickets.filter((t) => t.status === 'processing' || t.status === 'pending').length;

  const visible = tickets.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'processing') return t.status === 'processing' || t.status === 'pending';
    return t.status === filter;
  });

  return (
    <>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        currentName={userName}
        currentJobTitle={user?.preferences?.jobTitle || ''}
        currentAvatar={avatar ?? null}
        onSave={async (name, jobTitle, file) => {
          let base64Avatar = avatar;

          if (file) {
            // Convert file to base64
            base64Avatar = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = error => reject(error);
            });
          }

          await updateProfile({
            name,
            avatar: base64Avatar ?? null,
            preferences: { ...(user?.preferences || {}), jobTitle }
          });
        }}
      />
      <aside style={{ width: '100%', minWidth: 0, flexShrink: 0, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'var(--glow-sidebar)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Header */}
        <div style={{ padding: '18px 15px 13px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '14px' }}>
            <div style={{ width: '29px', height: '29px', borderRadius: '8px', background: 'linear-gradient(135deg, #6B8FFF 0%, #4060EE 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 16px rgba(91,127,255,0.32)', flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>{t('appName')}</div>
              <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginTop: '2px' }}>{t('appSubtitle')}</div>
            </div>
            {/* Clock + Theme toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.04em', minWidth: '46px', textAlign: 'right' }}>{clock}</span>
              <ThemeToggle theme={theme} onToggle={toggleTheme} size="sm" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 11px', borderRadius: '7px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px', flexShrink: 0 }}>
              <span className="animate-ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#1DB98A', opacity: 0.4 }} />
              <span style={{ position: 'relative', width: '8px', height: '8px', borderRadius: '50%', background: '#1DB98A' }} />
            </span>
            <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>{t('listeningAutotask')}</span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', padding: '9px 15px', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
          {[
            { val: processing, label: t('statActive'), color: 'var(--accent)' },
            { val: completed, label: t('statDoneToday'), color: 'var(--green)' },
            { val: tickets.length > 0 ? '4m' : '—', label: t('statAvgTime'), color: 'var(--text-muted)' },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '3px 0' }}>
              <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '15px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '3px', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '2px', padding: '12px 12px 8px', position: 'relative', zIndex: 1 }}>
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} style={{ flex: 1, padding: '5px 0', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', background: filter === f.id ? 'rgba(91,127,255,0.10)' : 'transparent', color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)', transition: 'var(--transition)' }}>
              {t(f.localeKey as any)}
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <div
          ref={listRef}
          onScroll={(e) => persistSidebarState(filter, (e.currentTarget as HTMLDivElement).scrollTop)}
          style={{ flex: 1, overflowY: 'auto', padding: '2px 10px 10px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 1 }}
        >
          {isLoading && tickets.length === 0 ? (
            [1, 2].map((i) => <div key={i} style={{ height: '80px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6 }} />)
          ) : visible.length === 0 ? (
            <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center' }}>{t('noTickets')}</p>
          ) : visible.map((ticket, idx) => {
            const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending;
            const priority = ticket.priority ?? 'P3';
            const isActive = currentTicketId === ticket.id;
            const normalized = {
              priority,
              id: normalizeText(ticket.ticket_id, ticket.id),
              status: STATUS_LABEL[ticket.status] ?? 'PENDING',
              title: normalizeTicketTitle(ticket.title, t('defaultIssue')),
              company: normalizeText(ticket.company ?? ticket.org, t('unknownOrg')),
              requester: normalizeText(ticket.requester ?? ticket.site, 'Unknown requester'),
              createdAt: ticket.created_at ?? '',
            };
            const createdAtLabel = formatCreatedAt(normalized.createdAt, ticket.age, t('justNow'));

            return (
              <button key={ticket.id} onClick={() => { persistSidebarState(filter); onSelectTicket?.(ticket.id); }}
                className="animate-fadeIn"
                style={{
                  position: 'relative',
                  padding: '12px 12px 12px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: isActive ? 'var(--bg-card-active)' : 'var(--bg-card)',
                  border: `1px solid ${isActive ? 'rgba(91,127,255,0.5)' : 'var(--border)'}`,
                  boxShadow: isActive ? '0 0 0 1px rgba(91,127,255,0.24), 0 10px 26px rgba(29,34,55,0.25)' : '0 6px 16px rgba(20,24,38,0.12)',
                  textAlign: 'left',
                  overflow: 'hidden',
                  width: '100%',
                  animationDelay: `${idx * 0.05}s`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  flexShrink: 0,
                  transition: 'var(--transition)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(91,127,255,0.3)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 22px rgba(20,24,38,0.2)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(20,24,38,0.12)';
                    (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                  }
                }}
              >
                {isActive && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 0% 50%, rgba(91,127,255,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: '3px', borderRadius: '0 3px 3px 0', background: PRIORITY_COLOR[priority] ?? '#5B7FFF', opacity: isActive ? 1 : 0.55 }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[priority] ?? '#5B7FFF', letterSpacing: '0.05em', flexShrink: 0 }}>{priority}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{normalized.id}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, flexShrink: 0 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                    {normalized.status}
                  </span>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 650, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.34, letterSpacing: '-0.012em', marginBottom: '10px', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '34px' }}>
                  {normalized.title}
                </p>
                <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: '9px', rowGap: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-faint)', flexShrink: 0 }}>
                    <MetaIcon type="clock" />
                    {createdAtLabel}
                  </span>
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <MetaIcon type="company" />
                    {normalized.company}
                  </span>
                  <span />
                  <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <MetaIcon type="user" />
                    {normalized.requester}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1, minHeight: '60px' }}>
          <UserProfileDropdown
            userName={userName}
            userRole={jobTitle}
            userInitials={userInitials}
            userAvatar={avatar ?? null}
            onOpenSettings={() => setSettingsOpen(true)}
            onEditProfile={() => setProfileOpen(true)}
          />
        </div>
      </aside>
    </>
  );
}
