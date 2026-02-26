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
  ticket_number?: string;
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
  manual_suppressed?: boolean | null;
  suppressed?: boolean | null;
  suppression_reason?: string | null;
  suppression_reason_label?: string | null;
  suppression_confidence?: number | null;
  queue?: string;
  queue_name?: string;
  queue_id?: number | string;
  assigned_resource_id?: number | string;
  assigned_resource_name?: string;
  assigned_resource_email?: string;
}

interface ChatSidebarProps {
  tickets: ActiveTicket[];
  currentTicketId?: string;
  onSelectTicket?: (ticketId: string) => void;
  isLoading?: boolean;
}

interface AutotaskQueueCatalogItem {
  id: number;
  label: string;
  isActive?: boolean;
}

interface QueueOption {
  id: string;
  label: string;
  queueId?: number;
}

const SIDEBAR_STATE_KEY = 'chatSidebarState.v1';
const SIDEBAR_HIDE_SUPPRESSED_KEY = 'chatSidebarHideSuppressed.v1';

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
const GLOBAL_QUEUE_FALLBACKS = ['Service Desk', 'Escalations', 'Projects'];
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

function CerebroBrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="cerebro-mark-gradient" x1="3" y1="3" x2="19" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8AA2FF" />
          <stop offset="1" stopColor="#5E79D8" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="19" height="19" rx="7" fill="rgba(110,134,201,0.12)" stroke="rgba(110,134,201,0.28)" />
      <path d="M14.8 7.1a4.9 4.9 0 1 0 0 7.8" stroke="url(#cerebro-mark-gradient)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.1 9a2.8 2.8 0 1 0 0 4" stroke="url(#cerebro-mark-gradient)" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="14.9" cy="11" r="1.15" fill="#9CB1FF" />
      <path d="M6.2 11h4" stroke="rgba(156,177,255,0.72)" strokeWidth="1.4" strokeLinecap="round" />
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
  const [scope, setScope] = useState<'personal' | 'global'>('personal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGlobalQueue, setSelectedGlobalQueue] = useState('all');
  const [globalQueuesCatalog, setGlobalQueuesCatalog] = useState<AutotaskQueueCatalogItem[]>([]);
  const [globalQueueTickets, setGlobalQueueTickets] = useState<ActiveTicket[]>([]);
  const [globalQueueTicketsLoading, setGlobalQueueTicketsLoading] = useState(false);
  const [hideSuppressed, setHideSuppressed] = useState(true);
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
    const hiddenSuppressed = localStorage.getItem(SIDEBAR_HIDE_SUPPRESSED_KEY);
    if (hiddenSuppressed === '0') {
      setHideSuppressed(false);
    } else if (hiddenSuppressed === '1') {
      setHideSuppressed(true);
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
    let cancelled = false;

    const fetchAutotaskQueues = async () => {
      try {
        const res = await fetch(`${API}/autotask/queues`, { credentials: 'include' });
        if (!res.ok) return;
        const payload = await res.json().catch(() => null) as { success?: boolean; data?: unknown[] } | null;
        if (!payload?.success || !Array.isArray(payload.data) || cancelled) return;

        const normalized = payload.data
          .map((row) => {
            const item = row as Partial<AutotaskQueueCatalogItem>;
            const id = Number(item.id);
            const label = String(item.label || '').trim();
            if (!Number.isFinite(id) || !label) return null;
            return {
              id,
              label,
              ...(typeof item.isActive === 'boolean' ? { isActive: item.isActive } : {}),
            };
          })
          .filter((item): item is AutotaskQueueCatalogItem => Boolean(item));

        setGlobalQueuesCatalog(normalized);
      } catch {
        // Keep UI fallback queue labels when Autotask catalog is unavailable.
      }
    };

    fetchAutotaskQueues();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const selectedGlobalQueueId = selectedGlobalQueue.startsWith('queue:')
    ? Number(selectedGlobalQueue.slice('queue:'.length))
    : null;
  const useDirectGlobalQueueSource = scope === 'global' && Number.isFinite(selectedGlobalQueueId);
  const listTickets = useDirectGlobalQueueSource ? globalQueueTickets : tickets;
  const listLoading = useDirectGlobalQueueSource ? globalQueueTicketsLoading : Boolean(isLoading);
  const suppressedCount = listTickets.filter((t) => Boolean(t.suppressed)).length;
  const ticketsBySuppression = hideSuppressed ? listTickets.filter((t) => !t.suppressed) : listTickets;
  const completed = ticketsBySuppression.filter((t) => t.status === 'completed').length;
  const processing = ticketsBySuppression.filter((t) => t.status === 'processing' || t.status === 'pending').length;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const currentUserEmail = String(user?.email || '').trim().toLowerCase();
  const currentUserName = normalizeText(user?.name || '', '').toLowerCase();

  const getTicketQueueLabel = (ticket: ActiveTicket) => {
    const normalized = normalizeText(ticket.queue_name ?? ticket.queue ?? '', '');
    const lowered = normalized.toLowerCase();
    if (!normalized) return '';
    if (
      lowered === 'unknown' ||
      lowered === 'n/a' ||
      lowered === 'none' ||
      lowered === 'null' ||
      lowered === 'email ingestion'
    ) return '';
    return normalized;
  };
  const getTicketQueueId = (ticket: ActiveTicket) => {
    const value = Number(ticket.queue_id);
    return Number.isFinite(value) ? value : null;
  };
  const getTicketAssigneeEmail = (ticket: ActiveTicket) =>
    normalizeText(ticket.assigned_resource_email, '').toLowerCase();
  const getTicketAssigneeName = (ticket: ActiveTicket) =>
    normalizeText(ticket.assigned_resource_name, '').toLowerCase();

  const queueLabelsFromTickets = Array.from(
    new Set(
      ticketsBySuppression
        .map(getTicketQueueLabel)
        .filter((value) => value !== '')
    )
  ).sort((a, b) => a.localeCompare(b));
  const queueLabelsFromCatalog = globalQueuesCatalog
    .filter((q) => q.isActive !== false)
    .map((q) => q.label)
    .sort((a, b) => a.localeCompare(b));
  const hasQueueCatalog = queueLabelsFromCatalog.length > 0;
  const hasTicketQueueMetadata = ticketsBySuppression.some((ticket) =>
    Boolean(getTicketQueueLabel(ticket)) || getTicketQueueId(ticket) !== null
  );
  const queueOptions: QueueOption[] = [
    { id: 'all', label: t('globalAllQueues') },
    ...(hasQueueCatalog
      ? globalQueuesCatalog
          .filter((q) => q.isActive !== false)
          .sort((a, b) => a.label.localeCompare(b.label))
          .map((q) => ({ id: `queue:${q.id}`, label: q.label, queueId: q.id }))
      : (queueLabelsFromTickets.length > 0 ? queueLabelsFromTickets : GLOBAL_QUEUE_FALLBACKS).map((label) => ({
          id: label.toLowerCase(),
          label,
        }))),
  ];
  const queueOptionIds = queueOptions.map((option) => option.id).join('|');
  const hasAssignmentMetadata = ticketsBySuppression.some((ticket) =>
    Boolean(getTicketAssigneeEmail(ticket) || getTicketAssigneeName(ticket))
  );
  const canResolveCurrentTechnician = Boolean(currentUserEmail || currentUserName);

  useEffect(() => {
    if (!queueOptions.some((option) => option.id === selectedGlobalQueue)) {
      setSelectedGlobalQueue('all');
    }
  }, [queueOptionIds, selectedGlobalQueue]);

  useEffect(() => {
    let ignore = false;

    if (!useDirectGlobalQueueSource || !Number.isFinite(selectedGlobalQueueId)) {
      setGlobalQueueTickets([]);
      setGlobalQueueTicketsLoading(false);
      return () => {
        ignore = true;
      };
    }

    const fetchGlobalQueueTickets = async () => {
      setGlobalQueueTicketsLoading(true);
      try {
        const params = new URLSearchParams({
          queueId: String(selectedGlobalQueueId),
          limit: '150',
        });
        const res = await fetch(`${API}/autotask/sidebar-tickets?${params.toString()}`, { credentials: 'include' });
        if (!res.ok) {
          if (!ignore) setGlobalQueueTickets([]);
          return;
        }
        const payload = await res.json().catch(() => null) as { success?: boolean; data?: unknown[] } | null;
        if (!payload?.success || !Array.isArray(payload.data) || ignore) {
          if (!ignore) setGlobalQueueTickets([]);
          return;
        }

        const normalized = payload.data
          .map((row) => row as Partial<ActiveTicket>)
          .map((row) => {
            const internalId = normalizeText(row.id, '');
            const displayId = normalizeText(row.ticket_number ?? row.ticket_id, internalId);
            if (!internalId && !displayId) return null;
            const status = row.status && ['pending', 'processing', 'completed', 'failed'].includes(row.status)
              ? row.status
              : 'pending';
            return {
              id: internalId || displayId,
              ticket_id: displayId || internalId,
              ...(row.ticket_number ? { ticket_number: normalizeText(row.ticket_number, displayId || internalId) } : {}),
              status,
              ...(row.priority ? { priority: row.priority } : {}),
              ...(row.title ? { title: row.title } : {}),
              ...(row.description ? { description: row.description } : {}),
              ...(row.company ? { company: row.company } : {}),
              ...(row.requester ? { requester: row.requester } : {}),
              ...(row.org ? { org: row.org } : {}),
              ...(row.site ? { site: row.site } : {}),
              ...(row.created_at ? { created_at: row.created_at } : {}),
              ...(row.queue ? { queue: row.queue } : {}),
              ...(row.queue_name ? { queue_name: row.queue_name } : {}),
              ...(row.queue_id !== undefined ? { queue_id: row.queue_id } : {}),
            } as ActiveTicket;
          })
          .filter((item): item is ActiveTicket => Boolean(item));

        if (!ignore) setGlobalQueueTickets(normalized);
      } catch {
        if (!ignore) setGlobalQueueTickets([]);
      } finally {
        if (!ignore) setGlobalQueueTicketsLoading(false);
      }
    };

    fetchGlobalQueueTickets();
    return () => {
      ignore = true;
    };
  }, [useDirectGlobalQueueSource, selectedGlobalQueueId]);

  const scopedTickets = ticketsBySuppression.filter((ticket) => {
    if (scope === 'personal') {
      if (!hasAssignmentMetadata || !canResolveCurrentTechnician) return true;
      const assignedEmail = getTicketAssigneeEmail(ticket);
      const assignedName = getTicketAssigneeName(ticket);
      if (currentUserEmail && assignedEmail) return assignedEmail === currentUserEmail;
      if (currentUserName && assignedName) return assignedName === currentUserName;
      return false;
    }

    if (selectedGlobalQueue === 'all') return true;
    if (!hasTicketQueueMetadata) return true;

    const selectedOption = queueOptions.find((option) => option.id === selectedGlobalQueue);
    const ticketQueueId = getTicketQueueId(ticket);
    if (selectedOption?.queueId !== undefined && ticketQueueId !== null) {
      return ticketQueueId === selectedOption.queueId;
    }
    if (selectedOption?.queueId !== undefined) {
      return getTicketQueueLabel(ticket).toLowerCase() === selectedOption.label.toLowerCase();
    }

    return getTicketQueueLabel(ticket).toLowerCase() === selectedGlobalQueue;
  });

  const visible = scopedTickets.filter((t) => {
    const statusMatch = scope === 'global'
      ? true
      : filter === 'all'
        ? true
        : filter === 'processing'
          ? t.status === 'processing' || t.status === 'pending'
          : t.status === filter;
    if (!statusMatch) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      t.ticket_id,
      t.id,
      t.title,
      t.description,
      t.company,
      t.org,
      t.requester,
      t.site,
      t.meta,
      t.queue_name,
      t.queue,
      t.assigned_resource_name,
      t.assigned_resource_email,
    ]
      .map((v) => normalizeText(v, ''))
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedSearch);
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
      <aside style={{ width: '100%', minWidth: 0, flexShrink: 0, background: 'transparent', display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'var(--glow-sidebar)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: 0, padding: '16px 12px 12px 12px' }}>
          {/* 1. Header Card */}
          <div style={{ borderRadius: '24px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '16px 14px 12px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid var(--bento-outline)', boxShadow: 'var(--shadow-card)', flexShrink: 0 }}>
                  <CerebroBrandMark />
                </div>
                <div style={{ minWidth: 0, marginRight: '4px' }}>
                  <div style={{ fontSize: '14px', lineHeight: 1, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Cerebro</div>
                </div>
                <label style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                    <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M10.5 10.5L13.6 13.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search"
                    aria-label="Search tickets"
                    style={{
                      width: '100%',
                      height: '34px',
                      borderRadius: '17px',
                      border: '1px solid var(--bento-outline)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      padding: '0 11px 0 30px',
                      fontSize: '12px',
                      outline: 'none',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                      transition: 'var(--transition)',
                    }}
                    onFocus={(e) => {
                      (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-accent)';
                      (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--accent-glow)';
                    }}
                    onBlur={(e) => {
                      (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--bento-outline)';
                      (e.currentTarget as HTMLInputElement).style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02)';
                    }}
                  />
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M8 4.8V8l2.4 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    {clock}
                  </span>
                </span>
                <ThemeToggle theme={theme} onToggle={toggleTheme} size="sm" />
              </div>
            </div>
          </div>

          {/* 2. Stats Card */}
          <div style={{ borderRadius: '20px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '6px', padding: '10px 10px 8px', position: 'relative', zIndex: 1 }}>
              {[
                { val: processing, label: t('statActive'), color: 'var(--accent)' },
                { val: completed, label: t('statDoneToday'), color: 'var(--green)' },
                { val: tickets.length > 0 ? '4m' : '—', label: t('statAvgTime'), color: 'var(--text-muted)' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center', padding: '6px 5px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '2px', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 10px 10px', position: 'relative', zIndex: 1 }}>
              <div
                role="tablist"
                aria-label={t('scopeSwitcherAria')}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '4px',
                  padding: '3px',
                  borderRadius: '11px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--bento-outline)',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: '3px',
                    left: '3px',
                    width: 'calc(50% - 3px)',
                    height: 'calc(100% - 6px)',
                    borderRadius: '8px',
                    background: 'var(--accent-muted)',
                    border: '1px solid var(--border-accent)',
                    boxShadow: '0 6px 14px rgba(20,24,38,0.12)',
                    transform: scope === 'personal' ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'var(--transition)',
                    pointerEvents: 'none',
                  }}
                />
                {(['personal', 'global'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={scope === mode}
                    onClick={() => setScope(mode)}
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      border: 'none',
                      background: 'transparent',
                      color: scope === mode ? 'var(--accent)' : 'var(--text-muted)',
                      fontSize: '9px',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      padding: '6px 0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    {mode === 'personal' ? t('scopePersonal') : t('scopeGlobal')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Ticket List Card */}
          <div style={{ borderRadius: '24px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

            {/* Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px 8px', position: 'relative', zIndex: 1 }}>
              {scope === 'personal' ? (
                <>
                  <div style={{ display: 'flex', gap: '3px', flex: 1, minWidth: 0, padding: '3px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                    {FILTERS.map((f) => (
                      <button type="button" key={f.id} onClick={() => setFilter(f.id)} style={{ flex: 1, padding: '6px 0', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', background: filter === f.id ? 'var(--accent-muted)' : 'transparent', color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)', transition: 'var(--transition)' }}>
                        {t(f.localeKey as any)}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-pressed={hideSuppressed}
                    title={hideSuppressed ? t('hideSuppressedEnabled') : t('hideSuppressedDisabled')}
                    onClick={() => {
                      setHideSuppressed((prev) => {
                        const next = !prev;
                        localStorage.setItem(SIDEBAR_HIDE_SUPPRESSED_KEY, next ? '1' : '0');
                        return next;
                      });
                    }}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: `1px solid ${hideSuppressed ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                      background: hideSuppressed ? 'var(--accent-muted)' : 'var(--bg-card)',
                      color: hideSuppressed ? 'var(--accent)' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'var(--transition)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M2.5 4h11M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    {suppressedCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        minWidth: '14px',
                        height: '14px',
                        padding: '0 3px',
                        borderRadius: '999px',
                        background: hideSuppressed ? 'var(--accent)' : 'var(--bg-card)',
                        border: `1px solid ${hideSuppressed ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                        color: hideSuppressed ? '#fff' : 'var(--text-muted)',
                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                        fontSize: '8px',
                        fontWeight: 700,
                        lineHeight: '12px',
                        textAlign: 'center',
                      }}>
                        {suppressedCount > 99 ? '99+' : suppressedCount}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
                  <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                    {t('globalQueueLabel')}
                  </span>
                  <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <select
                      value={selectedGlobalQueue}
                      onChange={(e) => setSelectedGlobalQueue(e.target.value)}
                      aria-label={t('globalQueueSelectAria')}
                      style={{
                        width: '100%',
                        height: '30px',
                        borderRadius: '10px',
                        border: '1px solid var(--bento-outline)',
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        padding: '0 28px 0 10px',
                        fontSize: '10px',
                        fontWeight: 600,
                        outline: 'none',
                        appearance: 'none',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      }}
                    >
                      {queueOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                      <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Ticket list */}
            <div
              ref={listRef}
              onScroll={(e) => persistSidebarState(filter, (e.currentTarget as HTMLDivElement).scrollTop)}
              style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: '7px', position: 'relative', zIndex: 1 }}
            >
              {listLoading && listTickets.length === 0 ? (
                [1, 2].map((i) => <div key={i} style={{ height: '80px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6 }} />)
              ) : visible.length === 0 ? (
                <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center' }}>{t('noTickets')}</p>
              ) : visible.map((ticket, idx) => {
                const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending;
                const priority = ticket.priority ?? 'P3';
                const isActive = currentTicketId === ticket.id;
                const isSuppressed = Boolean(ticket.suppressed);
                const suppressionLabel = normalizeText(ticket.suppression_reason_label ?? ticket.suppression_reason ?? '', t('suppressedReasonNoise'));
                const normalized = {
                  priority,
                  id: normalizeText(ticket.ticket_number ?? ticket.ticket_id, ticket.id),
                  status: STATUS_LABEL[ticket.status] ?? 'PENDING',
                  title: normalizeTicketTitle(ticket.title, t('defaultIssue')),
                  company: normalizeText(ticket.company ?? ticket.org, t('unknownOrg')),
                  requester: normalizeText(ticket.requester ?? ticket.site, 'Unknown requester'),
                  createdAt: ticket.created_at ?? '',
                };
                const createdAtLabel = formatCreatedAt(normalized.createdAt, ticket.age, t('justNow'));

                return (
                  <button type="button" key={ticket.id} onClick={() => { persistSidebarState(filter); onSelectTicket?.(ticket.id); }}
                    className="animate-fadeIn"
                    style={{
                      position: 'relative',
                      padding: '12px 12px 12px',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: isActive ? 'var(--bg-card-active)' : 'var(--bg-card)',
                      border: `1px solid ${isActive ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                      boxShadow: isActive ? '0 0 0 1px var(--accent-muted), 0 10px 22px rgba(5,7,11,0.18)' : '0 6px 14px rgba(5,7,11,0.08)',
                      textAlign: 'left',
                      overflow: 'hidden',
                      width: '100%',
                      animationDelay: `${idx * 0.05}s`,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      flexShrink: 0,
                      transition: 'var(--transition)',
                      opacity: isSuppressed && !isActive ? 0.88 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
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
                    {isActive && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 0% 50%, var(--accent-glow) 0%, transparent 70%)', pointerEvents: 'none' }} />}
                    <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: '3px', borderRadius: '0 3px 3px 0', background: PRIORITY_COLOR[priority] ?? '#5B7FFF', opacity: isActive ? 1 : 0.55 }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[priority] ?? '#5B7FFF', letterSpacing: '0.05em', flexShrink: 0 }}>{priority}</span>
                        <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{normalized.id}</span>
                      </div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                        {isSuppressed && !hideSuppressed && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', borderRadius: '999px', fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#C98A1B', background: 'rgba(201,138,27,0.10)', border: '1px solid rgba(201,138,27,0.22)' }}>
                            <svg width="7" height="7" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                              <path d="M2 5h6M4 3h2M4 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            {t('suppressedBadge')}
                          </span>
                        )}
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                          {normalized.status}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '13px', fontWeight: 650, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.34, letterSpacing: '-0.012em', marginBottom: isSuppressed && !hideSuppressed ? '6px' : '10px', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '34px' }}>
                      {normalized.title}
                    </p>
                    {isSuppressed && !hideSuppressed && (
                      <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: '#C98A1B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {suppressionLabel}
                        {typeof ticket.suppression_confidence === 'number' ? ` · ${Math.round(ticket.suppression_confidence * 100)}%` : ''}
                      </p>
                    )}
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
          </div>
        </div>
      </aside>
    </>
  );
}
