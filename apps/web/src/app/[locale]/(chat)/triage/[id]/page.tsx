'use client';

import { useEffect, useState, useRef, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import ChatSidebar, { ActiveTicket } from '@/components/ChatSidebar';
import ChatMessage, { Message } from '@/components/ChatMessage';
import ChatInput, { type ChatInputSubmitPayload } from '@/components/ChatInput';
import PlaybookPanel from '@/components/PlaybookPanel';
import ResizableLayout from '@/components/ResizableLayout';
import { usePathname } from 'next/navigation';
import { useRouter } from '@/i18n/routing';
import { usePollingResource } from '@/hooks/usePollingResource';
import { useScrollVelocity } from '@/hooks/useScrollVelocity';
import {
  type AutotaskCompanyOption,
  type AutotaskContactOption,
  type AutotaskTicketFieldKey,
  type AutotaskPicklistOption,
  type AutotaskResourceOption,
  getWorkflowCommandStatus,
  isRetryableCommandStatus,
  listAutotaskTicketFieldOptionsByField,
  listManagerOpsAiDecisions,
  listManagerOpsAudit,
  listWorkflowAudit,
  listWorkflowInbox,
  listWorkflowReconciliationIssues,
  mapCommandStatusToUxState,
  mapHttpErrorToFrontendState,
  processWorkflowCommands,
  reconcileWorkflowTicket,
  searchAutotaskCompanies,
  searchAutotaskContacts,
  searchAutotaskResources,
  submitWorkflowCommand,
  uploadAutotaskTicketAttachments,
  updateAutotaskTicketContext,
  type ManagerOpsAIDecision,
  type WorkflowActionUxState,
  type WorkflowAuditRecord,
  type WorkflowCommandStatus,
  type WorkflowInboxTicket,
  type WorkflowReconciliationIssue,
} from '@/lib/p0-ui-client';
import { loadTriPaneSidebarTickets } from '@/lib/workflow-sidebar-adapter';
import type { P0AuditRecord } from '@playbook-brain/types';

interface SessionData {
  session: { id: string; ticket_id: string; status: 'pending' | 'processing' | 'approved' | 'failed' | 'needs_more_info' | 'blocked' };
  ticket?: {
    id?: string;
    autotask_ticket_id_numeric?: number | null;
    title?: string;
    description?: string;
    description_normalized?: string;
    requester?: string;
    requester_normalized?: string;
    requester_email_normalized?: string;
    affected_user_normalized?: string;
    affected_user_email_normalized?: string;
    company?: string;
    company_id?: number;
    contact_id?: number;
    assigned_resource_name?: string;
    assigned_resource_email?: string;
    assigned_resource_id?: number;
    secondary_resource_name?: string;
    secondary_resource_email?: string;
    secondary_resource_id?: number;
    created_at?: string;
    priority?: string;
    priority_label?: string | null;
    issue_type?: string | number | null;
    issue_type_label?: string | null;
    sub_issue_type?: string | number | null;
    sub_issue_type_label?: string | null;
    sla?: string | number | null;
    sla_label?: string | null;
    normalization_audit?: {
      round?: number | null;
      method?: string | null;
      confidence?: string | null;
      source?: string | null;
    };
  };
  ssot?: {
    ticket_id?: string;
    title?: string;
    description_clean?: string;
    requester_name?: string;
    requester_email?: string;
    affected_user_name?: string;
    affected_user_email?: string;
    company?: string;
    created_at?: string;
    device_name?: string;
    isp_name?: string;
    firewall_make_model?: string;
    wifi_make_model?: string;
    switch_make_model?: string;
    phone_provider_name?: string;
    additional_contacts?: string;
    alternate_device?: string;
  };
  ticket_text_artifact?: {
    ticket_id?: string;
    session_id?: string;
    source?: 'autotask' | 'email' | 'unknown';
    title_original?: string;
    text_original?: string;
    text_clean?: string;
    text_clean_display_markdown?: string;
    text_clean_display_format?: 'plain' | 'markdown_llm';
    normalization_method?: 'llm' | 'deterministic_fallback';
    normalization_confidence?: number;
    created_at?: string;
  } | null;
  ticket_context_appendix?: {
    history_correlation?: {
      matched_case_count?: number;
      search_terms?: string[];
      strategies?: string[];
    };
    history_confidence_calibration?: {
      field_adjustments?: Array<{ action?: 'boost' | 'decrease' | 'context_only' }>;
      contradictions?: Array<{ path?: string; note?: string }>;
    };
    fusion_summary?: {
      applied_resolution_count?: number;
      link_count?: number;
      inference_count?: number;
      used_llm?: boolean;
    };
    final_refinement?: {
      fields_updated?: string[];
      itglue_docs_added?: number;
      ninja_signals_added?: number;
    };
  } | null;
  evidence_pack?: any;
  diagnosis?: any;
  validation?: any;
  playbook?: { content_md: string };
  ticket_notes?: Array<Record<string, unknown>>;
}

interface WorkflowActionFeedback {
  commandId: string;
  status: WorkflowCommandStatus['status'];
  uxState: WorkflowActionUxState;
  detail: string;
  retryable: boolean;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: string;
  updatedAt: string;
}

type EditableContextKey =
  | 'Org'
  | 'Contact'
  | 'Tech'
  | 'Additional contacts'
  | 'Priority'
  | 'Issue Type'
  | 'Sub-Issue Type'
  | 'Service Level Agreement';

interface ContextOverrideState {
  org?: { id?: number; name: string };
  user?: { id?: number; name: string; companyId?: number };
  tech?: { id?: number; name: string };
  secondary_tech?: { id?: number; name: string };
  additional_contact?: { id?: number; name: string; companyId?: number };
  priority?: { id?: number; name: string };
  issue_type?: { id?: number; name: string };
  sub_issue_type?: { id?: number; name: string };
  service_level_agreement?: { id?: number; name: string };
}

type ContextEditorOption = { id: number; label: string; sublabel?: string };
type TicketFieldOptionsCache = Partial<Record<AutotaskTicketFieldKey, AutotaskPicklistOption[]>>;

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

function resolvePicklistLabelFromCache(
  options: AutotaskPicklistOption[] | undefined,
  id: string | number | null | undefined
): string | null {
  const numericId = Number.parseInt(String(id ?? ''), 10);
  if (!Number.isFinite(numericId) || !options || options.length === 0) return null;
  const match = options.find((row) => row.id === numericId);
  return match?.label || null;
}

function TechPill({ label, name, type, onEdit, onRemove }: { label: string; name: string; type: 'primary' | 'secondary'; onEdit: () => void; onRemove: () => void }) {
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
        borderColor: borderColor,
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

      {/* Container that always takes space to prevent layout shift, but fades in on hover */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div style={{ width: '1px', height: '10px', background: 'var(--border)', margin: '0 4px', opacity: 0.5 }} />
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
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
            opacity: 0.7
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'inherit'; e.currentTarget.style.transform = 'scale(1)'; }}
          title={`Edit ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
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
            opacity: 0.7
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#D67C7C'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.color = 'inherit'; e.currentTarget.style.transform = 'scale(1)'; }}
          title={`Remove ${label}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function SessionDetail({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations('ChatSession');
  const pathname = usePathname();
  const router = useRouter();
  const [selectedTicketId, setSelectedTicketId] = useState(params.id);
  const [data, setData] = useState<SessionData | null>(null);
  const { scrollRef, style: velocityStyle } = useScrollVelocity();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: t('startingAnalysis'),
      timestamp: new Date(),
      type: 'text',
      channel: 'internal_ai',
    },
  ]);
  const [targetChannel, setTargetChannel] = useState<'internal_ai' | 'external_psa_user'>('internal_ai');
  const [channelFilter, setChannelFilter] = useState<'all' | 'internal_ai' | 'external_psa_user'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playbookReady, setPlaybookReady] = useState(false);
  const [playbookStatus, setPlaybookStatus] = useState<'loading' | 'ready' | 'error'>('ready');
  const timelineSignatureRef = useRef('');
  const flowRequestSeqRef = useRef(0);
  const hardRefreshInProgressRef = useRef(false);
  const sidebarTicketsRef = useRef<ActiveTicket[]>([]);
  const workflowInboxRef = useRef<WorkflowInboxTicket[]>([]);
  const ticketSnapshotRef = useRef<Record<string, {
    ticketId: string;
    subject: string;
    description: string;
    requester: string;
    org: string;
    site: string;
    priority: string;
    createdAt?: string;
  }>>({});

  // Add state for real tickets
  const [sidebarTickets, setSidebarTickets] = useState<ActiveTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isManualSuppressed, setIsManualSuppressed] = useState(false);
  const [isManualSuppressionSaving, setIsManualSuppressionSaving] = useState(false);
  const [isWorkflowReconcileRunning, setIsWorkflowReconcileRunning] = useState(false);
  const [workflowActionError, setWorkflowActionError] = useState('');
  const [techAssignmentDraft, setTechAssignmentDraft] = useState('');
  const [isSubmittingTechAssignment, setIsSubmittingTechAssignment] = useState(false);
  const [workflowActionFeedback, setWorkflowActionFeedback] = useState<WorkflowActionFeedback | null>(null);
  const [workflowWritePolicyDisabled, setWorkflowWritePolicyDisabled] = useState(false);
  const [isDevPanelOpen, setIsDevPanelOpen] = useState(false);
  const [contextOverrides, setContextOverrides] = useState<ContextOverrideState>({});
  const [activeContextEditor, setActiveContextEditor] = useState<EditableContextKey | null>(null);
  const [contextEditorQuery, setContextEditorQuery] = useState('');
  const [contextEditorLoading, setContextEditorLoading] = useState(false);
  const [contextEditorSaving, setContextEditorSaving] = useState(false);
  const [contextEditorError, setContextEditorError] = useState('');
  const [contextEditorOptions, setContextEditorOptions] = useState<ContextEditorOption[]>([]);
  const [ticketFieldOptionsCache, setTicketFieldOptionsCache] = useState<TicketFieldOptionsCache>({});
  const [resolvedOrgIdFallback, setResolvedOrgIdFallback] = useState<number | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target as Node)) {
        setIsHeaderMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const p0LookupTicketId = String(data?.session?.ticket_id || selectedTicketId || '').trim();
  const workflowInboxState = usePollingResource(listWorkflowInbox, {
    intervalMs: 10000,
    realtime: { path: '/workflow/realtime' },
  });
  const workflowAuditState = usePollingResource(
    () => listWorkflowAudit(p0LookupTicketId),
    { intervalMs: 12000, enabled: Boolean(p0LookupTicketId) }
  );
  const workflowReconciliationState = usePollingResource(
    () => listWorkflowReconciliationIssues(p0LookupTicketId),
    { intervalMs: 15000, enabled: Boolean(p0LookupTicketId) }
  );
  const managerAiState = usePollingResource(() => listManagerOpsAiDecisions(200), { intervalMs: 15000 });
  const managerAuditState = usePollingResource(() => listManagerOpsAudit(300), { intervalMs: 15000 });

  const cleanTitle = (value?: string) =>
    (value || '')
      .replace(/\s+Description\s*:\s*.*$/i, '')
      .trim();

  const normalizePlainText = (value?: string, fallback = '') => {
    const raw = (value || '').trim();
    if (!raw) return fallback;
    const withoutTags = raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    const decoded = withoutTags
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    return decoded
      .replace(/^\s*Description\s*:\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim() || fallback;
  };

  const parseDate = (value?: string) => {
    if (!value) return new Date();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const normalizeCommentVisibility = (value?: string): 'internal' | 'public' =>
    String(value || '').toLowerCase() === 'public' ? 'public' : 'internal';

  const visibilityFromAutotaskNote = (note: Record<string, unknown>): 'internal' | 'public' => {
    const publish = Number(note.publish);
    if (Number.isFinite(publish)) {
      // Autotask note publish: 1 = public, 2 = internal/co-managed.
      return publish === 1 ? 'public' : 'internal';
    }
    const hint = String(note.visibility || note.noteVisibility || note.noteType || '').toLowerCase();
    if (hint.includes('public')) return 'public';
    return 'internal';
  };

  const isWorkflowRuleAutotaskNote = (note: Record<string, unknown>): boolean => {
    const noteType = Number(note.noteType);
    if (Number.isFinite(noteType) && noteType === 13) return true;
    const combined = [
      note.title,
      note.subject,
      note.noteText,
      note.description,
      note.noteType,
      note.creatorName,
      note.createdBy,
    ]
      .map((value) => normalizePlainText(String(value ?? '').trim(), ''))
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!combined) return false;
    return /\bworkflow rule\b/.test(combined);
  };

  const buildAutotaskNoteContent = (note: Record<string, unknown>): string => {
    const title = normalizePlainText(String(note.title ?? note.subject ?? '').trim(), '');
    const body = normalizePlainText(
      String(note.noteText ?? note.description ?? note.body ?? '').trim(),
      ''
    );
    const fallback = normalizePlainText(String(note.noteType || 'Autotask note').trim(), 'Autotask note');

    if (title && body && title.toLowerCase() !== body.toLowerCase()) {
      return `**${title}**\n\n${body}`;
    }
    if (body) return body;
    if (title) return `**${title}**`;
    return fallback;
  };

  const trackChatEvent = (event: string, payload: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('cerebro:chat-telemetry', { detail: { event, ...payload } }));
  };

  const channelStorageKey = (ticketId: string) => `cerebro:chat-target-channel:${ticketId}`;

  const isMeaningfulText = (value?: string) => {
    const normalized = normalizePlainText(value, '').toLowerCase();
    if (!normalized) return false;
    return ![
      'unknown',
      'unknown org',
      'unknown requester',
      'unknown user',
      'unknown site',
      'untitled ticket',
      'organization',
      'requester',
      'user',
    ].includes(normalized);
  };

  const pickStableText = (current: string | undefined, candidates: Array<string | undefined>, fallback: string) => {
    if (isMeaningfulText(current)) return normalizePlainText(current, fallback);
    for (const candidate of candidates) {
      if (isMeaningfulText(candidate)) return normalizePlainText(candidate, fallback);
    }
    return normalizePlainText(current, fallback) || fallback;
  };

  const isSpecificUiUser = (value?: string) => {
    const normalized = normalizePlainText(value, '').toLowerCase();
    if (!normalized || normalized === 'unknown') return false;
    if (/name not provided/.test(normalized)) return false;
    if (/^(new|another|the)\s+employee\b/.test(normalized)) return false;
    if (/^employee\b/.test(normalized)) return false;
    if (/^new hire\b/.test(normalized)) return false;
    return true;
  };

  const toAutotaskId = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };

  const selectUiUserFromSsot = (input: {
    affected?: string | undefined;
    requester?: string | undefined;
    fallbacks?: Array<string | undefined>;
  }) => {
    const affected = normalizePlainText(input.affected, '');
    if (isSpecificUiUser(affected)) return affected;
    const requester = normalizePlainText(input.requester, '');
    if (isMeaningfulText(requester)) return requester;
    for (const fallback of input.fallbacks || []) {
      if (isMeaningfulText(fallback)) return normalizePlainText(fallback, 'Unknown user');
    }
    return 'Unknown user';
  };

  const getTicketContextMeta = (ticket?: ActiveTicket) => {
    if (!ticket) return selectedTicketId;
    const parts = [
      ticket.ticket_id || ticket.id,
      ticket.company || ticket.org,
      ticket.requester || ticket.site,
    ].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' · ') : selectedTicketId;
  };

  const extractMarkdownSection = (markdown: string, aliases: string[]) => {
    const lines = markdown.split('\n');
    const normalizedAliases = aliases.map((a) => a.toLowerCase());
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || '';
      const m = line.match(/^\s*##+\s+(.+?)\s*$/);
      if (!m) continue;
      const heading = normalizePlainText(m[1] || '', '').toLowerCase();
      if (normalizedAliases.some((alias) => heading.includes(alias))) {
        start = i + 1;
        break;
      }
    }
    if (start < 0) return '';
    let end = lines.length;
    for (let i = start; i < lines.length; i++) {
      if (/^\s*##+\s+/.test(lines[i] || '')) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end).join('\n').trim();
  };

  const parseChecklistFromPlaybook = (markdown?: string) => {
    if (!markdown) return [] as Array<{ id: string; text: string; details_md?: string }>;
    const section = extractMarkdownSection(markdown, ['checklist', 'resolution steps']);
    if (!section) return [] as Array<{ id: string; text: string; details_md?: string }>;

    const lines = section.split('\n');
    const items: Array<{ id: string; text: string; details_md?: string }> = [];
    let current: { id: string; text: string; detailLines: string[] } | null = null;

    const flush = () => {
      if (!current) return;
      items.push({
        id: current.id,
        text: current.text,
        ...(current.detailLines.length > 0
          ? { details_md: current.detailLines.join('\n').trim() }
          : {}),
      });
      current = null;
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r/g, '');
      const itemMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
      if (itemMatch) {
        flush();
        current = {
          id: `c${items.length + 1}`,
          text: (itemMatch[2] || '').trim(),
          detailLines: [],
        };
        continue;
      }
      if (!current) continue;
      if (!line.trim()) {
        if (current.detailLines.length > 0 && current.detailLines[current.detailLines.length - 1] !== '') {
          current.detailLines.push('');
        }
        continue;
      }
      if (/^\s*---+\s*$/.test(line)) continue;
      current.detailLines.push(line);
    }
    flush();
    return items;
  };

  const parseEscalationFromPlaybook = (markdown?: string) => {
    if (!markdown) return [] as Array<{ icon: string; text: string }>;
    const section = extractMarkdownSection(markdown, ['escalation', 'escalate when']);
    if (!section) return [] as Array<{ icon: string; text: string }>;
    const rows: Array<{ icon: string; text: string }> = [];
    for (const rawLine of section.split('\n')) {
      const line = rawLine.replace(/\r/g, '').trim();
      if (!line) continue;
      const bullet = line.match(/^[-*]\s+(.*)$/);
      const numbered = line.match(/^\d+\.\s+(.*)$/);
      const contentLine = (bullet?.[1] || numbered?.[1] || '').trim();
      if (!contentLine) continue;
      const lowered = contentLine.toLowerCase();
      const icon = lowered.startsWith('if:') || lowered.includes(' if ') || lowered.includes('condition')
        ? '⚠️'
        : lowered.startsWith('contact:') || lowered.includes('contact')
          ? '📞'
          : lowered.startsWith('escalate')
            ? '⬆️'
            : '⚠️';
      rows.push({ icon, text: contentLine });
    }
    return rows;
  };

  const refreshWorkflowCommandFeedback = async (commandId: string): Promise<{ ok: boolean; uxState: WorkflowActionUxState; detail: string }> => {
    try {
      const status = await getWorkflowCommandStatus(commandId);
      const uxState = mapCommandStatusToUxState(status.status);
      const detail = status.last_error || `Command ${status.status}`;
      setWorkflowActionFeedback({
        commandId,
        status: status.status,
        uxState,
        detail,
        retryable: isRetryableCommandStatus(status.status),
        attempts: status.attempts,
        maxAttempts: status.max_attempts,
        ...(status.next_retry_at ? { nextRetryAt: status.next_retry_at } : {}),
        updatedAt: status.updated_at,
      });
      if (uxState === 'succeeded') {
        setWorkflowActionError('');
        setWorkflowWritePolicyDisabled(false);
        await Promise.all([
          workflowInboxState.refresh(),
          workflowAuditState.refresh(),
          workflowReconciliationState.refresh(),
        ]);
        return { ok: true, uxState, detail };
      }
      return { ok: false, uxState, detail };
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Command status unavailable');
      setWorkflowActionError(`${mapped.summary}: ${mapped.detail}`);
      return { ok: false, uxState: 'failed', detail: mapped.detail };
    }
  };

  const submitTechAssignmentById = async (resourceIdRaw: string, techName?: string): Promise<{ ok: boolean; error?: string }> => {
    const ticketId = String(data?.session?.ticket_id || selectedTicketId || '').trim();
    const assigneeResourceId = String(resourceIdRaw || '').trim();
    if (!ticketId || !assigneeResourceId || isSubmittingTechAssignment) return { ok: false, error: 'Ticket or resource unavailable' };

    setIsSubmittingTechAssignment(true);
    setWorkflowActionError('');
    try {
      const idempotencyKey = `ui-tech-${ticketId}-${assigneeResourceId}-${Date.now()}`;
      const command = await submitWorkflowCommand({
        command_type: 'update_assign',
        ticket_id: ticketId,
        payload: {
          assignee_resource_id: assigneeResourceId,
          assigned_to: assigneeResourceId,
        },
        idempotency_key: idempotencyKey,
        auto_process: true,
      });
      const commandId = String(
        (command as any)?.command_id ||
        (command as any)?.command?.command_id ||
        ''
      ).trim();
      if (!commandId) throw new Error('Workflow command id missing');

      setWorkflowActionFeedback({
        commandId,
        status: 'accepted',
        uxState: 'pending',
        detail: 'Assignment command accepted and queued',
        retryable: true,
        attempts: 0,
        maxAttempts: 3,
        updatedAt: new Date().toISOString(),
      });
      setWorkflowWritePolicyDisabled(false);
      const refreshResult = await refreshWorkflowCommandFeedback(commandId);
      if (!refreshResult.ok) {
        const pendingHint = refreshResult.uxState === 'pending' || refreshResult.uxState === 'retrying'
          ? 'Assignment is still processing in Autotask. Wait for completion before applying local context.'
          : refreshResult.detail;
        return { ok: false, error: pendingHint };
      }
      if (techName) {
        setContextOverrides((prev) => ({
          ...prev,
          tech: {
            id: Number(assigneeResourceId),
            name: techName,
          },
        }));
      }
      return { ok: true };
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Unable to submit assignment command');
      setWorkflowActionError(`${mapped.summary}: ${mapped.detail}`);
      setWorkflowActionFeedback({
        commandId: '',
        status: 'failed',
        uxState: 'failed',
        detail: mapped.detail,
        retryable: mapped.retryable,
        attempts: 0,
        maxAttempts: 0,
        updatedAt: new Date().toISOString(),
      });
      if (mapped.code === 'forbidden' || mapped.code === 'auth') {
        setWorkflowWritePolicyDisabled(true);
      }
      return { ok: false, error: mapped.detail };
    } finally {
      setIsSubmittingTechAssignment(false);
    }
  };

  const handleSubmitTechAssignment = async () => {
    await submitTechAssignmentById(techAssignmentDraft);
  };

  const handleManualWorkflowRetry = async () => {
    const commandId = String(workflowActionFeedback?.commandId || '').trim();
    if (!commandId) return;
    setWorkflowActionError('');
    try {
      await processWorkflowCommands(5);
      await refreshWorkflowCommandFeedback(commandId);
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Manual retry failed');
      setWorkflowActionError(`${mapped.summary}: ${mapped.detail}`);
    }
  };

  useEffect(() => {
    sidebarTicketsRef.current = sidebarTickets;
  }, [sidebarTickets]);

  useEffect(() => {
    workflowInboxRef.current = workflowInboxState.data || [];
  }, [workflowInboxState.data]);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchData = async () => {
      if (inFlight || hardRefreshInProgressRef.current) return;
      inFlight = true;
      const reqSeq = ++flowRequestSeqRef.current;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await axios.get(`${apiUrl}/playbook/full-flow`, {
          params: { sessionId: selectedTicketId, _ts: Date.now() },
          withCredentials: true,
        });
        if (cancelled || reqSeq !== flowRequestSeqRef.current) return;

        const payload = res.data || {};
        const flowData = payload.data || {};
        const resolvedSession = payload.session || {};
        const resolvedTicket = flowData.ticket || {};
        const resolvedSsot = flowData.ssot || {};
        const resolvedTicketId = String(
          resolvedSession.ticket_id ||
          resolvedSsot.ticket_id ||
          resolvedTicket.id ||
          selectedTicketId
        );
        const newData = {
          session: {
            id: String(resolvedSession.id || selectedTicketId),
            ticket_id: resolvedTicketId,
            status: (resolvedSession.status || 'processing') as 'pending' | 'processing' | 'approved' | 'failed' | 'needs_more_info' | 'blocked',
          },
          ticket: resolvedTicket || null,
          ssot: resolvedSsot || null,
          diagnosis: flowData.diagnosis ?? null,
          validation: flowData.validation ?? null,
          playbook: flowData.playbook ?? null,
          evidence_pack: flowData.evidence_pack ?? flowData.pack ?? null,
          ticket_text_artifact: flowData.ticket_text_artifact ?? null,
          ticket_context_appendix: flowData.ticket_context_appendix ?? null,
          ticket_notes: Array.isArray(flowData.ticket_notes) ? flowData.ticket_notes : [],
        };

        setData(newData);
        const pack = newData.evidence_pack || {};
        const ssot = newData.ssot || {};
        const packTicket = pack.ticket || {};
        const packOrg = pack.org || {};
        const packUser = pack.user || {};
        const backendTicket = newData.ticket || {};
        const currentTicket = sidebarTicketsRef.current.find((t) => t.id === selectedTicketId);
        const snapshot = ticketSnapshotRef.current[selectedTicketId];
        const ticketId = newData.session.ticket_id || normalizePlainText(backendTicket.id, '') || currentTicket?.ticket_id || snapshot?.ticketId || selectedTicketId;
        const subject = pickStableText(
          snapshot?.subject,
          [
            cleanTitle(ssot.title),
            cleanTitle(backendTicket.title),
            cleanTitle(currentTicket?.title),
            cleanTitle(packTicket.title),
            cleanTitle(packTicket.description),
          ],
          'Untitled ticket'
        );
        const problemDescription = pickStableText(
          snapshot?.description,
          [
            ssot.description_clean,
            backendTicket.description_normalized,
            backendTicket.description,
            currentTicket?.description,
            packTicket.description,
            subject,
          ],
          subject
        );
        const requester = pickStableText(
          snapshot?.requester,
          [
            selectUiUserFromSsot({
              affected: ssot.affected_user_name || backendTicket.affected_user_normalized,
              requester: ssot.requester_name || backendTicket.requester_normalized || backendTicket.requester,
              fallbacks: [currentTicket?.requester, packUser.name],
            }),
            currentTicket?.site,
          ],
          'Unknown user'
        );
        const org = pickStableText(
          snapshot?.org,
          [ssot.company, backendTicket.company, currentTicket?.company, currentTicket?.org, packOrg.name],
          'Unknown org'
        );
        const site = pickStableText(
          snapshot?.site,
          [backendTicket.requester, currentTicket?.site, currentTicket?.requester, packUser.name],
          'Unknown site'
        );
        const priority = backendTicket.priority || currentTicket?.priority || snapshot?.priority || 'P3';
        const createdAt = snapshot?.createdAt || ssot.created_at || backendTicket.created_at || currentTicket?.created_at || packTicket.created_at;
        ticketSnapshotRef.current[selectedTicketId] = {
          ticketId,
          subject,
          description: problemDescription,
          requester,
          org,
          site,
          priority,
          createdAt,
        };
        const priorityLabel = priority === 'P1' ? 'P1 Critical' : priority;
        const firstEventTime = parseDate(createdAt);
        const ts = (offsetSec: number) => new Date(firstEventTime.getTime() + offsetSec * 1000);

        const ticketTextArtifact = newData.ticket_text_artifact || null;
        const ticketContextAppendix = newData.ticket_context_appendix || null;
        const appendixHistoryMatches = Number(ticketContextAppendix?.history_correlation?.matched_case_count || 0);
        const appendixFusionApplied = Number(ticketContextAppendix?.fusion_summary?.applied_resolution_count || 0);
        const appendixFinalFieldsUpdated = Array.isArray(ticketContextAppendix?.final_refinement?.fields_updated)
          ? ticketContextAppendix.final_refinement.fields_updated.length
          : 0;
        const normalizedOrgForLine = normalizePlainText(org, '');
        const normalizedSiteForLine = normalizePlainText(site, '');
        const normalizedRequesterForLine = normalizePlainText(requester, '');
        const siteIsRedundant =
          !normalizedSiteForLine ||
          normalizedSiteForLine.toLowerCase() === normalizedOrgForLine.toLowerCase() ||
          normalizedSiteForLine.toLowerCase() === normalizedRequesterForLine.toLowerCase();
        const locationLabelForLine = siteIsRedundant ? org : `${org}, ${site}`;
        const autoTaskPrimaryText = ticketTextArtifact?.text_clean
          ? `New ticket detected: \`${ticketId}\` — "${normalizePlainText(ticketTextArtifact.text_clean, problemDescription)}" from ${requester} at ${locationLabelForLine}. Priority: **${priorityLabel}**. Starting context collection.`
          : `New ticket detected: \`${ticketId}\` — "${problemDescription}" from ${requester} at ${locationLabelForLine}. Priority: **${priorityLabel}**. Starting context collection.`;
        const autoTaskOriginalText = ticketTextArtifact?.text_original
          ? `Original ticket text (Autotask/email intake):\n\n${ticketTextArtifact.text_original}`
          : autoTaskPrimaryText;
        const autoTaskCleanText = ticketTextArtifact?.text_clean_display_markdown
          || ticketTextArtifact?.text_clean
          || undefined;
        const autoTaskCleanFormat = ticketTextArtifact?.text_clean_display_markdown
          && ticketTextArtifact?.text_clean_display_format === 'markdown_llm'
          ? 'markdown_llm'
          : 'plain';

        const timeline: Message[] = [
          {
            id: `autotask-${selectedTicketId}`,
            role: 'assistant',
            type: 'autotask',
            timestamp: ts(0),
            content: autoTaskPrimaryText,
            channel: 'internal_ai',
            ...(ticketTextArtifact?.text_original
              ? {
                ticketTextVariant: {
                  primary: (autoTaskCleanText ? 'clean' : 'original') as 'clean' | 'original',
                  original: autoTaskOriginalText,
                  ...(autoTaskCleanText ? { clean: autoTaskCleanText, cleanFormat: autoTaskCleanFormat } : {}),
                },
              }
              : {}),
          },
        ];

        const sourceFindings = Array.isArray(pack?.source_findings) ? pack.source_findings : [];
        const hasSourceFindings = sourceFindings.length > 0;
        const relatedCount = Array.isArray(pack?.related_cases) ? pack.related_cases.length : 0;
        const ninjaSignals = Array.isArray(pack?.signals) ? pack.signals.filter((s: any) => s?.source === 'ninja') : [];
        const ninjaWarns = ninjaSignals.filter((s: any) => String(s?.type || '').includes('warn')).length;
        const docTitle = Array.isArray(pack?.docs) && pack.docs.length > 0 ? String(pack.docs[0]?.title || '').trim() : '';
        const ext = Array.isArray(pack?.external_status) && pack.external_status.length > 0 ? pack.external_status[0] : null;

        const sourceLabelMap: Record<string, string> = {
          autotask: 'Autotask',
          ninjaone: 'NinjaOne',
          itglue: 'IT Glue',
          external: 'External',
        };

        const prepareSteps: NonNullable<Message['steps']> = hasSourceFindings
          ? sourceFindings.map((f: any) => ({
            label: `${f?.round ? `R${f.round} · ` : ''}${sourceLabelMap[String(f?.source || '')] || String(f?.source || 'Source')} — ${normalizePlainText(String(f?.summary || ''), 'No summary')}`,
            status: f?.queried ? (f?.matched ? 'done' : 'running') : 'idle',
          }))
          : [
            { label: `Autotask — ticket, org, contact${relatedCount > 0 ? `, ${relatedCount} related cases` : ''}`, status: 'done' },
            { label: `NinjaOne — ${pack?.device ? 'device snapshot' : 'device lookup'}${ninjaSignals.length > 0 ? `, ${ninjaSignals.length} checks` : ''}${ninjaWarns > 0 ? ` (${ninjaWarns} warnings)` : ''}`, status: 'done' },
            { label: `IT Glue — ${docTitle ? `runbook "${docTitle}"` : 'network stack and runbook context'}`, status: 'done' },
            { label: `External — ${ext ? `${ext.provider} status: ${ext.status}` : 'status providers and regional checks'}`, status: 'done' },
          ];

        timeline.push({
          id: `evidence-${selectedTicketId}`,
          role: 'assistant',
          type: 'evidence',
          timestamp: ts(1),
          content: hasSourceFindings
            ? `Running iterative cross-source correlation (intake → IT Glue → Ninja → history → refine)${appendixFusionApplied > 0 ? ` · fusion ${appendixFusionApplied} field${appendixFusionApplied === 1 ? '' : 's'}` : ''}${appendixHistoryMatches > 0 ? ` · ${appendixHistoryMatches} historical match${appendixHistoryMatches === 1 ? '' : 'es'}` : ''}${appendixFinalFieldsUpdated > 0 ? ` · final refinement ${appendixFinalFieldsUpdated} field${appendixFinalFieldsUpdated === 1 ? '' : 's'} updated` : ''}.`
            : 'Pulling data from 3 sources simultaneously.',
          steps: prepareSteps,
          channel: 'internal_ai',
        });

        if (newData.diagnosis) {
          timeline.push({
            id: `diagnosis-${selectedTicketId}`,
            role: 'assistant',
            type: 'diagnosis',
            timestamp: ts(3),
            content: 'Evidence pack processed. Ranked hypotheses generated with supporting citations.',
            channel: 'internal_ai',
          });
        }

        if (newData.validation) {
          timeline.push({
            id: `validation-${selectedTicketId}`,
            role: 'assistant',
            type: 'validation',
            timestamp: ts(4),
            content: 'Validation completed with evidence checks and safety gates.',
            channel: 'internal_ai',
          });
        }

        if (newData.playbook) {
          timeline.push({
            id: `playbook-${selectedTicketId}`,
            role: 'assistant',
            type: 'text',
            timestamp: ts(5),
            content: 'Playbook generated. Review and refine using the right panel.',
            channel: 'internal_ai',
          });
        }

        const workflowTicket = workflowInboxRef.current.find(
          (row) => row.ticket_id === ticketId || row.ticket_id === selectedTicketId
        );
        const ticketComments = Array.isArray(workflowTicket?.comments) ? workflowTicket.comments : [];
        const notesTimeline: Message[] = ticketComments.map((note, index) => {
          const visibility = normalizeCommentVisibility(note.visibility);
          return {
            id: `note-${selectedTicketId}-${String(note.created_at || '').trim() || 'na'}-${index}`,
            role: 'assistant',
            type: 'note',
            timestamp: parseDate(note.created_at),
            content: normalizePlainText(note.body, 'Empty note'),
            channel: visibility === 'public' ? 'external_psa_user' : 'internal_ai',
          };
        });
        const apiTicketNotes = Array.isArray(flowData.ticket_notes)
          ? flowData.ticket_notes.filter((row: unknown): row is Record<string, unknown> => Boolean(row && typeof row === 'object'))
          : [];
        const notesFromAutotaskTimeline: Message[] = apiTicketNotes
          .filter((note: Record<string, unknown>) => !isWorkflowRuleAutotaskNote(note))
          .map((note: Record<string, unknown>, index: number) => {
            const noteText = buildAutotaskNoteContent(note);
            const rawCreatedAt = String(note.createDateTime || note.createDate || note.created_at || '').trim();
            const createdAt = rawCreatedAt || new Date().toISOString();
            const noteId = String(note.id || '').trim() || `${createdAt}-${index}`;
            return {
              id: `autotask-note-${selectedTicketId}-${noteId}`,
              role: 'assistant',
              type: 'note',
              timestamp: parseDate(createdAt),
              content: noteText,
              channel: visibilityFromAutotaskNote(note) === 'public' ? 'external_psa_user' : 'internal_ai',
            };
          });
        const dedupeKey = (m: Message) => {
          const iso = m.timestamp instanceof Date ? m.timestamp.toISOString() : '';
          return `${m.channel ?? 'internal_ai'}::${normalizePlainText(m.content, '').toLowerCase()}::${iso}`;
        };
        const seenNoteKeys = new Set(notesTimeline.map(dedupeKey));
        const mergedAutotaskNotes = notesFromAutotaskTimeline.filter((m) => {
          const key = dedupeKey(m);
          if (seenNoteKeys.has(key)) return false;
          seenNoteKeys.add(key);
          return true;
        });
        timeline.push(...notesTimeline);
        timeline.push(...mergedAutotaskNotes);
        timeline.sort((a, b) => {
          const aTs = a.timestamp instanceof Date ? a.timestamp.getTime() : 0;
          const bTs = b.timestamp instanceof Date ? b.timestamp.getTime() : 0;
          return aTs - bTs;
        });

        const signature = JSON.stringify(
          timeline.map((m) => ({
            id: m.id,
            type: m.type,
            channel: m.channel,
            content: m.content,
            ticketTextVariant:
              m.ticketTextVariant
                ? {
                  primary: m.ticketTextVariant.primary,
                  clean: m.ticketTextVariant.clean,
                  cleanFormat: m.ticketTextVariant.cleanFormat,
                  original: m.ticketTextVariant.original,
                }
                : null,
            steps: m.steps?.map((s) => `${s.label}:${s.status}`) ?? [],
          }))
        );
        if (signature !== timelineSignatureRef.current) {
          timelineSignatureRef.current = signature;
          setMessages((prev) => {
            const userOnly = prev.filter((m) => m.role === 'user');
            return [...timeline, ...userOnly];
          });
        }

        setPlaybookReady(Boolean(newData.playbook));
        setPlaybookStatus(newData.playbook ? 'ready' : 'loading');
      } catch (err) {
        if (cancelled || reqSeq !== flowRequestSeqRef.current) return;
        setError(axios.isAxiosError(err) ? err.message : String(err));
        setPlaybookStatus('error');
      } finally {
        inFlight = false;
        if (cancelled || reqSeq !== flowRequestSeqRef.current) return;
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedTicketId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setPlaybookReady(false);
    setPlaybookStatus('loading');
    timelineSignatureRef.current = '';
    setMessages([
      {
        id: `init-${selectedTicketId}`,
        role: 'assistant',
        content: t('startingAnalysis'),
        timestamp: new Date(),
        type: 'status',
        channel: 'internal_ai',
      },
    ]);
  }, [selectedTicketId, t]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(channelStorageKey(selectedTicketId));
    if (saved === 'external_psa_user' || saved === 'internal_ai') {
      setTargetChannel(saved);
      return;
    }
    setTargetChannel('internal_ai');
  }, [selectedTicketId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(channelStorageKey(selectedTicketId), targetChannel);
  }, [selectedTicketId, targetChannel]);

  // Fetch canonical tri-pane sidebar tickets from workflow inbox only (P0 source of truth)
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchTickets = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const tickets = await loadTriPaneSidebarTickets();
        if (!cancelled) setSidebarTickets(tickets);
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        inFlight = false;
        if (!cancelled) setIsLoadingTickets(false);
      }
    };

    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Unable to read file ${file.name}`));
    reader.readAsDataURL(file);
  });

  const handleSendMessage = async ({ message, attachments, targetChannel }: ChatInputSubmitPayload) => {
    const userMessageId = `msg-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdMessageContent = message || (attachments.length > 0 ? 'Attachment(s) added.' : '');
    const attachmentViews = attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      extension: attachment.extension,
      kind: attachment.kind,
      ...(attachment.previewUrl ? { previewUrl: attachment.previewUrl } : {}),
    }));
    setMessages((prev) => [
      ...prev,
      {
        id: userMessageId,
        role: 'user',
        content: createdMessageContent,
        timestamp: new Date(),
        type: 'text',
        channel: targetChannel,
        ...(targetChannel === 'external_psa_user' ? { delivery: { status: 'sending' as const } } : {}),
        ...(attachmentViews.length > 0 ? { attachments: attachmentViews } : {}),
      },
    ]);
    trackChatEvent(
      targetChannel === 'external_psa_user'
        ? 'chat_message_sent_external'
        : 'chat_message_sent_internal',
      { ticket_id: selectedTicketId }
    );

    let attachmentUploadError = '';
    const ticketId = String(data?.session?.ticket_id || selectedTicketId || '').trim();
    if (ticketId && attachments.length > 0) {
      try {
        const files = await Promise.all(
          attachments.map(async (attachment) => ({
            fileName: attachment.name,
            contentType: attachment.mimeType,
            dataBase64: await fileToBase64(attachment.file),
            title: attachment.name,
          }))
        );
        const upload = await uploadAutotaskTicketAttachments(ticketId, files);
        if (upload.failedCount > 0) {
          attachmentUploadError = upload.results
            .filter((r) => !r.uploaded)
            .map((r) => `${r.fileName}: ${r.error || 'upload failed'}`)
            .join('; ');
        }
      } catch (err) {
        attachmentUploadError = (err as Error)?.message || 'Attachment upload failed';
      }
    }

    if (targetChannel === 'external_psa_user') {
      try {
        const ticketIdRef = String(data?.session?.ticket_id || selectedTicketId || '').trim();
        if (!ticketIdRef) throw new Error('Ticket reference unavailable');
        await submitWorkflowCommand({
          command_type: 'create_comment_note',
          ticket_id: ticketIdRef,
          idempotency_key: `external-note-${ticketIdRef}-${Date.now()}`,
          payload: {
            comment_body: createdMessageContent,
            comment_visibility: 'public',
          },
          auto_process: true,
        });
        setMessages((prev) => prev.map((m) => (
          m.id === userMessageId
            ? { ...m, delivery: { status: 'sent' } }
            : m
        )));
      } catch (err) {
        const errorText = (err as Error)?.message || 'Failed to send message to PSA/User';
        trackChatEvent('chat_message_external_failed', { ticket_id: selectedTicketId, error: errorText });
        setMessages((prev) => prev.map((m) => (
          m.id === userMessageId
            ? { ...m, delivery: { status: 'failed', error: errorText } }
            : m
        )));
      }
      return;
    }

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-auto-${Date.now()}`,
          role: 'assistant',
          content: attachmentUploadError
            ? `${t('processingRequest')} (attachment issues: ${attachmentUploadError})`
            : t('processingRequest'),
          timestamp: new Date(),
          type: 'text',
          channel: 'internal_ai',
        },
      ]);
    }, 500);
  };

  const handleRefreshPipeline = async () => {
    const ticket = selectedTicketId;
    hardRefreshInProgressRef.current = true;
    flowRequestSeqRef.current += 1; // invalidate in-flight polling responses
    delete ticketSnapshotRef.current[ticket];
    setLoading(true);
    setError('');
    setPlaybookReady(false);
    setPlaybookStatus('loading');
    timelineSignatureRef.current = '';
    setData(null);
    setMessages([
      {
        id: `refresh-${ticket}-${Date.now()}`,
        role: 'assistant',
        content: 'Refreshing pipeline for this ticket...',
        timestamp: new Date(),
        type: 'status',
        channel: 'internal_ai',
      },
    ]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await axios.get(`${apiUrl}/playbook/full-flow`, {
        params: { sessionId: ticket, refresh: 1, _ts: Date.now() },
        withCredentials: true,
      });
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.message : String(err));
      setPlaybookStatus('error');
      setLoading(false);
    } finally {
      flowRequestSeqRef.current += 1; // drop any stale response that completed during refresh call
      hardRefreshInProgressRef.current = false;
    }
  };

  const handleRetryExternalMessage = async (message: Message) => {
    const ticketIdRef = String(data?.session?.ticket_id || selectedTicketId || '').trim();
    if (!ticketIdRef) return;
    trackChatEvent('chat_message_external_retry', { ticket_id: selectedTicketId });
    setMessages((prev) => prev.map((m) => (
      m.id === message.id ? { ...m, delivery: { status: 'retrying' } } : m
    )));
    try {
      await submitWorkflowCommand({
        command_type: 'create_comment_note',
        ticket_id: ticketIdRef,
        idempotency_key: `external-note-retry-${ticketIdRef}-${Date.now()}`,
        payload: {
          comment_body: message.content,
          comment_visibility: 'public',
        },
        auto_process: true,
      });
      setMessages((prev) => prev.map((m) => (
        m.id === message.id ? { ...m, delivery: { status: 'sent' } } : m
      )));
    } catch (err) {
      const errorText = (err as Error)?.message || 'Retry failed';
      setMessages((prev) => prev.map((m) => (
        m.id === message.id ? { ...m, delivery: { status: 'failed', error: errorText } } : m
      )));
      trackChatEvent('chat_message_external_failed', { ticket_id: selectedTicketId, error: errorText });
    }
  };

  const handleReconcileWorkflowTicket = async () => {
    const ticketId = String(data?.session?.ticket_id || selectedTicketId || '').trim();
    if (!ticketId || isWorkflowReconcileRunning) return;
    setIsWorkflowReconcileRunning(true);
    setWorkflowActionError('');
    try {
      await reconcileWorkflowTicket(ticketId);
      await Promise.all([
        workflowAuditState.refresh(),
        workflowReconciliationState.refresh(),
        workflowInboxState.refresh(),
      ]);
    } catch (err) {
      setWorkflowActionError((err as Error)?.message || 'Workflow reconcile failed');
    } finally {
      setIsWorkflowReconcileRunning(false);
    }
  };

  const handleToggleManualSuppression = async () => {
    // Legacy suppression control is intentionally disabled in this flow.
    setError('Manual suppression is disabled in this flow. Email ingestion endpoints were removed from the UI integration path.');
  };

  const displayTickets = sidebarTickets;
  const canonicalTicketId = data?.session.ticket_id || selectedTicketId;
  const selectedTicket = displayTickets.find((t) => t.id === canonicalTicketId || t.ticket_id === canonicalTicketId);
  useEffect(() => {
    const ticket = sidebarTickets.find((t) => t.id === selectedTicketId || t.ticket_id === selectedTicketId);
    setIsManualSuppressed(Boolean(ticket?.manual_suppressed));
  }, [selectedTicketId, sidebarTickets]);
  const canonicalRequesterUi = selectUiUserFromSsot({
    affected: data?.ssot?.affected_user_name || data?.ticket?.affected_user_normalized,
    requester: data?.ssot?.requester_name || data?.ticket?.requester_normalized || data?.ticket?.requester,
    fallbacks: [selectedTicket?.requester],
  });
  const canonicalCompanyUi = normalizePlainText(
    data?.ssot?.company || data?.ticket?.company || selectedTicket?.company || selectedTicket?.org,
    'Unknown org'
  );
  const canonicalSiteUi = normalizePlainText(
    selectedTicket?.site || selectedTicket?.org || data?.ssot?.company || data?.ticket?.company,
    'Unknown site'
  );
  const selectedTicketView = selectedTicket
    ? {
      ...selectedTicket,
      requester: canonicalRequesterUi,
      company: canonicalCompanyUi,
      org: canonicalCompanyUi,
      site: canonicalSiteUi,
    }
    : undefined;

  const ticketTitle = cleanTitle(data?.ssot?.title || data?.ticket?.title || selectedTicketView?.title) || 'Untitled ticket';
  const ticketNumber = data?.session.ticket_id || selectedTicketView?.ticket_id || `Ticket-${selectedTicketId.substring(0, 8)}`;
  const ticketLabel = `${ticketNumber} — ${ticketTitle}`;
  const primaryTech = contextOverrides.tech?.name || data?.ticket?.assigned_resource_name || selectedTicketView?.assigned_resource_name || 'Unassigned';
  const secondaryTech = contextOverrides.secondary_tech?.name || data?.ticket?.secondary_resource_name?.trim() || 'Unassigned';

  const ticketMetaLabel = `Primary: ${primaryTech} · Secondary: ${secondaryTech}`;

  const workflowTicket = (workflowInboxState.data || []).find(
    (row) => row.ticket_id === ticketNumber || row.ticket_id === canonicalTicketId
  );
  const managerAiForTicket = (managerAiState.data || []).filter((row) => row.ticket_id === ticketNumber || row.ticket_id === canonicalTicketId);
  const latestManagerAi = managerAiForTicket[0];
  const managerAuditForTicket = (managerAuditState.data || []).filter((row) => trustAuditMatchesTicket(row, ticketNumber, canonicalTicketId));
  const enrichmentProviderStatus = buildEnrichmentProviderStatus(managerAuditForTicket);
  const workflowAuditRows = workflowAuditState.data || [];
  const workflowReconcileRows = workflowReconciliationState.data || [];
  const workflowLastAudit = workflowAuditRows[0];
  const workflowReconcileTopSeverity = workflowReconcileRows.some((row) => row.severity === 'error')
    ? 'error'
    : workflowReconcileRows.some((row) => row.severity === 'warning')
      ? 'warning'
      : workflowReconcileRows.length > 0
        ? 'info'
        : null;
  const managerOpsAccessError = firstOpsAccessError(managerAiState.error, managerAuditState.error);
  const workflowAccessError = firstOpsAccessError(
    workflowInboxState.error,
    workflowAuditState.error,
    workflowReconciliationState.error
  );
  const workflowActionStateTone = workflowActionFeedback?.uxState === 'succeeded'
    ? 'good'
    : workflowActionFeedback?.uxState === 'failed'
      ? 'bad'
      : workflowActionFeedback?.uxState === 'retrying'
        ? 'warn'
        : 'info';

  useEffect(() => {
    const commandId = String(workflowActionFeedback?.commandId || '').trim();
    if (!commandId) return;
    if (workflowActionFeedback?.uxState !== 'pending' && workflowActionFeedback?.uxState !== 'retrying') return;
    const timer = window.setInterval(() => {
      void refreshWorkflowCommandFeedback(commandId);
    }, 4000);
    return () => {
      window.clearInterval(timer);
    };
  }, [workflowActionFeedback?.commandId, workflowActionFeedback?.uxState]);

  useEffect(() => {
    if (techAssignmentDraft) return;
    const fallback = String(workflowTicket?.assigned_to || data?.ticket?.assigned_resource_name || '').trim();
    if (fallback) setTechAssignmentDraft(fallback);
  }, [workflowTicket?.assigned_to, data?.ticket?.assigned_resource_name, techAssignmentDraft]);

  // Autotask is authoritative for editable context fields.
  // If local override diverges from server snapshot, drop local override.
  useEffect(() => {
    const serverCompanyId = toAutotaskId(data?.ticket?.company_id);
    const serverContactId = toAutotaskId(data?.ticket?.contact_id);
    const serverTechId = toAutotaskId(data?.ticket?.assigned_resource_id);
    const serverPriorityId = toAutotaskId(data?.ticket?.priority);
    const serverIssueTypeId = toAutotaskId(data?.ticket?.issue_type);
    const serverSubIssueTypeId = toAutotaskId(data?.ticket?.sub_issue_type);
    const serverSlaId = toAutotaskId(data?.ticket?.sla);

    setContextOverrides((prev) => {
      let changed = false;
      const next = { ...prev };

      if (prev.org) {
        const localOrgId = toAutotaskId(prev.org.id);
        if (serverCompanyId !== null && localOrgId !== serverCompanyId) {
          delete next.org;
          changed = true;
        }
      }

      if (prev.user) {
        const localUserId = toAutotaskId(prev.user.id);
        if (serverContactId !== null && localUserId !== serverContactId) {
          delete next.user;
          changed = true;
        }
      }

      if (prev.tech) {
        const localTechId = toAutotaskId(prev.tech.id);
        if (serverTechId !== null && localTechId !== serverTechId) {
          delete next.tech;
          changed = true;
        }
      }

      if (prev.priority) {
        const localPriorityId = toAutotaskId(prev.priority.id);
        if (serverPriorityId !== null && localPriorityId !== serverPriorityId) {
          delete next.priority;
          changed = true;
        }
      }

      if (prev.issue_type) {
        const localIssueTypeId = toAutotaskId(prev.issue_type.id);
        if (serverIssueTypeId !== null && localIssueTypeId !== serverIssueTypeId) {
          delete next.issue_type;
          changed = true;
        }
      }

      if (prev.sub_issue_type) {
        const localSubIssueTypeId = toAutotaskId(prev.sub_issue_type.id);
        if (serverSubIssueTypeId !== null && localSubIssueTypeId !== serverSubIssueTypeId) {
          delete next.sub_issue_type;
          changed = true;
        }
      }

      if (prev.service_level_agreement) {
        const localSlaId = toAutotaskId(prev.service_level_agreement.id);
        if (serverSlaId !== null && localSlaId !== serverSlaId) {
          delete next.service_level_agreement;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [data?.ticket?.company_id, data?.ticket?.contact_id, data?.ticket?.assigned_resource_id, data?.ticket?.priority, data?.ticket?.issue_type, data?.ticket?.sub_issue_type, data?.ticket?.sla]);

  const activeOrgId = (() => {
    const overrideOrgId = toAutotaskId(contextOverrides.org?.id);
    if (overrideOrgId !== null) return overrideOrgId;
    const ticketCompanyId = toAutotaskId(data?.ticket?.company_id);
    if (ticketCompanyId !== null) return ticketCompanyId;
    const resolvedFallback = toAutotaskId(resolvedOrgIdFallback);
    if (resolvedFallback !== null) return resolvedFallback;
    const userScopedOrgId = toAutotaskId(contextOverrides.user?.companyId);
    if (userScopedOrgId !== null) return userScopedOrgId;
    return null;
  })();

  const openContextEditor = (key: string) => {
    if (
      key !== 'Org' &&
      key !== 'Contact' &&
      key !== 'Tech' &&
      key !== 'Additional contacts' &&
      key !== 'Priority' &&
      key !== 'Issue Type' &&
      key !== 'Sub-Issue Type' &&
      key !== 'Service Level Agreement'
    ) return;
    setActiveContextEditor(key as EditableContextKey);
    setContextEditorQuery('');
    setContextEditorError('');
    setContextEditorOptions([]);
    setResolvedOrgIdFallback(null);
  };

  const closeContextEditor = () => {
    setActiveContextEditor(null);
    setContextEditorQuery('');
    setContextEditorError('');
    setContextEditorOptions([]);
    setContextEditorLoading(false);
    setContextEditorSaving(false);
    setResolvedOrgIdFallback(null);
  };

  const handleSelectContextOption = async (option: ContextEditorOption) => {
    if (!activeContextEditor) return;
    const ticketRef = String(data?.session?.ticket_id || selectedTicketId || '').trim();
    if (!ticketRef) {
      setContextEditorError('Ticket reference unavailable for update.');
      return;
    }
    if (activeContextEditor === 'Org') {
      const applyOrgSelection = (companyId: number, companyName: string) => {
        setContextOverrides((prev) => ({
          ...(() => {
            const { user: _omitUser, ...rest } = prev;
            return rest;
          })(),
          org: { id: companyId, name: companyName },
        }));
      };

      // Optimistic local selection guarantees Contact->Org dependency immediately.
      applyOrgSelection(option.id, option.label);
      setContextEditorSaving(true);
      setContextEditorError('');
      try {
        const updated = await updateAutotaskTicketContext(ticketRef, { companyId: option.id });
        const resolvedCompanyId = toAutotaskId(updated.companyId) ?? option.id;
        applyOrgSelection(resolvedCompanyId, updated.companyName || option.label);
      } catch (err: any) {
        // Keep local Org selection so user can continue to Contact selection flow.
        setWorkflowActionError(
          `Org selected locally. Autotask write pending/failed: ${String(err?.message || 'Unable to update Org in Autotask')}`
        );
      } finally {
        closeContextEditor();
      }
      return;
    }

    if (activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts') {
      if (activeOrgId === null) {
        setContextEditorError('Select an Org first to set Contact.');
        return;
      }
      setContextEditorSaving(true);
      setContextEditorError('');
      try {
        if (activeContextEditor === 'Contact') {
          const updated = await updateAutotaskTicketContext(ticketRef, { companyId: activeOrgId, contactId: option.id });
          setContextOverrides((prev) => ({
            ...prev,
            user: {
              id: updated.contactId ?? option.id,
              name: updated.contactName || option.label,
              companyId: updated.companyId ?? activeOrgId,
            },
            ...(updated.companyId !== null && updated.companyId !== undefined && updated.companyName
              ? { org: { id: updated.companyId, name: updated.companyName } }
              : {}),
          }));
        } else {
          // For Additional contacts, we just update the local UX override for now. 
          // Autotask doesn't natively support this on the primary patch endpoint without secondary mapping.
          setContextOverrides((prev) => ({
            ...prev,
            additional_contact: {
              id: option.id,
              name: option.label,
              companyId: activeOrgId,
            },
          }));
        }
        closeContextEditor();
      } catch (err: any) {
        setContextEditorError(String(err?.message || `Unable to update ${activeContextEditor} in Autotask`));
        setContextEditorSaving(false);
      }
      return;
    }

    if (
      activeContextEditor === 'Priority' ||
      activeContextEditor === 'Issue Type' ||
      activeContextEditor === 'Sub-Issue Type' ||
      activeContextEditor === 'Service Level Agreement'
    ) {
      setContextEditorSaving(true);
      setContextEditorError('');
      try {
        const updated = await updateAutotaskTicketContext(ticketRef, {
          ...(activeContextEditor === 'Priority' ? { priorityId: option.id } : {}),
          ...(activeContextEditor === 'Issue Type' ? { issueTypeId: option.id } : {}),
          ...(activeContextEditor === 'Sub-Issue Type' ? { subIssueTypeId: option.id } : {}),
          ...(activeContextEditor === 'Service Level Agreement' ? { serviceLevelAgreementId: option.id } : {}),
        });
        setContextOverrides((prev) => ({
          ...prev,
          ...(activeContextEditor === 'Priority'
            ? { priority: { id: updated.priorityId ?? option.id, name: updated.priorityLabel || option.label } }
            : {}),
          ...(activeContextEditor === 'Issue Type'
            ? { issue_type: { id: updated.issueTypeId ?? option.id, name: updated.issueTypeLabel || option.label } }
            : {}),
          ...(activeContextEditor === 'Sub-Issue Type'
            ? { sub_issue_type: { id: updated.subIssueTypeId ?? option.id, name: updated.subIssueTypeLabel || option.label } }
            : {}),
          ...(activeContextEditor === 'Service Level Agreement'
            ? { service_level_agreement: { id: updated.serviceLevelAgreementId ?? option.id, name: updated.serviceLevelAgreementLabel || option.label } }
            : {}),
        }));
        closeContextEditor();
      } catch (err: any) {
        setContextEditorError(String(err?.message || `Unable to update ${activeContextEditor} in Autotask`));
        setContextEditorSaving(false);
      }
      return;
    }
    setTechAssignmentDraft(String(option.id));
    const assignment = await submitTechAssignmentById(String(option.id), option.label);
    if (!assignment.ok) {
      setContextEditorError(assignment.error || 'Unable to assign selected technician');
      return;
    }
    closeContextEditor();
  };

  const handleTechUpdate = (role: 'primary' | 'secondary', resource?: { id: number; name: string }) => {
    setContextOverrides((prev) => {
      const next = { ...prev };
      if (role === 'primary') {
        if (resource) next.tech = resource;
        else delete next.tech;
      } else {
        if (resource) next.secondary_tech = resource;
        else delete next.secondary_tech;
      }
      return next;
    });
  };

  useEffect(() => {
    if (!activeContextEditor) return;
    const ticketFieldKey = mapEditorToTicketFieldKey(activeContextEditor);
    if ((activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts') && activeOrgId === null) {
      const orgName = String(
        contextOverrides.org?.name ||
        data?.ssot?.company ||
        data?.ticket?.company ||
        selectedTicketView?.company ||
        selectedTicketView?.org ||
        ''
      ).trim();
      if (!orgName) {
        setContextEditorOptions([]);
        setContextEditorError(`Select an Org first to list ${activeContextEditor.toLowerCase()} options.`);
        return;
      }
      let ignoreResolve = false;
      setContextEditorLoading(true);
      setContextEditorError('');
      void (async () => {
        try {
          const rows = await searchAutotaskCompanies(orgName, 30);
          if (ignoreResolve) return;
          const exact = rows.find((row) => row.name.trim().toLowerCase() === orgName.toLowerCase());
          const picked = exact || rows[0];
          const resolvedId = toAutotaskId(picked?.id);
          if (resolvedId !== null) {
            setResolvedOrgIdFallback(resolvedId);
            setContextEditorError('');
          } else {
            setContextEditorOptions([]);
            setContextEditorError(`Select an Org first to list ${activeContextEditor.toLowerCase()} options.`);
          }
        } catch (err: any) {
          if (!ignoreResolve) {
            setContextEditorOptions([]);
            setContextEditorError(String(err?.message || `Unable to resolve Org before listing ${activeContextEditor.toLowerCase()} options.`));
          }
        } finally {
          if (!ignoreResolve) setContextEditorLoading(false);
        }
      })();
      return () => {
        ignoreResolve = true;
      };
    }

    if (ticketFieldKey) {
      const cached = ticketFieldOptionsCache[ticketFieldKey] || [];
      if (cached.length > 0) {
        setContextEditorLoading(false);
        setContextEditorError('');
        setContextEditorOptions(mapTicketFieldEditorToOptions(cached, contextEditorQuery));
        return;
      }
    }

    let ignore = false;
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
        if (
          activeContextEditor === 'Priority' ||
          activeContextEditor === 'Issue Type' ||
          activeContextEditor === 'Sub-Issue Type' ||
          activeContextEditor === 'Service Level Agreement'
        ) {
          const options = await listAutotaskTicketFieldOptionsByField(ticketFieldKey!);
          if (!ignore) {
            setTicketFieldOptionsCache((prev) => ({ ...prev, [ticketFieldKey!]: options }));
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

    void run();
    return () => {
      ignore = true;
    };
  }, [activeContextEditor, activeOrgId, contextEditorQuery, ticketFieldOptionsCache, contextOverrides.org?.name, data?.ssot?.company, data?.ticket?.company, selectedTicketView?.company, selectedTicketView?.org]);

  const digestFacts = Array.isArray(data?.evidence_pack?.evidence_digest?.facts_confirmed)
    ? data?.evidence_pack?.evidence_digest?.facts_confirmed
    : [];
  const digestFactMap = new Map<string, string>(
    digestFacts.map((f: any) => [String(f?.id || ''), String(f?.fact || '').trim()])
  );
  const normalizeFact = (value: string) => value.replace(/\s+/g, ' ').trim();
  const parsedPlaybookChecklist = parseChecklistFromPlaybook(data?.playbook?.content_md || undefined);

  useEffect(() => {
    const missingFields: AutotaskTicketFieldKey[] = [];
    const priorityId = toAutotaskId(data?.ticket?.priority);
    const issueTypeId = toAutotaskId(data?.ticket?.issue_type);
    const subIssueTypeId = toAutotaskId(data?.ticket?.sub_issue_type);
    const slaId = toAutotaskId(data?.ticket?.sla);

    if (priorityId !== null && !String(data?.ticket?.priority_label || '').trim() && !ticketFieldOptionsCache.priority?.length) {
      missingFields.push('priority');
    }
    if (issueTypeId !== null && !String(data?.ticket?.issue_type_label || '').trim() && !ticketFieldOptionsCache.issueType?.length) {
      missingFields.push('issueType');
    }
    if (subIssueTypeId !== null && !String(data?.ticket?.sub_issue_type_label || '').trim() && !ticketFieldOptionsCache.subIssueType?.length) {
      missingFields.push('subIssueType');
    }
    if (slaId !== null && !String(data?.ticket?.sla_label || '').trim() && !ticketFieldOptionsCache.serviceLevelAgreement?.length) {
      missingFields.push('serviceLevelAgreement');
    }
    if (missingFields.length === 0) return;

    let ignore = false;
    void (async () => {
      for (const field of missingFields) {
        try {
          const options = await listAutotaskTicketFieldOptionsByField(field);
          if (ignore) return;
          setTicketFieldOptionsCache((prev) => (prev[field]?.length ? prev : { ...prev, [field]: options }));
        } catch {
          if (ignore) return;
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [
    data?.ticket?.priority,
    data?.ticket?.priority_label,
    data?.ticket?.issue_type,
    data?.ticket?.issue_type_label,
    data?.ticket?.sub_issue_type,
    data?.ticket?.sub_issue_type_label,
    data?.ticket?.sla,
    data?.ticket?.sla_label,
    ticketFieldOptionsCache.priority?.length,
    ticketFieldOptionsCache.issueType?.length,
    ticketFieldOptionsCache.subIssueType?.length,
    ticketFieldOptionsCache.serviceLevelAgreement?.length,
  ]);

  const derivedPriorityLabel = String(
    contextOverrides.priority?.name ||
    data?.ticket?.priority_label ||
    resolvePicklistLabelFromCache(ticketFieldOptionsCache.priority, data?.ticket?.priority) ||
    data?.ticket?.priority ||
    'Unknown'
  );
  const derivedIssueTypeLabel = String(
    contextOverrides.issue_type?.name ||
    data?.ticket?.issue_type_label ||
    resolvePicklistLabelFromCache(ticketFieldOptionsCache.issueType, data?.ticket?.issue_type) ||
    data?.ticket?.issue_type ||
    'Unknown'
  );
  const derivedSubIssueTypeLabel = String(
    contextOverrides.sub_issue_type?.name ||
    data?.ticket?.sub_issue_type_label ||
    resolvePicklistLabelFromCache(ticketFieldOptionsCache.subIssueType, data?.ticket?.sub_issue_type) ||
    data?.ticket?.sub_issue_type ||
    'Unknown'
  );
  const derivedSlaLabel = String(
    contextOverrides.service_level_agreement?.name ||
    data?.ticket?.sla_label ||
    resolvePicklistLabelFromCache(ticketFieldOptionsCache.serviceLevelAgreement, data?.ticket?.sla) ||
    data?.ticket?.sla ||
    'Unknown'
  );
  const parsedPlaybookEscalation = parseEscalationFromPlaybook(data?.playbook?.content_md || undefined);
  const playbookPanelData = data
    ? {
      ticketId: ticketNumber,
      context: [
        {
          key: 'Org',
          val: contextOverrides.org?.name || data?.ssot?.company || selectedTicketView?.company || selectedTicketView?.org || 'Unknown org',
          editable: true,
        },
        {
          key: 'Contact',
          val: contextOverrides.user?.name || normalizePlainText(
            selectUiUserFromSsot({
              affected: data?.ssot?.affected_user_name,
              requester: data?.ssot?.requester_name,
              fallbacks: [selectedTicketView?.requester],
            }),
            'Unknown'
          ),
          editable: true,
        },
        {
          key: 'Additional contacts',
          val: contextOverrides.additional_contact?.name || data?.ssot?.additional_contacts || 'Unknown',
          editable: true,
        },
        {
          key: 'Issue Type',
          val: derivedIssueTypeLabel,
          editable: true,
        },
        {
          key: 'Sub-Issue Type',
          val: derivedSubIssueTypeLabel,
          editable: true,
        },
        {
          key: 'Priority',
          val: derivedPriorityLabel,
          editable: true,
        },
        {
          key: 'Service Level Agreement',
          val: derivedSlaLabel,
          editable: true,
        },
        {
          key: 'User Device',
          val: data?.ssot?.device_name || data?.evidence_pack?.device?.hostname || 'Unknown',
        },
        {
          key: 'ISP',
          val: data?.ssot?.isp_name || data?.evidence_pack?.external_status?.[0]?.provider || 'Unknown',
          ...(data?.evidence_pack?.external_status?.[0]?.status ? { highlight: '#F97316' } : {}),
        },
        {
          key: 'Phone Provider',
          val: data?.ssot?.phone_provider_name || 'Unknown',
        },
        { key: 'Firewall', val: data?.ssot?.firewall_make_model || data?.evidence_pack?.config?.firewall || 'Unknown' },
        { key: 'Switch', val: data?.ssot?.switch_make_model || 'Unknown' },
        { key: 'WiFi', val: data?.ssot?.wifi_make_model || 'Unknown' },
        { key: 'Additional Devices', val: data?.ssot?.alternate_device || 'Unknown' },
      ].map(item => ({ ...item, val: item.val?.toLowerCase() === 'unknown' || item.val?.toLowerCase() === 'unknown org' ? '-' : item.val })),
      hypotheses: Array.isArray(data.diagnosis?.top_hypotheses)
        ? data.diagnosis.top_hypotheses.slice(0, 3).map((h: any, i: number) => ({
          rank: Number(h?.rank) || i + 1,
          hypothesis: String(h?.hypothesis || 'Hypothesis'),
          confidence: Number(h?.confidence) || 0,
          evidence: Array.isArray(h?.evidence)
            ? h.evidence
              .slice(0, 4)
              .map((e: any) => {
                const id = String(e || '');
                const fact = normalizeFact(String(digestFactMap.get(id) || ''));
                return {
                  id,
                  label: fact || undefined,
                };
              })
              .filter((e: any, idx: number, arr: any[]) =>
                arr.findIndex((x) => String(x.label || x.id) === String(e.label || e.id)) === idx
              )
            : [],
        }))
        : [],
      checklist: parsedPlaybookChecklist,
      escalate: parsedPlaybookEscalation,
    }
    : undefined;
  const visibleMessages = channelFilter === 'all'
    ? messages
    : messages.filter((msg) => (msg.channel ?? 'internal_ai') === channelFilter);
  const channelCounts = {
    all: messages.length,
    internal_ai: messages.filter((msg) => (msg.channel ?? 'internal_ai') === 'internal_ai').length,
    external_psa_user: messages.filter((msg) => msg.channel === 'external_psa_user').length,
  };

  return (
    <ResizableLayout
      transparentSidebar={true}
      sidebarContent={
        <ChatSidebar
          tickets={displayTickets}
          currentTicketId={selectedTicketId}
          isLoading={isLoadingTickets || loading}
          onCreateTicket={() => router.push('/triage/home', { scroll: false })}
          onSelectTicket={(id) => {
            if (id === selectedTicketId) return;
            setSelectedTicketId(id);
            const nextPath = pathname.replace(/\/triage\/[^/]+$/, `/triage/${id}`);
            window.history.replaceState(null, '', `${nextPath}${window.location.search}`);
          }}
        />
      }
      rightContent={
        <PlaybookPanel
          content={data?.playbook?.content_md || null}
          status={playbookStatus}
          sessionStatus={data?.session?.status}
          onEditContextItem={openContextEditor}
          {...(playbookPanelData ? { data: playbookPanelData } : {})}
        />
      }
      mainContent={
        <div className="flex-1 flex flex-col" style={{ background: 'transparent', minWidth: 0, height: '100%', minHeight: 0, padding: '12px', gap: '8px' }}>
          <div style={{ border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', flexShrink: 0 }}>
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--bento-outline)', background: 'transparent' }}
            >
              <div
                style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: playbookReady ? 'var(--green)' : loading ? '#EAB308' : 'var(--accent)',
                  boxShadow: loading || !playbookReady ? `0 0 6px ${loading ? '#EAB308' : 'var(--accent)'}` : undefined,
                }}
              />
              <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ticketLabel}
              </p>
              <div ref={headerMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '30px',
                    height: '30px',
                    borderRadius: '10px',
                    color: isHeaderMenuOpen ? 'var(--accent)' : 'var(--text-muted)',
                    background: isHeaderMenuOpen ? 'rgba(91,127,255,0.08)' : 'var(--bg-card)',
                    border: isHeaderMenuOpen ? '1px solid rgba(91,127,255,0.30)' : '1px solid var(--bento-outline)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  title="Actions"
                >
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="5" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                    <circle cx="10" cy="15" r="1.5" fill="currentColor" />
                  </svg>
                </button>
                {isHeaderMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      zIndex: 9999,
                      minWidth: '220px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bento-outline)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '0 8px', margin: '4px 0' }}>Triage</h4>
                      <button
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleToggleManualSuppression();
                        }}
                        disabled={isManualSuppressionSaving}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: isManualSuppressed ? '#F59E0B' : 'var(--text-primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: isManualSuppressionSaving ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          opacity: isManualSuppressionSaving ? 0.7 : 1,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bento-outline)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M7 13L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        {isManualSuppressed ? 'Remove Suppression' : 'Suppress Ticket'}
                      </button>
                    </div>

                    <div style={{ height: '1px', background: 'var(--bento-outline)', margin: '0 4px', flexShrink: 0 }}></div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, padding: '0 8px', margin: '4px 0' }}>Sync</h4>
                      <button
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleReconcileWorkflowTicket();
                        }}
                        disabled={isWorkflowReconcileRunning || !ticketNumber}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: (isWorkflowReconcileRunning || !ticketNumber) ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          opacity: (isWorkflowReconcileRunning || !ticketNumber) ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!isWorkflowReconcileRunning && ticketNumber) e.currentTarget.style.background = 'var(--bento-outline)'; }}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.7M16 10a6 6 0 0 1-10.2 4.2L4 12.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M16 4.5v3.2h-3.2M4 15.5v-3.2h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Reconcile Data
                      </button>
                      <button
                        onClick={() => {
                          setIsHeaderMenuOpen(false);
                          handleRefreshPipeline();
                        }}
                        disabled={loading}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          color: 'var(--text-primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          textAlign: 'left',
                          opacity: loading ? 0.5 : 1,
                        }}
                        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--bento-outline)'; }}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                          <path d="M15.5 10C15.5 13.0376 13.0376 15.5 10 15.5C6.96243 15.5 4.5 13.0376 4.5 10C4.5 6.96243 6.96243 4.5 10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          <path d="M9.5 7L12 4.5L9.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Hard Refresh
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)', marginLeft: playbookReady ? '0' : 'auto' }}>
                {playbookReady ? '' : loading ? t('statusInitializing') : t('statusProcessing')}
              </span>
            </div>
            <div className="px-4 py-3 flex flex-wrap items-center gap-2.5" style={{ background: 'transparent' }}>
              <TechPill
                label="Primary"
                name={primaryTech}
                type="primary"
                onEdit={() => openContextEditor('Tech')}
                onRemove={() => handleTechUpdate('primary')}
              />
              <TechPill
                label="Secondary"
                name={secondaryTech}
                type="secondary"
                onEdit={() => openContextEditor('Tech')}
                onRemove={() => handleTechUpdate('secondary')}
              />
            </div>
          </div>

          {/* Messages Container */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{
              ...velocityStyle,
              padding: '14px 14px 8px',
              border: '1px solid var(--bento-outline)',
              borderRadius: '14px',
              background: 'var(--bg-card)',
              minHeight: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>View</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: '999px', border: '1px solid var(--bento-outline)', background: 'var(--bg-panel)', padding: '2px', gap: '2px' }}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'internal_ai', label: 'AI' },
                  { key: 'external_psa_user', label: 'PSA/User' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setChannelFilter(opt.key as 'all' | 'internal_ai' | 'external_psa_user')}
                    style={{
                      borderRadius: '999px',
                      border: 'none',
                      background: channelFilter === opt.key ? 'rgba(91,127,255,0.12)' : 'transparent',
                      color: channelFilter === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                      padding: '4px 9px',
                      fontSize: '10px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label} {channelCounts[opt.key as 'all' | 'internal_ai' | 'external_psa_user']}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div
                className="rounded-xl p-4 mb-4 text-sm"
                style={{
                  background: 'rgba(248,81,73,0.08)',
                  border: '1px solid rgba(248,81,73,0.2)',
                  color: '#fca5a5',
                }}
              >
                <p className="font-semibold mb-0.5">{t('connectionError')}</p>
                <p style={{ color: '#f87171', opacity: 0.85 }}>{error}</p>
              </div>
            )}

            {visibleMessages.map((msg, idx) => (
              <ChatMessage key={msg.id} message={msg} index={idx} onRetryExternalMessage={handleRetryExternalMessage} />
            ))}

            {loading && messages.length === 1 && (
              <ChatMessage
                key="loading-message"
                message={{
                  id: 'loading',
                  role: 'system',
                  content: t('initializingSession'),
                  timestamp: new Date(),
                  type: 'status',
                  channel: 'internal_ai',
                }}
                index={visibleMessages.length}
              />
            )}
          </div>

          {/* Chat Input */}
          <ChatInput
            onSubmit={handleSendMessage}
            placeholder={t('placeholder')}
            disabled={loading}
            isLoading={false}
            attachmentsEnabled={true}
            targetChannel={targetChannel}
            onTargetChannelChange={(channel) => {
              setTargetChannel(channel);
              trackChatEvent('chat_channel_selected', { ticket_id: selectedTicketId, channel });
            }}
            showChannelToggle={true}
            hints={[
              'Reanalyze with new info',
              'Generate user questions',
              'Summarize for ticket',
              'Escalate to L3',
            ]}
          />

          {activeContextEditor ? (
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Edit ${activeContextEditor}`}
              // Increased duration and added ease-out for a very smooth, magical fade of the dark blur backdrop
              className="animate-in fade-in duration-500 ease-out"
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999, // Ensure global positioning top-level
                background: 'rgba(2, 4, 8, 0.55)', // Elegant darker glass
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start', // Anchors to top
                justifyContent: 'center',
                paddingTop: '12vh', // Fixed vertical position, exactly like the screenshot
              }}
              onClick={closeContextEditor}
            >
              <div
                // Softer zoom and gentle slide for a floating magical entrance
                className="animate-in zoom-in-[0.95] slide-in-from-top-4 duration-500 ease-out"
                style={{
                  width: 'min(640px, calc(100vw - 32px))',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.08)', // Subtle glass border
                  background: 'var(--bg-elevated)', // Deep dark or clean light depending on theme
                  boxShadow: '0 32px 64px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
                  overflow: 'hidden', // Contains content cleanly
                  transformOrigin: 'top center',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Section (Always Visible) */}
                <div style={{ padding: '20px 24px 16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        Edit {activeContextEditor}
                      </h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                        {activeContextEditor === 'Contact' || activeContextEditor === 'Additional contacts'
                          ? activeOrgId !== null
                            ? `Listing contacts from selected Org (ID ${activeOrgId})`
                            : 'Select an Org first to list contacts'
                          : activeContextEditor === 'Priority' || activeContextEditor === 'Issue Type' || activeContextEditor === 'Sub-Issue Type' || activeContextEditor === 'Service Level Agreement'
                            ? 'Source: Autotask ticket field metadata'
                            : 'Source: Autotask read-only global search'}
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
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
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
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    autoFocus
                  />

                  {contextEditorError ? (
                    <div className="animate-in fade-in slide-in-from-top-2" style={{ fontSize: '13px', color: '#ff6b6b', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      {contextEditorError}
                    </div>
                  ) : null}
                </div>

                {/* List Section (Smooth CSS Grid Slide-Down) */}
                <div
                  style={{
                    display: 'grid',
                    // The magic trick to slide down auto-height elements smoothly without JS math
                    gridTemplateRows: contextEditorLoading || contextEditorOptions.length > 0 || contextEditorSaving ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    background: 'var(--bg-panel)'
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
                        gap: '8px'
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
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 8px', opacity: 0.5 }}><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          <span style={{ fontSize: '13px' }}>No records returned.</span>
                        </div>
                      ) : (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {contextEditorOptions.map((option) => (
                            <button
                              key={`${activeContextEditor}-${option.id}`}
                              type="button"
                              onClick={() => { void handleSelectContextOption(option); }}
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

          <button
            type="button"
            onClick={() => setIsDevPanelOpen((v) => !v)}
            aria-expanded={isDevPanelOpen}
            aria-controls="p0-dev-floating-panel"
            title={isDevPanelOpen ? 'Hide development tools panel' : 'Show development tools panel'}
            style={{
              position: 'fixed',
              right: '18px',
              bottom: '18px',
              zIndex: 60,
              borderRadius: '14px',
              border: '1px solid rgba(91,127,255,0.24)',
              background: isDevPanelOpen ? 'rgba(91,127,255,0.14)' : 'rgba(255,255,255,0.96)',
              color: isDevPanelOpen ? '#4f6fe9' : 'var(--text-primary)',
              padding: '10px 12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              fontWeight: 600,
              backdropFilter: 'blur(14px)',
            }}
          >
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: isDevPanelOpen ? '#4f6fe9' : '#9ca3af',
              boxShadow: isDevPanelOpen ? '0 0 10px rgba(79,111,233,0.5)' : 'none',
            }} />
            {isDevPanelOpen ? 'Hide dev tools' : 'Show dev tools'}
          </button>

          {isDevPanelOpen ? (
            <div
              id="p0-dev-floating-panel"
              role="dialog"
              aria-label="Development tools for workflow and P0 signals"
              style={{
                position: 'fixed',
                right: '18px',
                bottom: '72px',
                width: 'min(460px, calc(100vw - 36px))',
                maxHeight: 'min(68vh, 760px)',
                overflowY: 'auto',
                zIndex: 59,
                borderRadius: '18px',
                border: '1px solid var(--bento-outline)',
                background: 'rgba(245,247,252,0.96)',
                boxShadow: '0 18px 48px rgba(12,18,33,0.18)',
                backdropFilter: 'blur(18px)',
                padding: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Development tools (P0 validation)</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ticket-level workflow health, AI signals, read-only integrations, and internal validation links.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDevPanelOpen(false)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '9px',
                    border: '1px solid var(--bento-outline)', background: '#fff', color: 'var(--text-muted)'
                  }}
                  aria-label="Close development tools panel"
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div style={triPaneMetricCardStyle()}>
                  <div style={triPaneMetricLabelStyle()}>Launch policy</div>
                  <div style={{ ...triPaneMetricValueStyle(), whiteSpace: 'normal' }}>Autotask can write updates. Other integrations are read-only.</div>
                </div>
                <div style={triPaneMetricCardStyle()}>
                  <div style={triPaneMetricLabelStyle()}>Workflow connection</div>
                  <div style={triPaneMetricValueStyle()}>
                    {workflowTicket ? 'This ticket is present in the workflow inbox.' : (workflowAccessError ? 'Workflow data needs access or is unavailable.' : 'This ticket is not in the workflow inbox yet.')}
                  </div>
                </div>
                <div style={triPaneMetricCardStyle()}>
                  <div style={triPaneMetricLabelStyle()}>AI handoff status</div>
                  <div style={triPaneMetricValueStyle()}>
                    {latestManagerAi
                      ? latestManagerAi.hitl_status === 'pending'
                        ? 'Waiting for human review'
                        : 'AI handoff is available'
                      : (managerOpsAccessError ? 'Admin access required to view AI signals' : 'AI handoff has not been generated')}
                  </div>
                </div>
                <div style={triPaneMetricCardStyle()}>
                  <div style={triPaneMetricLabelStyle()}>AI confidence</div>
                  <div style={triPaneMetricValueStyle()}>
                    {latestManagerAi ? `${Math.round(Number(latestManagerAi.confidence || 0) * 100)}%` : 'Not available'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ ...triPaneMetricLabelStyle(), marginBottom: '6px' }}>Workflow health details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={triPaneMetricCardStyle()}>
                    <div style={triPaneMetricLabelStyle()}>Workflow status</div>
                    <div style={triPaneMetricValueStyle()}>{workflowTicket?.status || (workflowAccessError ? 'Unavailable' : 'Not available')}</div>
                  </div>
                  <div style={triPaneMetricCardStyle()}>
                    <div style={triPaneMetricLabelStyle()}>Workflow audit events</div>
                    <div style={triPaneMetricValueStyle()}>{workflowAuditRows.length}</div>
                  </div>
                  <div style={triPaneMetricCardStyle()}>
                    <div style={triPaneMetricLabelStyle()}>Reconciliation issues</div>
                    <div style={triPaneMetricValueStyle()}>{workflowReconcileRows.length === 0 ? 'None' : `${workflowReconcileRows.length} (${workflowReconcileTopSeverity || 'info'})`}</div>
                  </div>
                  <div style={triPaneMetricCardStyle()}>
                    <div style={triPaneMetricLabelStyle()}>Latest workflow audit</div>
                    <div style={triPaneMetricValueStyle()}>{workflowLastAudit ? humanizeWorkflowAuditAction(workflowLastAudit.action) : 'No workflow audit event yet'}</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ ...triPaneMetricLabelStyle(), marginBottom: '6px' }}>Read-only integration status</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(enrichmentProviderStatus).map(([provider, status]) => (
                    <div key={provider} style={triPaneMetricCardStyle()}>
                      <div style={triPaneMetricLabelStyle()}>{humanizeProviderName(provider)}</div>
                      <div style={triPaneMetricValueStyle()}>{humanizeProviderStatus(status.label)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <div style={{ ...triPaneMetricLabelStyle(), marginBottom: '6px' }}>Technician assignment command</div>
                <div style={triPaneMetricCardStyle()}>
                  {workflowWritePolicyDisabled ? (
                    <div style={{
                      border: '1px solid rgba(245,158,11,0.22)',
                      background: 'rgba(245,158,11,0.08)',
                      borderRadius: '10px',
                      padding: '8px',
                      marginBottom: '8px',
                      color: '#b45309',
                      fontSize: '11px',
                    }}>
                      Write policy currently disabled for this session (read-only mode). Re-authenticate or request policy update before retrying writes.
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      value={techAssignmentDraft}
                      onChange={(e) => setTechAssignmentDraft(e.target.value)}
                      disabled={workflowWritePolicyDisabled || isSubmittingTechAssignment}
                      placeholder="Assignee resource id"
                      aria-label="Assignee resource id"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '30px',
                        borderRadius: '8px',
                        border: '1px solid var(--bento-outline)',
                        padding: '0 9px',
                        fontSize: '11px',
                        color: 'var(--text-primary)',
                        background: '#fff',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleSubmitTechAssignment}
                      disabled={workflowWritePolicyDisabled || isSubmittingTechAssignment || !techAssignmentDraft.trim()}
                      style={{
                        height: '30px',
                        borderRadius: '8px',
                        border: '1px solid rgba(91,127,255,0.25)',
                        background: 'rgba(91,127,255,0.08)',
                        color: '#3f5fcb',
                        padding: '0 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        opacity: (workflowWritePolicyDisabled || isSubmittingTechAssignment || !techAssignmentDraft.trim()) ? 0.6 : 1,
                      }}
                    >
                      {isSubmittingTechAssignment ? 'Submitting…' : 'Edit Tech'}
                    </button>
                  </div>
                  {workflowActionFeedback ? (
                    <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      <span style={triPaneBadgeStyle(workflowActionStateTone)}>
                        {workflowActionFeedback.uxState.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {workflowActionFeedback.detail}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        attempts {workflowActionFeedback.attempts}/{workflowActionFeedback.maxAttempts || 'n/a'}
                      </span>
                      {workflowActionFeedback.nextRetryAt ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          next retry {new Date(workflowActionFeedback.nextRetryAt).toLocaleTimeString()}
                        </span>
                      ) : null}
                      {workflowActionFeedback.retryable && workflowActionFeedback.commandId ? (
                        <button
                          type="button"
                          onClick={handleManualWorkflowRetry}
                          style={{
                            height: '24px',
                            borderRadius: '999px',
                            border: '1px solid rgba(245,158,11,0.25)',
                            background: 'rgba(245,158,11,0.08)',
                            color: '#b45309',
                            padding: '0 9px',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          Retry now
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {(workflowActionError || workflowAccessError || managerOpsAccessError) ? (
                <div style={{
                  border: '1px solid rgba(245,158,11,0.22)',
                  background: 'rgba(245,158,11,0.08)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  marginBottom: '10px',
                  color: '#b45309',
                  fontSize: '12px',
                  fontWeight: 500,
                }}>
                  {[workflowActionError, workflowAccessError, managerOpsAccessError].filter(Boolean).join(' · ')}
                </div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                <a
                  href="/manager-ops/p0?internal=1"
                  title="Internal validation screen for manager operations P0 signals"
                  style={triPaneFooterLinkChipStyle()}
                >
                  Open internal manager validation screen
                </a>
                <a
                  href={`/workflow/p0/${encodeURIComponent(ticketNumber)}?internal=1`}
                  title="Internal validation screen for workflow details P0 signals"
                  style={triPaneFooterLinkChipStyle()}
                >
                  Open internal workflow validation screen
                </a>
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

type TriPaneBadgeTone = 'neutral' | 'info' | 'good' | 'warn' | 'bad';

function triPaneBadgeStyle(tone: TriPaneBadgeTone): CSSProperties {
  const palette: Record<TriPaneBadgeTone, { color: string; bg: string; border: string }> = {
    neutral: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--bento-outline)' },
    info: { color: '#5B7FFF', bg: 'rgba(91,127,255,0.08)', border: 'rgba(91,127,255,0.22)' },
    good: { color: '#1DB98A', bg: 'rgba(29,185,138,0.08)', border: 'rgba(29,185,138,0.20)' },
    warn: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)' },
    bad: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.22)' },
  };
  const colors = palette[tone];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 7px',
    borderRadius: '999px',
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    color: colors.color,
    fontSize: '10px',
    fontWeight: 600,
  };
}

function triPaneMetricCardStyle(): CSSProperties {
  return {
    border: '1px solid var(--bento-outline)',
    borderRadius: '10px',
    background: 'var(--bg-card)',
    padding: '8px 10px',
    minWidth: 0,
  };
}

function triPaneMetricLabelStyle(): CSSProperties {
  return {
    fontFamily: 'var(--font-jetbrains-mono)',
    fontSize: '8.5px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
    marginBottom: '4px',
  };
}

function triPaneMetricValueStyle(): CSSProperties {
  return {
    fontSize: '11.5px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };
}

function triPaneFooterLinkChipStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 9px',
    borderRadius: '8px',
    border: '1px solid var(--bento-outline)',
    background: 'var(--bg-card)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    fontWeight: 500,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };
}

function firstOpsAccessError(...errors: Array<string | null | undefined>): string {
  const first = errors.find(Boolean);
  if (!first) return '';
  if (/403|insufficient permissions|forbidden/i.test(first)) return 'Admin-only P0 trust/ops signals in current backend policy';
  return first;
}

function trustAuditMatchesTicket(row: P0AuditRecord, ...ticketIds: Array<string | undefined>) {
  const ids = new Set(ticketIds.map((id) => String(id || '').trim()).filter(Boolean));
  if (ids.size === 0) return false;
  const correlationId = String(row.correlation?.ticket_id || '').trim();
  const targetId = String(row.target?.id || '').trim();
  const metadataTicketId = typeof row.metadata?.ticket_id === 'string' ? String(row.metadata.ticket_id).trim() : '';
  return (correlationId && ids.has(correlationId)) || (targetId && ids.has(targetId)) || (metadataTicketId && ids.has(metadataTicketId));
}

type ProviderStatus = {
  label: string;
  shortLabel: string;
  tone: TriPaneBadgeTone;
  key: string;
};

function buildEnrichmentProviderStatus(rows: P0AuditRecord[]): Record<string, ProviderStatus> {
  const providers = [
    { key: 'itglue', shortLabel: 'ITG' },
    { key: 'ninjaone', shortLabel: 'Ninja' },
    { key: 'sentinelone', shortLabel: 'S1' },
    { key: 'check_point', shortLabel: 'CP' },
  ] as const;

  const latestByProvider = new Map<string, P0AuditRecord>();
  for (const row of rows) {
    const match = row.action.match(/^enrichment\.read\.(itglue|ninjaone|sentinelone|check_point)$/);
    if (!match) continue;
    const key = String(match[1]);
    const current = latestByProvider.get(key);
    if (!current || String(current.timestamp) < String(row.timestamp)) latestByProvider.set(key, row);
  }

  const output: Record<string, ProviderStatus> = {};
  for (const provider of providers) {
    const latest = latestByProvider.get(provider.key);
    if (!latest) {
      output[provider.key] = { key: provider.key, shortLabel: provider.shortLabel, label: 'not loaded', tone: 'neutral' };
      continue;
    }
    if (latest.result === 'success') {
      output[provider.key] = { key: provider.key, shortLabel: provider.shortLabel, label: 'read-only ok', tone: 'good' };
      continue;
    }
    if (latest.result === 'failure') {
      output[provider.key] = { key: provider.key, shortLabel: provider.shortLabel, label: 'partial failure', tone: 'warn' };
      continue;
    }
    output[provider.key] = { key: provider.key, shortLabel: provider.shortLabel, label: latest.result, tone: 'bad' };
  }
  return output;
}

function buildEnrichmentContextItems(statusByProvider: Record<string, ProviderStatus>) {
  const ordered = ['itglue', 'ninjaone', 'sentinelone', 'check_point'];
  return ordered.map((key) => {
    const row = statusByProvider[key];
    if (!row) return { key: key.toUpperCase(), val: 'Unknown' };
    return {
      key: `${row.shortLabel} RO`,
      val: row.label,
      ...(row.tone === 'good'
        ? { highlight: '#1DB98A' }
        : row.tone === 'warn'
          ? { highlight: '#F59E0B' }
          : row.tone === 'bad'
            ? { highlight: '#F87171' }
            : {}),
    };
  });
}

function humanizeWorkflowAuditAction(action?: string): string {
  const raw = String(action || '').trim();
  if (!raw) return 'No workflow audit event yet';

  const direct: Record<string, string> = {
    'workflow.sync.applied': 'Workflow sync applied',
    'workflow.sync.skipped': 'Workflow sync skipped',
    'workflow.reconcile.requested': 'Workflow reconciliation requested',
    'workflow.reconcile.completed': 'Workflow reconciliation completed',
    'workflow.reconcile.failed': 'Workflow reconciliation failed',
  };
  if (direct[raw]) return direct[raw];

  return raw
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeProviderName(providerKey: string): string {
  const map: Record<string, string> = {
    itglue: 'IT Glue (read-only)',
    ninjaone: 'Ninja (read-only)',
    sentinelone: 'SentinelOne (read-only)',
    check_point: 'Check Point (read-only)',
  };
  return map[providerKey] || `${providerKey} (read-only)`;
}

function humanizeProviderStatus(statusLabel?: string): string {
  const raw = String(statusLabel || '').trim().toLowerCase();
  if (!raw) return 'Not available';
  if (raw === 'not loaded') return 'Not loaded yet';
  if (raw === 'read-only ok') return 'Read-only data loaded successfully';
  if (raw === 'partial failure') return 'Partial failure (degraded data)';
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}
