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
import { usePollingResource } from '@/hooks/usePollingResource';
import {
  type AutotaskCompanyOption,
  type AutotaskContactOption,
  type AutotaskResourceOption,
  getWorkflowCommandStatus,
  isRetryableCommandStatus,
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
    created_at?: string;
    priority?: string;
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

type EditableContextKey = 'Org' | 'User' | 'Tech';

interface ContextOverrideState {
  org?: { id?: number; name: string };
  user?: { id?: number; name: string; companyId?: number };
  tech?: { id?: number; name: string };
}

type ContextEditorOption = { id: number; label: string; sublabel?: string };

export default function SessionDetail({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations('ChatSession');
  const pathname = usePathname();
  const [selectedTicketId, setSelectedTicketId] = useState(params.id);
  const [data, setData] = useState<SessionData | null>(null);
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
  const [resolvedOrgIdFallback, setResolvedOrgIdFallback] = useState<number | null>(null);

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
        const signature = JSON.stringify(
          timeline.map((m) => ({
            id: m.id,
            type: m.type,
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
  const ticketMetaLabel = [
    canonicalCompanyUi,
    canonicalRequesterUi,
  ].filter(Boolean).join(' · ') || getTicketContextMeta(selectedTicketView);

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

      return changed ? next : prev;
    });
  }, [data?.ticket?.company_id, data?.ticket?.contact_id, data?.ticket?.assigned_resource_id]);

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
    if (key !== 'Org' && key !== 'User' && key !== 'Tech') return;
    setActiveContextEditor(key);
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

      // Optimistic local selection guarantees User->Org dependency immediately.
      applyOrgSelection(option.id, option.label);
      setContextEditorSaving(true);
      setContextEditorError('');
      try {
        const updated = await updateAutotaskTicketContext(ticketRef, { companyId: option.id });
        const resolvedCompanyId = toAutotaskId(updated.companyId) ?? option.id;
        applyOrgSelection(resolvedCompanyId, updated.companyName || option.label);
      } catch (err: any) {
        // Keep local Org selection so user can continue to User selection flow.
        setWorkflowActionError(
          `Org selected locally. Autotask write pending/failed: ${String(err?.message || 'Unable to update Org in Autotask')}`
        );
      } finally {
        closeContextEditor();
      }
      return;
    }
    if (activeContextEditor === 'User') {
      if (activeOrgId === null) {
        setContextEditorError('Select an Org first to set User.');
        return;
      }
      setContextEditorSaving(true);
      setContextEditorError('');
      try {
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
        closeContextEditor();
      } catch (err: any) {
        setContextEditorError(String(err?.message || 'Unable to update User in Autotask'));
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

  useEffect(() => {
    if (!activeContextEditor) return;
    if (activeContextEditor === 'User' && activeOrgId === null) {
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
        setContextEditorError('Select an Org first to list User options.');
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
            setContextEditorError('Select an Org first to list User options.');
          }
        } catch (err: any) {
          if (!ignoreResolve) {
            setContextEditorOptions([]);
            setContextEditorError(String(err?.message || 'Unable to resolve Org before listing users'));
          }
        } finally {
          if (!ignoreResolve) setContextEditorLoading(false);
        }
      })();
      return () => {
        ignoreResolve = true;
      };
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
        if (activeContextEditor === 'User' && activeOrgId !== null) {
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
  }, [activeContextEditor, activeOrgId, contextEditorQuery]);

  const digestFacts = Array.isArray(data?.evidence_pack?.evidence_digest?.facts_confirmed)
    ? data?.evidence_pack?.evidence_digest?.facts_confirmed
    : [];
  const digestFactMap = new Map<string, string>(
    digestFacts.map((f: any) => [String(f?.id || ''), String(f?.fact || '').trim()])
  );
  const normalizeFact = (value: string) => value.replace(/\s+/g, ' ').trim();
  const parsedPlaybookChecklist = parseChecklistFromPlaybook(data?.playbook?.content_md || undefined);
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
          key: 'User',
          val: contextOverrides.user?.name || normalizePlainText(
            selectUiUserFromSsot({
              affected: data?.ssot?.affected_user_name,
              requester: data?.ssot?.requester_name,
              fallbacks: [selectedTicketView?.requester],
            }),
            'Unknown user'
          ),
          editable: true,
        },
        {
          key: 'Tech',
          val: contextOverrides.tech?.name || normalizePlainText(data?.ticket?.assigned_resource_name, 'Unknown'),
          editable: true,
        },
        {
          key: 'ISP',
          val: data?.ssot?.isp_name || data.evidence_pack?.external_status?.[0]?.provider || 'Unknown',
          ...(data.evidence_pack?.external_status?.[0]?.status ? { highlight: '#F97316' } : {}),
        },
        { key: 'Firewall', val: data?.ssot?.firewall_make_model || data.evidence_pack?.config?.firewall || 'Unknown' },
        { key: 'WiFi', val: data?.ssot?.wifi_make_model || 'Unknown' },
        { key: 'Switch', val: data?.ssot?.switch_make_model || 'Unknown' },
        { key: 'User device', val: data?.ssot?.device_name || data.evidence_pack?.device?.hostname || 'Unknown' },
        {
          key: 'Phone Provider',
          val: data?.ssot?.phone_provider_name || 'Unknown',
        },
        {
          key: 'History',
          val: `${Number(data?.ticket_context_appendix?.history_correlation?.matched_case_count || 0)} matches`,
          ...(Number(data?.ticket_context_appendix?.history_correlation?.matched_case_count || 0) > 0
            ? { highlight: '#5B7FFF' }
            : {}),
        },
        {
          key: 'Refinement',
          val: `${Array.isArray(data?.ticket_context_appendix?.final_refinement?.fields_updated) ? data.ticket_context_appendix?.final_refinement?.fields_updated?.length || 0 : 0} fields`,
          ...(Array.isArray(data?.ticket_context_appendix?.final_refinement?.fields_updated) &&
            (data.ticket_context_appendix?.final_refinement?.fields_updated?.length || 0) > 0
            ? { highlight: '#1DB98A' }
            : {}),
        },
      ],
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

  return (
    <ResizableLayout
      transparentSidebar={true}
      sidebarContent={
        <ChatSidebar
          tickets={displayTickets}
          currentTicketId={selectedTicketId}
          isLoading={isLoadingTickets || loading}
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
          <div style={{ border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', overflow: 'hidden', flexShrink: 0 }}>
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
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4.5px',
                padding: '3px 8px',
                borderRadius: '8px',
                fontSize: '10.5px',
                fontWeight: 600,
                color: 'var(--green)',
                background: 'rgba(29,185,138,0.08)',
                border: '1px solid rgba(29,185,138,0.2)',
                visibility: playbookReady ? 'visible' : 'hidden',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t('statusPlaybookReady')}
              </span>
              <button
                onClick={handleToggleManualSuppression}
                aria-pressed={isManualSuppressed}
                disabled={isManualSuppressionSaving}
                title={isManualSuppressed ? 'Remove manual suppression' : 'Add ticket to suppressed'}
                aria-label={isManualSuppressed ? 'Remove manual suppression' : 'Add ticket to suppressed'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  color: isManualSuppressed ? '#F59E0B' : 'var(--text-muted)',
                  background: isManualSuppressed
                    ? 'rgba(245,158,11,0.08)'
                    : 'var(--bg-card)',
                  border: isManualSuppressed ? '1px solid rgba(245,158,11,0.30)' : '1px solid var(--bento-outline)',
                  boxShadow: isManualSuppressed ? '0 2px 8px rgba(245,158,11,0.1)' : 'none',
                  cursor: isManualSuppressionSaving ? 'not-allowed' : 'pointer',
                  opacity: isManualSuppressionSaving ? 0.7 : 1,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  if (isManualSuppressionSaving) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.transform = 'translateY(-1px)';
                  if (!isManualSuppressed) {
                    el.style.borderColor = 'var(--accent)';
                    el.style.color = 'var(--accent)';
                    el.style.background = 'rgba(91,127,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isManualSuppressionSaving) return;
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.transform = 'translateY(0)';
                  if (!isManualSuppressed) {
                    el.style.borderColor = 'var(--bento-outline)';
                    el.style.color = 'var(--text-muted)';
                    el.style.background = 'var(--bg-card)';
                  }
                }}
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 13L13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <button
                onClick={handleReconcileWorkflowTicket}
                disabled={isWorkflowReconcileRunning || !ticketNumber}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  color: isWorkflowReconcileRunning ? '#EAB308' : '#5B7FFF',
                  background: isWorkflowReconcileRunning ? 'rgba(234,179,8,0.10)' : 'rgba(91,127,255,0.05)',
                  border: isWorkflowReconcileRunning ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(91,127,255,0.20)',
                  cursor: isWorkflowReconcileRunning ? 'not-allowed' : 'pointer',
                  opacity: isWorkflowReconcileRunning ? 0.8 : 1,
                  transition: 'all 0.2s ease',
                }}
                title="Reconcile workflow ticket (Autotask snapshot vs workflow projection)"
                aria-label="Reconcile workflow ticket"
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10a6 6 0 0 1 10.2-4.2L16 7.7M16 10a6 6 0 0 1-10.2 4.2L4 12.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M16 4.5v3.2h-3.2M4 15.5v-3.2h3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={handleRefreshPipeline}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '30px',
                  height: '30px',
                  borderRadius: '10px',
                  color: loading ? 'var(--text-muted)' : 'var(--accent)',
                  background: loading ? 'var(--bg-card)' : 'rgba(91,127,255,0.07)',
                  border: loading ? '1px solid var(--bento-outline)' : '1px solid rgba(91,127,255,0.20)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  if (loading) return;
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,127,255,0.12)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(91,127,255,0.30)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  if (loading) return;
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(91,127,255,0.07)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(91,127,255,0.20)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }}
                title="Hard refresh pipeline"
                aria-label="Hard refresh pipeline"
              >
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                  <path d="M15.5 10C15.5 13.0376 13.0376 15.5 10 15.5C6.96243 15.5 4.5 13.0376 4.5 10C4.5 6.96243 6.96243 4.5 10 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <path d="M9.5 7L12 4.5L9.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)', marginLeft: playbookReady ? '0' : 'auto' }}>
                {playbookReady ? '' : loading ? t('statusInitializing') : t('statusProcessing')}
              </span>
            </div>
            <div className="px-4 py-2" style={{ background: 'transparent' }}>
              <p style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ticketMetaLabel}
              </p>
            </div>
          </div>

          {/* Messages Container */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
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
                    border: '1px solid var(--bento-outline)',
                    background: channelFilter === opt.key ? 'rgba(91,127,255,0.10)' : 'var(--bg-panel)',
                    color: channelFilter === opt.key ? 'var(--accent)' : 'var(--text-muted)',
                    padding: '3px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
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

            {visibleMessages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onRetryExternalMessage={handleRetryExternalMessage} />
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
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 70,
                background: 'rgba(9,12,20,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
              }}
              onClick={closeContextEditor}
            >
              <div
                style={{
                  width: 'min(560px, 100%)',
                  maxHeight: 'min(80vh, 760px)',
                  overflowY: 'auto',
                  borderRadius: '14px',
                  border: '1px solid var(--bento-outline)',
                  background: 'var(--bg-card)',
                  boxShadow: '0 22px 48px rgba(10,18,35,0.28)',
                  padding: '14px',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit {activeContextEditor}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {activeContextEditor === 'User'
                        ? activeOrgId !== null
                          ? `Listing users only from selected Org (ID ${activeOrgId}).`
                          : 'Select an Org first to list users.'
                        : 'Source: Autotask read-only search.'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeContextEditor}
                    disabled={contextEditorSaving}
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      border: '1px solid var(--bento-outline)',
                      background: 'var(--bg-panel)',
                      color: 'var(--text-secondary)',
                      cursor: contextEditorSaving ? 'not-allowed' : 'pointer',
                      opacity: contextEditorSaving ? 0.6 : 1,
                    }}
                    aria-label="Close editor"
                  >
                    ×
                  </button>
                </div>

                <input
                  type="text"
                  value={contextEditorQuery}
                  onChange={(e) => setContextEditorQuery(e.target.value)}
                  disabled={contextEditorSaving}
                  placeholder={`Search ${activeContextEditor.toLowerCase()} in Autotask`}
                  style={{
                    width: '100%',
                    borderRadius: '10px',
                    border: '1px solid var(--bento-outline)',
                    background: 'var(--bg-panel)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    padding: '9px 10px',
                    marginBottom: '10px',
                  }}
                />

                {contextEditorError ? (
                  <div style={{ fontSize: '11.5px', color: '#ef4444', marginBottom: '8px' }}>
                    {contextEditorError}
                  </div>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {contextEditorSaving ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Saving update...</div>
                  ) : contextEditorLoading ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Loading options...</div>
                  ) : contextEditorOptions.length === 0 ? (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>No options found.</div>
                  ) : (
                    contextEditorOptions.map((option) => (
                      <button
                        key={`${activeContextEditor}-${option.id}`}
                        type="button"
                        onClick={() => { void handleSelectContextOption(option); }}
                        disabled={contextEditorSaving}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          borderRadius: '10px',
                          border: '1px solid var(--bento-outline)',
                          background: 'var(--bg-panel)',
                          color: 'var(--text-primary)',
                          padding: '9px 10px',
                          cursor: contextEditorSaving ? 'not-allowed' : 'pointer',
                          opacity: contextEditorSaving ? 0.65 : 1,
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{option.label}</div>
                        {option.sublabel ? (
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{option.sublabel}</div>
                        ) : null}
                      </button>
                    ))
                  )}
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
