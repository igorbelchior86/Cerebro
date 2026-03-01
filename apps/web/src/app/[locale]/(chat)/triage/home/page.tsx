'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import ChatInput, { type ChatInputSubmitPayload } from '@/components/ChatInput';
import ChatMessage, { type Message } from '@/components/ChatMessage';
import ChatSidebar, { type ActiveTicket } from '@/components/ChatSidebar';
import { useNewTicketWorkspaceBridge } from '@/components/new-ticket-workspace-context';
import PlaybookPanel from '@/components/PlaybookPanel';
import ResizableLayout from '@/components/ResizableLayout';
import {
  type AutotaskCompanyOption,
  type AutotaskTicketDraftDefaults,
  type AutotaskTicketFieldKey,
  type AutotaskContactOption,
  type AutotaskPicklistOption,
  type AutotaskResourceOption,
  getAutotaskTicketDraftDefaults,
  getWorkflowCommandStatus,
  listAutotaskTicketFieldOptions,
  listAutotaskTicketFieldOptionsByField,
  mapHttpErrorToFrontendState,
  searchAutotaskCompanies,
  searchAutotaskContacts,
  searchAutotaskResources,
  submitWorkflowCommand,
} from '@/lib/p0-ui-client';
import { loadTriPaneSidebarTickets } from '@/lib/workflow-sidebar-adapter';
import { useRouter } from '@/i18n/routing';

type EditableContextKey =
  | 'Org'
  | 'Contact'
  | 'Additional contacts'
  | 'Primary'
  | 'Secondary'
  | 'Priority'
  | 'Issue Type'
  | 'Sub-Issue Type'
  | 'Service Level Agreement';

type ContextEditorOption = { id: number; label: string; sublabel?: string };
type TicketFieldOptionsCache = Partial<Record<AutotaskTicketFieldKey, AutotaskPicklistOption[]>>;

interface DraftReference {
  id: number;
  name: string;
  companyId?: number;
}

interface DraftState {
  title: string;
  body: string;
  status?: DraftReference;
  queue?: DraftReference;
  org?: DraftReference;
  contact?: DraftReference;
  additionalContact?: DraftReference;
  primaryTech?: DraftReference;
  secondaryTech?: DraftReference;
  priority?: DraftReference;
  issueType?: DraftReference;
  subIssueType?: DraftReference;
  serviceLevelAgreement?: DraftReference;
}

const EMPTY_DRAFT: DraftState = {
  title: '',
  body: '',
};

function createDraftReference(id: number, name: string, companyId?: number): DraftReference {
  return {
    id,
    name,
    ...(typeof companyId === 'number' ? { companyId } : {}),
  };
}

function normalizeDraftText(input: string): string {
  return String(input || '')
    .replace(/<div><br><\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>\s*<div>/gi, '\n')
    .replace(/<\/?div>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mapTicketFieldEditorToOptions(
  options: AutotaskPicklistOption[],
  query: string
): ContextEditorOption[] {
  const needle = query.trim().toLowerCase();
  return options
    .filter((row) => !needle || row.label.toLowerCase().includes(needle))
    .map((row) => ({
    id: row.id,
    label: row.label,
    ...(typeof row.isActive === 'boolean' ? { sublabel: row.isActive ? 'Active' : 'Inactive' } : {}),
  }));
}

function mapEditorToTicketFieldKey(
  key: EditableContextKey
): AutotaskTicketFieldKey | null {
  if (key === 'Priority') return 'priority';
  if (key === 'Issue Type') return 'issueType';
  if (key === 'Sub-Issue Type') return 'subIssueType';
  if (key === 'Service Level Agreement') return 'serviceLevelAgreement';
  return null;
}

function pickDraftDefaultOption(
  field: AutotaskTicketFieldKey,
  options: AutotaskPicklistOption[]
): AutotaskPicklistOption | null {
  if (!Array.isArray(options) || options.length === 0) return null;

  const active = options.filter((row) => row.isActive !== false);
  const pool = active.length > 0 ? active : options;
  const explicitDefault = pool.find((row) => row.isDefault);
  if (explicitDefault) return explicitDefault;

  if (field === 'status') {
    return (
      pool.find((row) => row.label.trim().toLowerCase() === 'new') ||
      pool.find((row) => row.label.trim().toLowerCase().includes('new')) ||
      pool[0] ||
      null
    );
  }

  if (field === 'priority') {
    return (
      pool.find((row) => /\bp3\b/i.test(row.label)) ||
      pool.find((row) => /\bmedium\b/i.test(row.label)) ||
      pool.find((row) => /\bnormal\b/i.test(row.label)) ||
      pool[0] ||
      null
    );
  }

  if (field === 'serviceLevelAgreement' || field === 'queue') {
    return pool[0] || null;
  }

  return null;
}

function mapDraftReferenceToSidebarPriority(value?: DraftReference): NonNullable<ActiveTicket['priority']> {
  const label = String(value?.name || '').trim().toLowerCase();
  if (!label) return 'P3';
  if (/\bp1\b|\bcritical\b/.test(label)) return 'P1';
  if (/\bp2\b|\bhigh\b/.test(label)) return 'P2';
  if (/\bp4\b|\blow\b/.test(label)) return 'P4';
  return 'P3';
}

function TechPill({
  label,
  name,
  type,
  onEdit,
  onRemove,
}: {
  label: string;
  name: string;
  type: 'primary' | 'secondary';
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isPrimary = type === 'primary';
  const bgColor = isPrimary ? 'var(--accent-muted)' : 'rgba(255, 255, 255, 0.04)';
  const hoverBgColor = isPrimary ? 'rgba(110, 134, 201, 0.12)' : 'rgba(255, 255, 255, 0.08)';
  const borderColor = isPrimary ? 'var(--border-accent)' : 'var(--bento-outline)';
  const hoverBorderColor = isPrimary ? 'var(--accent)' : 'var(--border-strong)';
  const textColor = isPrimary ? 'var(--accent)' : 'var(--text-secondary)';

  return (
    <div
      className="group flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border transition-all duration-200 cursor-default"
      style={{
        background: bgColor,
        borderColor,
        color: textColor,
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBgColor;
        e.currentTarget.style.borderColor = hoverBorderColor;
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = bgColor;
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <span style={{ fontSize: '8.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.5 }}>{label}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' }}>{name}</span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div style={{ width: '1px', height: '10px', background: 'var(--border)', margin: '0 4px', opacity: 0.5 }} />
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px',
            margin: '-2px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'inherit',
            transition: 'color 0.2s ease, transform 0.1s ease',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.color = 'inherit';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={`Edit ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: '4px',
            margin: '-2px 0',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'inherit',
            transition: 'color 0.2s ease, transform 0.1s ease',
            opacity: 0.7,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.7';
            e.currentTarget.style.color = 'inherit';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title={`Remove ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function DraftDecisionButton({
  tone,
  label,
  onClick,
  children,
}: {
  tone: 'accept' | 'reject';
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const isAccept = tone === 'accept';
  const bg = isAccept ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)';
  const border = isAccept ? 'rgba(16, 185, 129, 0.34)' : 'rgba(239, 68, 68, 0.34)';
  const glow = isAccept ? 'rgba(16, 185, 129, 0.22)' : 'rgba(239, 68, 68, 0.2)';
  const color = isAccept ? '#10B981' : '#EF4444';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: '30px',
        height: '30px',
        borderRadius: '999px',
        border: `1px solid ${border}`,
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: `0 0 0 1px ${glow}, 0 6px 14px rgba(15, 23, 42, 0.08)`,
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.filter = 'brightness(1.02)';
        e.currentTarget.style.boxShadow = `0 0 0 2px ${glow}, 0 10px 18px rgba(15, 23, 42, 0.12)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.filter = 'brightness(1)';
        e.currentTarget.style.boxShadow = `0 0 0 1px ${glow}, 0 6px 14px rgba(15, 23, 42, 0.08)`;
      }}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bridge = useNewTicketWorkspaceBridge();
  const isActive = bridge?.isActive ?? true;
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [sidebarTickets, setSidebarTickets] = useState<ActiveTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [activeContextEditor, setActiveContextEditor] = useState<EditableContextKey | null>(null);
  const [contextEditorQuery, setContextEditorQuery] = useState('');
  const [contextEditorLoading, setContextEditorLoading] = useState(false);
  const [contextEditorSaving, setContextEditorSaving] = useState(false);
  const [contextEditorError, setContextEditorError] = useState('');
  const [contextEditorOptions, setContextEditorOptions] = useState<ContextEditorOption[]>([]);
  const [ticketFieldOptionsCache, setTicketFieldOptionsCache] = useState<TicketFieldOptionsCache>({});
  const [ticketDraftDefaults, setTicketDraftDefaults] = useState<AutotaskTicketDraftDefaults | null>(null);
  const [isCreatingDraft, setIsCreatingDraft] = useState(false);
  const [draftActionError, setDraftActionError] = useState('');

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const tickets = await loadTriPaneSidebarTickets();
        setSidebarTickets(tickets);
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    void fetchTickets();
    const interval = setInterval(() => {
      void fetchTickets();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeOrgId = draft.org?.id ?? draft.contact?.companyId ?? draft.additionalContact?.companyId ?? null;
  const ticketTitle = draft.title.trim() || 'New Ticket';
  const primaryTech = draft.primaryTech?.name || 'Unassigned';
  const secondaryTech = draft.secondaryTech?.name || 'Unassigned';

  useEffect(() => {
    if (!isActive) return;

    const applyDraftDefaults = (
      source: TicketFieldOptionsCache,
      defaults?: AutotaskTicketDraftDefaults | null
    ) => {
      setDraft((prev) => {
        let changed = false;
        const next = { ...prev };

        if (!prev.status) {
          const preferred = defaults?.status || pickDraftDefaultOption('status', source.status || []);
          if (preferred) {
            next.status = createDraftReference(preferred.id, preferred.label);
            changed = true;
          }
        }

        if (!prev.priority) {
          const preferred = defaults?.priority || pickDraftDefaultOption('priority', source.priority || []);
          if (preferred) {
            next.priority = createDraftReference(preferred.id, preferred.label);
            changed = true;
          }
        }

        if (!prev.serviceLevelAgreement) {
          const preferred =
            defaults?.serviceLevelAgreement ||
            pickDraftDefaultOption('serviceLevelAgreement', source.serviceLevelAgreement || []);
          if (preferred) {
            next.serviceLevelAgreement = createDraftReference(preferred.id, preferred.label);
            changed = true;
          }
        }

        if (!prev.queue) {
          const preferred = defaults?.queue || pickDraftDefaultOption('queue', source.queue || []);
          if (preferred) {
            next.queue = createDraftReference(preferred.id, preferred.label);
            changed = true;
          }
        }

        if (!prev.issueType && defaults?.issueType) {
          next.issueType = createDraftReference(defaults.issueType.id, defaults.issueType.label);
          changed = true;
        }

        if (!prev.subIssueType && defaults?.subIssueType) {
          next.subIssueType = createDraftReference(defaults.subIssueType.id, defaults.subIssueType.label);
          changed = true;
        }

        return changed ? next : prev;
      });
    };

    const hasLoadedTrackedCatalogs =
      Array.isArray(ticketFieldOptionsCache.status) &&
      ticketFieldOptionsCache.status.length > 0 &&
      Array.isArray(ticketFieldOptionsCache.priority) &&
      ticketFieldOptionsCache.priority.length > 0 &&
      Array.isArray(ticketFieldOptionsCache.serviceLevelAgreement) &&
      ticketFieldOptionsCache.serviceLevelAgreement.length > 0;

    if (hasLoadedTrackedCatalogs) {
      applyDraftDefaults(ticketFieldOptionsCache, ticketDraftDefaults);
      return;
    }

    let ignore = false;
    void (async () => {
      try {
        const [all, defaults] = await Promise.all([
          listAutotaskTicketFieldOptions().catch(() => null),
          getAutotaskTicketDraftDefaults().catch(() => null),
        ]);
        if (ignore) return;

        const nextCache: TicketFieldOptionsCache = {};
        if (all) Object.assign(nextCache, all);

        const hasAnyCatalog = Object.values(nextCache).some((rows) => Array.isArray(rows) && rows.length > 0);
        if (hasAnyCatalog) {
          setTicketFieldOptionsCache((prev) => ({
            ...prev,
            ...nextCache,
          }));
          applyDraftDefaults(nextCache, defaults);
        }

        if (defaults) {
          setTicketDraftDefaults(defaults);
          if (!hasAnyCatalog) {
            applyDraftDefaults({}, defaults);
          }
        }
      } catch (err) {
        console.error('Failed to prefill new-ticket draft metadata', err);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    draft.priority,
    draft.queue,
    draft.serviceLevelAgreement,
    draft.status,
    isActive,
    ticketDraftDefaults,
    ticketFieldOptionsCache,
  ]);

  const playbookDraftData = useMemo(() => ({
    ticketId: 'New Ticket',
    context: [
      { key: 'Queue', val: draft.queue?.name || '-', editable: false },
      { key: 'Org', val: draft.org?.name || '-', editable: true },
      { key: 'Contact', val: draft.contact?.name || '-', editable: true },
      { key: 'Additional contacts', val: draft.additionalContact?.name || '-', editable: true },
      { key: 'Issue Type', val: draft.issueType?.name || '-', editable: true },
      { key: 'Sub-Issue Type', val: draft.subIssueType?.name || '-', editable: true },
      { key: 'Priority', val: draft.priority?.name || '-', editable: true },
      { key: 'Service Level Agreement', val: draft.serviceLevelAgreement?.name || '-', editable: true },
      { key: 'User Device', val: '-' },
      { key: 'ISP', val: '-' },
      { key: 'Phone Provider', val: '-' },
      { key: 'Firewall', val: '-' },
      { key: 'Switch', val: '-' },
      { key: 'WiFi', val: '-' },
      { key: 'Additional Devices', val: '-' },
    ],
    hypotheses: [],
    checklist: draft.body
      ? [
        {
          id: 'new-ticket-triage',
          text: `Queue: ${draft.queue?.name || 'Triage'}.`,
        },
      ]
      : [],
    escalate: [],
  }), [
    draft.additionalContact?.name,
    draft.body,
    draft.contact?.name,
    draft.issueType?.name,
    draft.org?.name,
    draft.priority?.name,
    draft.queue?.name,
    draft.serviceLevelAgreement?.name,
    draft.subIssueType?.name,
  ]);

  const draftMessages: Message[] = draft.body
    ? [
      {
        id: 'draft-body',
        role: 'user',
        content: draft.body,
        timestamp: new Date(),
        type: 'note',
        channel: 'external_psa_user',
      },
    ]
    : [];

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setActiveContextEditor(null);
    setContextEditorQuery('');
    setContextEditorLoading(false);
    setContextEditorSaving(false);
    setContextEditorError('');
    setContextEditorOptions([]);
    setDraftActionError('');
  };

  const discardDraft = () => {
    resetDraft();
    if (bridge?.onDismissDraft) {
      bridge.onDismissDraft();
      return;
    }

    const returnTicketId = String(searchParams.get('returnTicketId') || '').trim();
    if (returnTicketId) {
      router.push(`/triage/${returnTicketId}`, { scroll: false });
    }
  };

  const acceptDraft = async () => {
    if (isCreatingDraft) return;
    const title = draft.title.trim();
    const companyId = draft.org?.id;
    if (!title) {
      setDraftActionError('Title is required before creating the ticket.');
      return;
    }
    if (typeof companyId !== 'number') {
      setDraftActionError('Org is required before creating the ticket.');
      return;
    }
    if (typeof draft.status?.id !== 'number') {
      setDraftActionError('Status is required before creating the ticket.');
      return;
    }

    setIsCreatingDraft(true);
    setDraftActionError('');
    setActiveContextEditor(null);
    setContextEditorQuery('');
    setContextEditorError('');
    try {
      const command = await submitWorkflowCommand({
        command_type: 'create',
        payload: {
          title,
          description: draft.body.trim() || undefined,
          company_id: companyId,
          ...(draft.contact?.id ? { contact_id: draft.contact.id } : {}),
          ...(draft.primaryTech?.id ? { assignee_resource_id: draft.primaryTech.id } : {}),
          ...(draft.secondaryTech?.id ? { secondary_resource_id: draft.secondaryTech.id } : {}),
          ...(draft.queue?.id ? { queue_id: draft.queue.id } : {}),
          ...(draft.priority?.id ? { priority: draft.priority.id } : {}),
          ...(draft.issueType?.id ? { issue_type: draft.issueType.id } : {}),
          ...(draft.subIssueType?.id ? { sub_issue_type: draft.subIssueType.id } : {}),
          ...(draft.serviceLevelAgreement?.id ? { serviceLevelAgreementID: draft.serviceLevelAgreement.id } : {}),
          status: draft.status.id,
        },
        idempotency_key: `ui-draft-create-${companyId}-${Date.now()}`,
        auto_process: true,
      });
      const commandId = String(
        (command as any)?.command_id ||
        (command as any)?.command?.command_id ||
        ''
      ).trim();
      if (!commandId) throw new Error('Workflow command id missing');

      let status = await getWorkflowCommandStatus(commandId);
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const normalized = String(status?.status || '').trim().toLowerCase();
        if (
          normalized === 'completed' ||
          normalized === 'failed' ||
          normalized === 'dlq' ||
          normalized === 'rejected'
        ) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt < 4 ? 250 : 500));
        status = await getWorkflowCommandStatus(commandId);
      }

      const normalizedStatus = String(status?.status || '').trim().toLowerCase();
      if (normalizedStatus === 'failed' || normalizedStatus === 'dlq' || normalizedStatus === 'rejected') {
        const detail = String((status as any)?.last_error || '').trim();
        throw new Error(detail || 'Ticket creation failed in Autotask.');
      }
      if (normalizedStatus !== 'completed') {
        throw new Error('Ticket creation is still processing in Autotask. Wait a little longer and retry if it does not appear.');
      }

      const result = (status?.result || {}) as Record<string, unknown>;
      const createdTicketRef = String(
        result.external_ticket_number ||
        result.external_ticket_id ||
        (result.snapshot && typeof result.snapshot === 'object' ? (result.snapshot as Record<string, unknown>).ticket_id : '') ||
        ''
      ).trim();
      if (!createdTicketRef) {
        throw new Error('Autotask created the ticket, but no ticket identifier was returned.');
      }

      resetDraft();
      if (bridge?.onDraftCreated) {
        bridge.onDraftCreated(createdTicketRef);
        return;
      }
      router.push(`/triage/${createdTicketRef}`, { scroll: false });
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Unable to create ticket');
      setDraftActionError(`${mapped.summary}: ${mapped.detail}`);
    } finally {
      setIsCreatingDraft(false);
    }
  };

  const openContextEditor = (key: string) => {
    if (
      key !== 'Org' &&
      key !== 'Contact' &&
      key !== 'Additional contacts' &&
      key !== 'Primary' &&
      key !== 'Secondary' &&
      key !== 'Priority' &&
      key !== 'Issue Type' &&
      key !== 'Sub-Issue Type' &&
      key !== 'Service Level Agreement'
    ) return;
    setActiveContextEditor(key);
    setContextEditorQuery('');
    setContextEditorLoading(false);
    setContextEditorSaving(false);
    setContextEditorError('');
    setContextEditorOptions([]);
  };

  const closeContextEditor = () => {
    setActiveContextEditor(null);
    setContextEditorQuery('');
    setContextEditorLoading(false);
    setContextEditorSaving(false);
    setContextEditorError('');
    setContextEditorOptions([]);
  };

  useEffect(() => {
    if (!activeContextEditor) return;

    let ignore = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if ((activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts') && activeOrgId === null) {
      setContextEditorOptions([]);
      setContextEditorLoading(false);
      setContextEditorError('Select an Org first to list contacts.');
      return;
    }

    const ticketFieldKey = mapEditorToTicketFieldKey(activeContextEditor);
    if (ticketFieldKey) {
      const cached = ticketFieldOptionsCache[ticketFieldKey] || [];
      if (cached.length > 0) {
        setContextEditorLoading(false);
        setContextEditorError('');
        setContextEditorOptions(mapTicketFieldEditorToOptions(cached, contextEditorQuery));
        return;
      }
    }

    setContextEditorLoading(true);
    setContextEditorError('');

    const run = async () => {
      try {
        if (activeContextEditor === 'Org') {
          const rows = await searchAutotaskCompanies(contextEditorQuery, 30);
          if (!ignore) {
            setContextEditorOptions(rows.map((row: AutotaskCompanyOption) => ({
              id: row.id,
              label: row.name,
            })));
          }
          return;
        }

        if ((activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts') && activeOrgId !== null) {
          const rows = await searchAutotaskContacts(contextEditorQuery, activeOrgId, 30);
          if (!ignore) {
            setContextEditorOptions(rows.map((row: AutotaskContactOption) => ({
              id: row.id,
              label: row.name,
              ...(row.email ? { sublabel: row.email } : {}),
            })));
          }
          return;
        }

        if (ticketFieldKey) {
          const options = await listAutotaskTicketFieldOptionsByField(ticketFieldKey);
          if (!ignore) {
            setTicketFieldOptionsCache((prev) => ({ ...prev, [ticketFieldKey]: options }));
            setContextEditorOptions(mapTicketFieldEditorToOptions(options, contextEditorQuery));
          }
          return;
        }

        const rows = await searchAutotaskResources(contextEditorQuery, 30);
        if (!ignore) {
          setContextEditorOptions(rows.map((row: AutotaskResourceOption) => ({
            id: row.id,
            label: row.name,
            ...(row.email ? { sublabel: row.email } : {}),
          })));
        }
      } catch (err: any) {
        if (!ignore) {
          setContextEditorOptions([]);
          setContextEditorError(String(err?.message || 'Unable to load Autotask options'));
        }
      } finally {
        if (!ignore) {
          setContextEditorLoading(false);
        }
      }
    };

    if (ticketFieldKey) {
      void run();
    } else {
      const delayMs = contextEditorQuery.trim() ? 220 : 320;
      timer = setTimeout(() => {
        void run();
      }, delayMs);
    }

    return () => {
      ignore = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeContextEditor, activeOrgId, contextEditorQuery, ticketFieldOptionsCache]);

  const handleSelectContextOption = (option: ContextEditorOption) => {
    if (!activeContextEditor) return;
    setContextEditorSaving(true);

    setDraft((prev) => {
      if (activeContextEditor === 'Org') {
        return {
          ...prev,
          org: createDraftReference(option.id, option.label),
          ...(prev.contact ? { contact: createDraftReference(prev.contact.id, prev.contact.name, option.id) } : {}),
          ...(prev.additionalContact ? { additionalContact: createDraftReference(prev.additionalContact.id, prev.additionalContact.name, option.id) } : {}),
        };
      }

      if (activeContextEditor === 'Contact') {
        return {
          ...prev,
          contact: createDraftReference(option.id, option.label, activeOrgId ?? undefined),
        };
      }

      if (activeContextEditor === 'Additional contacts') {
        return {
          ...prev,
          additionalContact: createDraftReference(option.id, option.label, activeOrgId ?? undefined),
        };
      }

      if (activeContextEditor === 'Primary') {
        return {
          ...prev,
          primaryTech: createDraftReference(option.id, option.label),
        };
      }

      if (activeContextEditor === 'Priority') {
        return {
          ...prev,
          priority: createDraftReference(option.id, option.label),
        };
      }

      if (activeContextEditor === 'Issue Type') {
        return {
          ...prev,
          issueType: createDraftReference(option.id, option.label),
        };
      }

      if (activeContextEditor === 'Sub-Issue Type') {
        return {
          ...prev,
          subIssueType: createDraftReference(option.id, option.label),
        };
      }

      if (activeContextEditor === 'Service Level Agreement') {
        return {
          ...prev,
          serviceLevelAgreement: createDraftReference(option.id, option.label),
        };
      }

      return {
        ...prev,
        secondaryTech: createDraftReference(option.id, option.label),
      };
    });

    closeContextEditor();
  };

  const handleComposeBody = async (payload: ChatInputSubmitPayload) => {
    const nextBody = normalizeDraftText(payload.message);
    if (!nextBody) return;

    setDraft((prev) => ({
      ...prev,
      body: nextBody,
    }));
  };

  return (
    <ResizableLayout
      transparentSidebar={true}
      sidebarContent={(
        <ChatSidebar
          tickets={sidebarTickets}
          draftTicket={{
            id: '__draft__',
            ticket_id: 'New Ticket',
            ticket_number: 'New Ticket',
            status: 'pending',
            ...(draft.status?.id !== undefined ? { ticket_status_value: draft.status.id } : {}),
            ticket_status_label: draft.status?.name || 'New',
            priority: mapDraftReferenceToSidebarPriority(draft.priority),
            title: ticketTitle,
            company: draft.org?.name || '-',
            requester: draft.contact?.name || '-',
            ...(draft.queue?.name ? { queue: draft.queue.name } : {}),
            created_at: '',
            isDraft: true,
          }}
          currentTicketId="__draft__"
          onDraftStatusChange={(status) => setDraft((prev) => ({ ...prev, status: createDraftReference(status.id, status.name) }))}
          isLoading={isLoadingTickets}
          onSelectTicket={(id) => {
            if (bridge?.onSelectTicket) {
              bridge.onSelectTicket(id);
              return;
            }
            router.push(`/triage/${id}`, { scroll: false });
          }}
          onCreateTicket={resetDraft}
        />
      )}
      rightContent={(
        <PlaybookPanel
          content={null}
          status="ready"
          sessionStatus="pending"
          data={playbookDraftData}
          onEditContextItem={openContextEditor}
        />
      )}
      mainContent={(
        <div className="flex-1 flex flex-col" style={{ background: 'transparent', minWidth: 0, height: '100%', minHeight: 0, padding: '12px', gap: '8px' }}>
          <div style={{ border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', flexShrink: 0 }}>
            <div
              className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--bento-outline)', background: 'transparent' }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'var(--accent)',
                  boxShadow: '0 0 6px var(--accent)',
                }}
              />
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="New Ticket"
                aria-label="Ticket title"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)', marginLeft: 'auto' }}>
                Triage Draft
              </span>
            </div>
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: 'transparent' }}>
              <div className="flex flex-wrap items-center gap-2.5" style={{ minWidth: 0, flex: 1 }}>
                <TechPill
                  label="Primary"
                  name={primaryTech}
                  type="primary"
                  onEdit={() => openContextEditor('Primary')}
                  onRemove={() => setDraft((prev) => {
                    const next = { ...prev };
                    delete next.primaryTech;
                    return next;
                  })}
                />
                <TechPill
                  label="Secondary"
                  name={secondaryTech}
                  type="secondary"
                  onEdit={() => openContextEditor('Secondary')}
                  onRemove={() => setDraft((prev) => {
                    const next = { ...prev };
                    delete next.secondaryTech;
                    return next;
                  })}
                />
              </div>
              <div className="flex items-center gap-2" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <DraftDecisionButton tone="accept" label="Accept draft" onClick={() => { void acceptDraft(); }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </DraftDecisionButton>
                <DraftDecisionButton tone="reject" label="Discard draft" onClick={discardDraft}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </DraftDecisionButton>
              </div>
            </div>
            {draftActionError ? (
              <div
                className="px-4 pb-3"
                style={{
                  color: '#EF4444',
                  fontSize: '10.5px',
                  lineHeight: 1.5,
                }}
              >
                {draftActionError}
              </div>
            ) : null}
          </div>

          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: '14px 14px 8px',
              border: '1px solid var(--bento-outline)',
              borderRadius: '14px',
              background: 'var(--bg-card)',
              minHeight: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Ticket Body
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)' }}>
                {ticketTitle}
              </span>
            </div>

            {draftMessages.length === 0 ? (
              <div
                style={{
                  minHeight: '180px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  lineHeight: 1.7,
                  padding: '20px',
                }}
              >
                Use the existing shell to prepare the ticket: title in the header, client assignment in the context panel,
                tech assignment in the pills, and the chat bar to compose the ticket body. New tickets stay under Triage
                until queue UI exists.
              </div>
            ) : (
              draftMessages.map((msg, idx) => (
                <ChatMessage key={msg.id} message={msg} index={idx} />
              ))
            )}
          </div>

          <ChatInput
            onSubmit={handleComposeBody}
            placeholder="Compose ticket body"
            disabled={false}
            hints={[
              'Describe the issue',
              'List user impact',
              'Add troubleshooting tried',
              'State expected outcome',
            ]}
            showChannelToggle={false}
          />

          {activeContextEditor ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Edit ${activeContextEditor}`}
              className="animate-in fade-in duration-500 ease-out"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                background: 'rgba(2, 4, 8, 0.55)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '12vh',
              }}
              onClick={closeContextEditor}
            >
              <div
                className="animate-in zoom-in-[0.95] slide-in-from-top-4 duration-500 ease-out"
                style={{
                  width: 'min(640px, calc(100vw - 32px))',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'var(--bg-elevated)',
                  boxShadow: '0 32px 64px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
                  overflow: 'hidden',
                  transformOrigin: 'top center',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        Edit {activeContextEditor}
                      </h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                        {activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts'
                          ? activeOrgId !== null
                            ? `Listing contacts from selected Org (ID ${activeOrgId})`
                            : 'Select an Org first to list contacts'
                          : activeContextEditor === 'Org'
                            ? 'Source: Autotask company search'
                            : activeContextEditor === 'Priority' || activeContextEditor === 'Issue Type' || activeContextEditor === 'Sub-Issue Type' || activeContextEditor === 'Service Level Agreement'
                              ? 'Source: Autotask ticket field metadata'
                            : 'Source: Autotask resource search'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeContextEditor}
                      disabled={contextEditorSaving}
                      className="hover:bg-white/10 hover:text-white transition-all duration-200"
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'var(--text-secondary)',
                        cursor: contextEditorSaving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: contextEditorSaving ? 0.6 : 1,
                      }}
                      aria-label="Close editor"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>

                  <input
                    type="text"
                    value={contextEditorQuery}
                    onChange={(e) => setContextEditorQuery(e.target.value)}
                    disabled={contextEditorSaving}
                    placeholder={`Type to search ${activeContextEditor.toLowerCase()}...`}
                    className="focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none transition-shadow duration-300"
                    style={{
                      width: '100%',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.2)',
                      color: 'var(--text-primary)',
                      fontSize: '14.5px',
                      padding: '12px 16px',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)',
                    }}
                    autoFocus
                  />

                  {contextEditorError ? (
                    <div className="animate-in fade-in slide-in-from-top-2" style={{ fontSize: '13px', color: '#ff6b6b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {contextEditorError}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateRows: contextEditorLoading || contextEditorOptions.length > 0 || contextEditorSaving ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    background: 'var(--bg-panel)',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      className="animate-in fade-in duration-500"
                      style={{
                        padding: contextEditorLoading || contextEditorOptions.length > 0 || contextEditorSaving ? '16px 24px 24px 24px' : '0 24px',
                        maxHeight: 'min(50vh, 500px)',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      {contextEditorSaving ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', padding: '12px 0' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '13px' }}>Saving your selection...</span>
                        </div>
                      ) : contextEditorLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', padding: '12px 0' }}>
                          <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '13px' }}>Searching Autotask...</span>
                        </div>
                      ) : contextEditorOptions.length === 0 ? (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', opacity: 0.5 }}>
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                          <span style={{ fontSize: '13px' }}>No records returned.</span>
                        </div>
                      ) : (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {contextEditorOptions.map((option) => (
                            <button
                              key={`${activeContextEditor}-${option.id}`}
                              type="button"
                              onClick={() => handleSelectContextOption(option)}
                              disabled={contextEditorSaving}
                              className="group flex flex-col items-start w-full text-left transition-all duration-200 hover:scale-[1.01]"
                              style={{
                                padding: '14px 18px',
                                borderRadius: '12px',
                                border: '1px solid rgba(255,255,255,0.04)',
                                background: 'rgba(255,255,255,0.015)',
                                cursor: contextEditorSaving ? 'not-allowed' : 'pointer',
                                opacity: contextEditorSaving ? 0.65 : 1,
                              }}
                              onMouseEnter={(e) => {
                                if (!contextEditorSaving) {
                                  e.currentTarget.style.background = 'rgba(110,134,201,0.08)';
                                  e.currentTarget.style.borderColor = 'rgba(110,134,201,0.2)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!contextEditorSaving) {
                                  e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
                                }
                              }}
                            >
                              <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px', transition: 'color 0.2s' }} className="group-hover:text-[var(--accent)]">
                                {option.label}
                              </div>
                              {option.sublabel ? (
                                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{option.sublabel}</div>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    />
  );
}
