'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
    type AutotaskPicklistOption,
    getWorkflowCommandStatus,
    listAutotaskQueues,
    listAutotaskTicketFieldOptionsByField,
    mapHttpErrorToFrontendState,
    submitWorkflowCommand,
} from '@/lib/p0-ui-client';
import {
    SIDEBAR_STATE_KEY,
    SIDEBAR_HIDE_SUPPRESSED_KEY,
    API,
    FILTER_IDS,
    GLOBAL_QUEUE_FALLBACKS,
    normalizeText,
    resolveTicketChronology,
} from './utils';
import type { ActiveTicket, AutotaskQueueCatalogItem, QueueOption, ChatSidebarProps } from './types';

const GLOBAL_QUEUE_REMOVAL_GRACE_MS = 4000;

export interface SidebarState {
    // Auth / user
    user: ReturnType<typeof useAuth>['user'];
    userName: string;
    userInitials: string;
    jobTitle: string;
    avatar: string | undefined;
    updateProfile: ReturnType<typeof useAuth>['updateProfile'];

    // UI state
    settingsOpen: boolean;
    setSettingsOpen: (v: boolean) => void;
    profileOpen: boolean;
    setProfileOpen: (v: boolean) => void;
    filter: string;
    setFilter: (v: string) => void;
    scope: 'personal' | 'global';
    setScope: (v: 'personal' | 'global') => void;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    selectedGlobalQueue: string;
    setSelectedGlobalQueue: (v: string) => void;
    hideSuppressed: boolean;
    setHideSuppressed: (fn: (prev: boolean) => boolean) => void;
    theme: 'dark' | 'light';
    setTheme: (v: 'dark' | 'light') => void;
    clock: string;
    toggleTheme: () => void;

    // Autotask queues and status catalog
    globalQueuesCatalog: AutotaskQueueCatalogItem[];
    globalQueueTickets: ActiveTicket[];
    globalQueueTicketsLoading: boolean;
    statusCatalog: AutotaskPicklistOption[];
    statusEditorTarget: ActiveTicket | null;
    statusEditorQuery: string;
    setStatusEditorQuery: (v: string) => void;
    statusEditorLoading: boolean;
    statusEditorSaving: boolean;
    statusEditorError: string;
    statusOverrides: Record<string, { id: number; label: string }>;
    filteredStatusOptions: AutotaskPicklistOption[];
    globalStatusFilterOptions: Array<{ key: string; label: string; count: number }>;
    globalHiddenStatusKeys: Record<string, true>;
    toggleGlobalStatusFilter: (key: string) => void;
    resetGlobalStatusFilter: () => void;
    openStatusEditor: (ticket: ActiveTicket) => void;
    closeStatusEditor: () => void;
    handleSelectStatus: (option: AutotaskPicklistOption) => Promise<void>;
    resolveTicketStatusLabel: (ticket: ActiveTicket) => string;

    // Ticket lists and derived data
    listRef: React.RefObject<HTMLDivElement>;
    listLoading: boolean;
    suppressedCount: number;
    processing: number;
    visibleTickets: ActiveTicket[];
    queueOptions: QueueOption[];

    // Helpers
    persistSidebarState: (nextFilter: string, nextScrollTop?: number) => void;
}

export function useSidebarState(props: ChatSidebarProps): SidebarState {
    const { tickets, isLoading, draftTicket, onDraftStatusChange } = props;
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
    const [statusCatalog, setStatusCatalog] = useState<AutotaskPicklistOption[]>([]);
    const [statusEditorTarget, setStatusEditorTarget] = useState<ActiveTicket | null>(null);
    const [statusEditorQuery, setStatusEditorQuery] = useState('');
    const [statusEditorLoading, setStatusEditorLoading] = useState(false);
    const [statusEditorSaving, setStatusEditorSaving] = useState(false);
    const [statusEditorError, setStatusEditorError] = useState('');
    const [statusOverrides, setStatusOverrides] = useState<Record<string, { id: number; label: string }>>({});
    const [globalHiddenStatusKeys, setGlobalHiddenStatusKeys] = useState<Record<string, true>>({});
    const listRef = useRef<HTMLDivElement>(null);
    const restoredRef = useRef(false);

    // Resolve identity display deterministically from authenticated user payload.
    const emailDerivedName = normalizeText(String(user?.email || '').split('@')[0] || '', '');
    const userName = normalizeText(user?.name || '', '') || emailDerivedName || 'Account';
    const userInitials = userName.substring(0, 2).toUpperCase();
    const jobTitle = String(user?.preferences?.jobTitle || '') || (user?.role === 'owner' ? 'Owner' : user?.role === 'admin' ? 'Admin' : 'L2 Technician');
    const avatar = user?.avatar || undefined;

    const persistSidebarState = useCallback((nextFilter: string, nextScrollTop?: number) => {
        if (typeof window === 'undefined') return;
        const scrollTop = typeof nextScrollTop === 'number' ? nextScrollTop : listRef.current?.scrollTop ?? 0;
        sessionStorage.setItem(SIDEBAR_STATE_KEY, JSON.stringify({
            filter: nextFilter,
            scrollTop,
            scope,
            searchQuery,
            selectedGlobalQueue,
        }));
    }, [scope, searchQuery, selectedGlobalQueue]);

    // Initialize theme and hideSuppressed from localStorage
    useEffect(() => {
        const local = localStorage.getItem('theme') as 'dark' | 'light';
        if (local === 'dark' || local === 'light') setTheme(local);
        const hiddenSuppressed = localStorage.getItem(SIDEBAR_HIDE_SUPPRESSED_KEY);
        if (hiddenSuppressed === '0') setHideSuppressed(false);
        else if (hiddenSuppressed === '1') setHideSuppressed(true);
    }, []);

    // Sync theme from user preferences
    useEffect(() => {
        if (user?.preferences?.theme) {
            const themePref = String(user.preferences.theme) as 'dark' | 'light';
            setTheme(themePref);
            localStorage.setItem('theme', themePref);
        }
    }, [user?.preferences?.theme]);

    // Clock tick
    useEffect(() => {
        const tick = () => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        tick();
        const id = setInterval(tick, 30000);
        return () => clearInterval(id);
    }, []);

    // Apply theme to DOM
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    // Fetch Autotask queue catalog
    useEffect(() => {
        let cancelled = false;
        const fetchAutotaskQueues = async () => {
            try {
                const rows = await listAutotaskQueues();
                if (!Array.isArray(rows) || cancelled) return;

                const normalized = rows
                    .map((row) => {
                        const item = row as Partial<AutotaskQueueCatalogItem>;
                        const id = Number(item.id);
                        const label = String(item.label || '').trim();
                        if (!Number.isFinite(id) || !label) return null;
                        return { id, label, ...(typeof item.isActive === 'boolean' ? { isActive: item.isActive } : {}) };
                    })
                    .filter((item): item is AutotaskQueueCatalogItem => Boolean(item));

                if (normalized.length === 0) return;
                setGlobalQueuesCatalog(normalized);
            } catch {
                // Keep UI fallback queue labels when Autotask catalog is unavailable.
            }
        };
        fetchAutotaskQueues();
        return () => { cancelled = true; };
    }, []);

    // Fetch Autotask status catalog
    useEffect(() => {
        if (!statusEditorTarget && tickets.length === 0 && globalQueueTickets.length === 0 && !draftTicket && scope !== 'global') return;
        if (statusCatalog.length > 0) return;

        let ignore = false;
        setStatusEditorLoading(true);
        setStatusEditorError('');

        void (async () => {
            try {
                const rows = await listAutotaskTicketFieldOptionsByField('status');
                if (!ignore) setStatusCatalog(rows);
            } catch (err) {
                if (!ignore) {
                    const mapped = mapHttpErrorToFrontendState(err, 'Unable to load ticket statuses');
                    setStatusEditorError(`${mapped.summary}: ${mapped.detail}`);
                }
            } finally {
                if (!ignore) setStatusEditorLoading(false);
            }
        })();

        return () => { ignore = true; };
    }, [draftTicket, globalQueueTickets.length, scope, statusCatalog.length, statusEditorTarget, tickets.length]);

    const resolveTicketStatusLabel = useCallback((ticket: ActiveTicket): string => {
        const override = statusOverrides[ticket.id];
        if (override?.label) return override.label;

        const explicit = normalizeText(ticket.ticket_status_label, '');
        if (explicit) return explicit;

        const rawText = String(ticket.ticket_status_value ?? '').trim();
        if (!rawText) return ticket.isDraft ? 'New' : '';

        const numeric = Number.parseInt(rawText, 10);
        if (Number.isFinite(numeric)) {
            const matched = statusCatalog.find((option) => option.id === numeric);
            if (matched?.label) return matched.label;
        }
        return rawText;
    }, [statusCatalog, statusOverrides]);

    const openStatusEditor = (ticket: ActiveTicket) => {
        setStatusEditorTarget(ticket);
        setStatusEditorQuery('');
        setStatusEditorError('');
    };

    const closeStatusEditor = () => {
        setStatusEditorTarget(null);
        setStatusEditorQuery('');
        setStatusEditorError('');
        setStatusEditorSaving(false);
    };

    const handleSelectStatus = async (option: AutotaskPicklistOption) => {
        if (!statusEditorTarget) return;
        if (statusEditorTarget.isDraft) {
            onDraftStatusChange?.({ id: option.id, name: option.label });
            closeStatusEditor();
            return;
        }
        if (statusEditorSaving) return;
        setStatusEditorSaving(true);
        setStatusEditorError('');
        try {
            const command = await submitWorkflowCommand({
                command_type: 'update_status',
                ticket_id: statusEditorTarget.ticket_id,
                payload: { status: option.id },
                idempotency_key: `sidebar-status-${statusEditorTarget.ticket_id}-${option.id}-${Date.now()}`,
                auto_process: true,
            });
            const commandId = String((command as Record<string, unknown>)?.command_id || ((command as Record<string, unknown>)?.command as Record<string, unknown>)?.command_id || '').trim();
            if (!commandId) throw new Error('Workflow command id missing');

            let status = await getWorkflowCommandStatus(commandId);
            for (let attempt = 0; attempt < 12; attempt += 1) {
                const normalized = String(status?.status || '').trim().toLowerCase();
                if (normalized === 'completed' || normalized === 'failed' || normalized === 'dlq' || normalized === 'rejected') break;
                await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 250 : 500));
                status = await getWorkflowCommandStatus(commandId);
            }

            const normalized = String(status?.status || '').trim().toLowerCase();
            if (normalized !== 'completed') {
                const detail = String((status as unknown as Record<string, unknown>)?.last_error || '').trim();
                throw new Error(detail || 'Status update is still processing or failed in Autotask.');
            }

            setStatusOverrides((prev) => ({ ...prev, [statusEditorTarget.id]: { id: option.id, label: option.label } }));
            closeStatusEditor();
        } catch (err) {
            const mapped = mapHttpErrorToFrontendState(err, 'Unable to update ticket status');
            setStatusEditorError(`${mapped.summary}: ${mapped.detail}`);
            setStatusEditorSaving(false);
        }
    };

    // Restore sidebar state from session storage / URL
    useEffect(() => {
        if (restoredRef.current || typeof window === 'undefined') return;

        const urlFilter = searchParams?.get('sidebarFilter');
        const urlScope = searchParams?.get('sidebarScope');
        const rawSaved = sessionStorage.getItem(SIDEBAR_STATE_KEY);
        let saved: {
            filter?: string;
            scrollTop?: number;
            scope?: 'personal' | 'global';
            searchQuery?: string;
            selectedGlobalQueue?: string;
        } = {};
        if (rawSaved) {
            try { saved = JSON.parse(rawSaved) as typeof saved; } catch { saved = {}; }
        }
        const candidateFilter = urlFilter || saved.filter || 'all';
        const restoredFilter = FILTER_IDS.has(candidateFilter) ? candidateFilter : 'all';
        setFilter(restoredFilter);
        if (urlScope === 'personal' || urlScope === 'global') setScope(urlScope);
        else if (saved.scope === 'personal' || saved.scope === 'global') setScope(saved.scope);
        if (typeof saved.searchQuery === 'string') setSearchQuery(saved.searchQuery);
        if (typeof saved.selectedGlobalQueue === 'string') setSelectedGlobalQueue(saved.selectedGlobalQueue);

        requestAnimationFrame(() => {
            if (listRef.current && typeof saved.scrollTop === 'number') {
                listRef.current.scrollTop = saved.scrollTop;
            }
        });
        restoredRef.current = true;
    }, [searchParams]);

    // Persist filter/scope to URL + sessionStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(searchParams?.toString() ?? '');
        params.set('sidebarFilter', filter);
        params.set('sidebarScope', scope);
        const currentPath = pathname ?? window.location.pathname;
        window.history.replaceState(null, '', `${currentPath}?${params.toString()}`);
        persistSidebarState(filter);
    }, [filter, scope, pathname, searchParams, persistSidebarState]);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        const applyTheme = () => {
            setTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            if (user) updateProfile({ preferences: { ...user.preferences, theme: newTheme } });
        };
        if (!document.startViewTransition) { applyTheme(); return; }
        const transitionClass = newTheme === 'dark' ? 'theme-transition-to-dark' : 'theme-transition-to-light';
        document.documentElement.classList.add(transitionClass);
        const transition = document.startViewTransition(() => {
            flushSync(applyTheme);
        });
        transition.finished.finally(() => {
            document.documentElement.classList.remove(transitionClass);
        });
    };

    // Derived queue values
    const selectedGlobalQueueId = selectedGlobalQueue.startsWith('queue:')
        ? Number(selectedGlobalQueue.slice('queue:'.length))
        : null;
    const useDirectGlobalQueueSource = scope === 'global' && Number.isFinite(selectedGlobalQueueId);
    const listTickets = useDirectGlobalQueueSource ? globalQueueTickets : tickets;
    const listDraftTicket = draftTicket ?? null;
    const listLoading = useDirectGlobalQueueSource ? globalQueueTicketsLoading : Boolean(isLoading);
    const suppressedCount = listTickets.filter((t) => Boolean(t.suppressed)).length;
    const ticketsBySuppression = hideSuppressed ? listTickets.filter((t) => !t.suppressed) : listTickets;
    const processing = ticketsBySuppression.filter((t) => t.status === 'processing' || t.status === 'pending').length;
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const currentUserEmail = String(user?.email || '').trim().toLowerCase();
    const currentUserName = normalizeText(user?.name || '', '').toLowerCase();
    const currentUserAutotaskResourceId = String((user?.preferences as Record<string, unknown> | undefined)?.autotaskResourceId || '').trim();

    const getTicketQueueLabel = (ticket: ActiveTicket) => {
        const normalized = normalizeText(ticket.queue_name ?? ticket.queue ?? '', '');
        const lowered = normalized.toLowerCase();
        if (!normalized) return '';
        if (['unknown', 'n/a', 'none', 'null', 'email ingestion'].includes(lowered)) return '';
        return normalized;
    };
    const getTicketQueueId = (ticket: ActiveTicket) => {
        const value = Number(ticket.queue_id);
        return Number.isFinite(value) ? value : null;
    };
    const queueCatalogById = useMemo(() => {
        const map = new Map<number, string>();
        for (const q of globalQueuesCatalog) {
            const id = Number(q.id);
            const label = normalizeText(q.label, '');
            if (Number.isFinite(id) && label) map.set(id, label);
        }
        return map;
    }, [globalQueuesCatalog]);

    const getTicketQueueLabelResolved = (ticket: ActiveTicket) => {
        const direct = getTicketQueueLabel(ticket);
        if (direct) return direct;
        const id = getTicketQueueId(ticket);
        if (id === null) return '';
        return queueCatalogById.get(id) || '';
    };

    const getTicketAssigneeId = (ticket: ActiveTicket) =>
        String(ticket.assigned_resource_id ?? '').trim();
    const getTicketAssigneeEmail = (ticket: ActiveTicket) =>
        normalizeText(ticket.assigned_resource_email, '').toLowerCase();
    const getTicketAssigneeName = (ticket: ActiveTicket) =>
        normalizeText(ticket.assigned_resource_name, '').toLowerCase();

    const queueLabelsFromTickets = useMemo(() => Array.from(
        new Set(ticketsBySuppression.map(getTicketQueueLabelResolved).filter((v) => v !== ''))
    ).sort((a, b) => a.localeCompare(b)), [ticketsBySuppression, queueCatalogById]);

    const queueLabelsFromCatalog = globalQueuesCatalog
        .filter((q) => q.isActive !== false)
        .map((q) => q.label)
        .sort((a, b) => a.localeCompare(b));
    const hasQueueCatalog = queueLabelsFromCatalog.length > 0;
    const hasTicketQueueMetadata = ticketsBySuppression.some((ticket) =>
        Boolean(getTicketQueueLabelResolved(ticket)) || getTicketQueueId(ticket) !== null
    );

    const baseQueueOptions: QueueOption[] = [
        { id: 'all', label: 'All Queues' },
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
    const queueOptions: QueueOption[] = useMemo(() => {
        if (baseQueueOptions.some((option) => option.id === selectedGlobalQueue)) return baseQueueOptions;
        if (!selectedGlobalQueue.startsWith('queue:')) return baseQueueOptions;
        const queueId = Number(selectedGlobalQueue.slice('queue:'.length));
        if (!Number.isFinite(queueId)) return baseQueueOptions;

        const selectedOption: QueueOption = {
            id: selectedGlobalQueue,
            label: queueCatalogById.get(queueId) || `Queue ${queueId}`,
            queueId,
        };

        const [allOption, ...restOptions] = baseQueueOptions;
        if (!allOption) return [selectedOption];
        return [allOption, selectedOption, ...restOptions];
    }, [baseQueueOptions, selectedGlobalQueue, queueCatalogById]);
    const queueOptionIds = queueOptions.map((o) => o.id).join('|');

    const hasAssignmentMetadata = ticketsBySuppression.some((ticket) =>
        Boolean(getTicketAssigneeId(ticket) || getTicketAssigneeEmail(ticket) || getTicketAssigneeName(ticket))
    );
    const canResolveCurrentTechnician = Boolean(currentUserAutotaskResourceId || currentUserEmail || currentUserName);

    const matchesCurrentTechnician = useCallback((ticket: ActiveTicket): boolean => {
        const assignedId = getTicketAssigneeId(ticket);
        if (currentUserAutotaskResourceId && assignedId) {
            return assignedId === currentUserAutotaskResourceId;
        }
        const assignedEmail = getTicketAssigneeEmail(ticket);
        if (currentUserEmail && assignedEmail) return assignedEmail === currentUserEmail;
        const assignedName = getTicketAssigneeName(ticket);
        if (currentUserName && assignedName) return assignedName === currentUserName;
        return false;
    }, [currentUserAutotaskResourceId, currentUserEmail, currentUserName]);

    const hasAnyPersonalMatch = useMemo(
        () => ticketsBySuppression.some((ticket) => matchesCurrentTechnician(ticket)),
        [ticketsBySuppression, matchesCurrentTechnician]
    );

    useEffect(() => {
        if (queueOptions.some((o) => o.id === selectedGlobalQueue)) return;
        const isDeterministicQueueSelection = selectedGlobalQueue.startsWith('queue:')
            && Number.isFinite(Number(selectedGlobalQueue.slice('queue:'.length)));
        if (isDeterministicQueueSelection) return;
        setSelectedGlobalQueue('all');
    }, [queueOptionIds, selectedGlobalQueue]);

    useEffect(() => {
        if (!selectedGlobalQueue.startsWith('queue:')) return;
        if (!hasQueueCatalog) return;
        const selectedQueueId = Number(selectedGlobalQueue.slice('queue:'.length));
        if (!Number.isFinite(selectedQueueId)) return;
        const queueStillActive = globalQueuesCatalog.some((queue) =>
            queue.isActive !== false && Number(queue.id) === selectedQueueId
        );
        if (queueStillActive) return;

        const timeoutId = window.setTimeout(() => {
            setSelectedGlobalQueue('all');
        }, GLOBAL_QUEUE_REMOVAL_GRACE_MS);
        return () => window.clearTimeout(timeoutId);
    }, [selectedGlobalQueue, hasQueueCatalog, globalQueuesCatalog]);

    // Fetch tickets for a specific global queue
    useEffect(() => {
        let ignore = false;
        if (!useDirectGlobalQueueSource || !Number.isFinite(selectedGlobalQueueId)) {
            setGlobalQueueTickets([]);
            setGlobalQueueTicketsLoading(false);
            return () => { ignore = true; };
        }

        const fetchGlobalQueueTickets = async () => {
            setGlobalQueueTicketsLoading(true);
            try {
                const params = new URLSearchParams({ queueId: String(selectedGlobalQueueId), limit: '150' });
                const res = await fetch(`${API}/autotask/sidebar-tickets?${params.toString()}`, { credentials: 'include' });
                if (!res.ok) { if (!ignore) setGlobalQueueTickets([]); return; }
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
                            ? row.status : 'pending';
                        return {
                            id: internalId || displayId,
                            ticket_id: displayId || internalId,
                            ...(row.ticket_number ? { ticket_number: normalizeText(row.ticket_number, displayId || internalId) } : {}),
                            status,
                            ...(row.ticket_status_value !== undefined ? { ticket_status_value: row.ticket_status_value } : {}),
                            ...(row.ticket_status_label ? { ticket_status_label: normalizeText(row.ticket_status_label, '') } : {}),
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
        return () => { ignore = true; };
    }, [useDirectGlobalQueueSource, selectedGlobalQueueId]);

    // Ticket visibility: personal scope, queue selection, search query
    const scopedTickets = ticketsBySuppression.filter((ticket) => {
        if (scope === 'personal') {
            if (!hasAssignmentMetadata || !canResolveCurrentTechnician) return true;
            if (!hasAnyPersonalMatch) return true;
            return matchesCurrentTechnician(ticket);
        }
        if (selectedGlobalQueue === 'all') return true;
        if (!hasTicketQueueMetadata) return true;

        const selectedOption = queueOptions.find((o) => o.id === selectedGlobalQueue);
        const ticketQueueId = getTicketQueueId(ticket);
        if (selectedOption?.queueId !== undefined && ticketQueueId !== null) return ticketQueueId === selectedOption.queueId;
        if (selectedOption?.queueId !== undefined) return getTicketQueueLabelResolved(ticket).toLowerCase() === selectedOption.label.toLowerCase();
        return getTicketQueueLabelResolved(ticket).toLowerCase() === selectedGlobalQueue;
    });

    const visible = useMemo(() => scopedTickets.filter((t) => {
        const statusFilterKey = (() => {
            const rawValue = String(t.ticket_status_value ?? '').trim();
            const numeric = Number.parseInt(rawValue, 10);
            if (Number.isFinite(numeric)) return `id:${numeric}`;
            const label = resolveTicketStatusLabel(t).trim().toLowerCase();
            if (label) return `label:${label}`;
            return `workflow:${String(t.status || '').trim().toLowerCase()}`;
        })();
        const statusMatch = scope === 'global'
            ? !globalHiddenStatusKeys[statusFilterKey]
            : filter === 'all' ? true
                : filter === 'processing' ? t.status === 'processing' || t.status === 'pending'
                    : t.status === filter;
        if (!statusMatch) return false;
        if (!normalizedSearch) return true;

        const haystack = [
            t.ticket_id, t.id, t.title, t.description, t.company, t.org,
            t.requester, t.site, t.meta, t.queue_name, t.queue,
            t.assigned_resource_name, t.assigned_resource_email,
        ].map((v) => normalizeText(v, '')).join(' ').toLowerCase();

        return haystack.includes(normalizedSearch);
    }), [scopedTickets, scope, globalHiddenStatusKeys, resolveTicketStatusLabel, filter, normalizedSearch]);

    const sortedVisible = useMemo(() => {
        const ranked = visible.map((ticket, index) => {
            const chronology = resolveTicketChronology(ticket);
            return {
                ticket,
                index,
                timestamp: chronology.timestamp,
                hasCanonicalTimestamp: chronology.hasCanonicalTimestamp,
                sequence: chronology.sequence,
            };
        });
        ranked.sort((a, b) => {
            if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
            if (a.hasCanonicalTimestamp !== b.hasCanonicalTimestamp) {
                return a.hasCanonicalTimestamp ? -1 : 1;
            }
            if (a.sequence !== b.sequence) return b.sequence - a.sequence;
            return a.index - b.index;
        });
        return ranked.map((entry) => entry.ticket);
    }, [visible]);

    const visibleTickets = listDraftTicket ? [listDraftTicket, ...sortedVisible] : sortedVisible;

    const globalStatusFilterOptions = useMemo(() => {
        const counts = new Map<string, number>();
        const labels = new Map<string, string>();

        for (const option of statusCatalog) {
            const key = `id:${option.id}`;
            labels.set(key, option.label);
            if (!counts.has(key)) counts.set(key, 0);
        }

        for (const ticket of scopedTickets) {
            const rawValue = String(ticket.ticket_status_value ?? '').trim();
            const numeric = Number.parseInt(rawValue, 10);
            if (Number.isFinite(numeric)) {
                const key = `id:${numeric}`;
                const current = counts.get(key) || 0;
                counts.set(key, current + 1);
                if (!labels.has(key)) labels.set(key, resolveTicketStatusLabel(ticket));
                continue;
            }
            const resolvedLabel = resolveTicketStatusLabel(ticket);
            const normalizedLabel = resolvedLabel.trim().toLowerCase();
            const key = normalizedLabel ? `label:${normalizedLabel}` : `workflow:${String(ticket.status || '').trim().toLowerCase()}`;
            const current = counts.get(key) || 0;
            counts.set(key, current + 1);
            if (!labels.has(key)) labels.set(key, resolvedLabel || 'Workflow');
        }

        return Array.from(labels.entries())
            .map(([key, label]) => ({ key, label, count: counts.get(key) || 0 }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [scopedTickets, statusCatalog, resolveTicketStatusLabel]);

    useEffect(() => {
        if (scope !== 'global') return;
        const valid = new Set(globalStatusFilterOptions.map((option) => option.key));
        setGlobalHiddenStatusKeys((prev) => {
            const next: Record<string, true> = {};
            let changed = false;
            for (const key of Object.keys(prev)) {
                if (valid.has(key)) next[key] = true;
                else changed = true;
            }
            if (!changed && Object.keys(next).length === Object.keys(prev).length) return prev;
            return next;
        });
    }, [scope, globalStatusFilterOptions]);

    const toggleGlobalStatusFilter = useCallback((key: string) => {
        setGlobalHiddenStatusKeys((prev) => {
            if (prev[key]) {
                const rest = { ...prev };
                delete rest[key];
                return rest;
            }
            return { ...prev, [key]: true };
        });
    }, []);

    const resetGlobalStatusFilter = useCallback(() => {
        setGlobalHiddenStatusKeys({});
    }, []);

    const filteredStatusOptions = useMemo(() => {
        const needle = statusEditorQuery.trim().toLowerCase();
        return statusCatalog.filter((o) => !needle || o.label.toLowerCase().includes(needle));
    }, [statusCatalog, statusEditorQuery]);

    return {
        user,
        userName,
        userInitials,
        jobTitle,
        avatar,
        updateProfile,
        settingsOpen,
        setSettingsOpen,
        profileOpen,
        setProfileOpen,
        filter,
        setFilter,
        scope,
        setScope,
        searchQuery,
        setSearchQuery,
        selectedGlobalQueue,
        setSelectedGlobalQueue,
        hideSuppressed,
        setHideSuppressed,
        theme,
        setTheme,
        clock,
        toggleTheme,
        globalQueuesCatalog,
        globalQueueTickets,
        globalQueueTicketsLoading,
        statusCatalog,
        statusEditorTarget,
        statusEditorQuery,
        setStatusEditorQuery,
        statusEditorLoading,
        statusEditorSaving,
        statusEditorError,
        statusOverrides,
        filteredStatusOptions,
        globalStatusFilterOptions,
        globalHiddenStatusKeys,
        toggleGlobalStatusFilter,
        resetGlobalStatusFilter,
        openStatusEditor,
        closeStatusEditor,
        handleSelectStatus,
        resolveTicketStatusLabel,
        listRef,
        listLoading,
        suppressedCount,
        processing,
        visibleTickets,
        queueOptions,
        persistSidebarState,
    };
}
