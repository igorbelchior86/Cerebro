'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import ChatSidebar, { ActiveTicket } from '@/components/ChatSidebar';
import ChatMessage, { Message } from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import PlaybookPanel from '@/components/PlaybookPanel';
import ResizableLayout from '@/components/ResizableLayout';
import { usePathname } from 'next/navigation';

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
    },
  ]);
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
        });

        if (newData.diagnosis) {
          timeline.push({
            id: `diagnosis-${selectedTicketId}`,
            role: 'assistant',
            type: 'diagnosis',
            timestamp: ts(3),
            content: 'Evidence pack processed. Ranked hypotheses generated with supporting citations.',
          });
        }

        if (newData.validation) {
          timeline.push({
            id: `validation-${selectedTicketId}`,
            role: 'assistant',
            type: 'validation',
            timestamp: ts(4),
            content: 'Validation completed with evidence checks and safety gates.',
          });
        }

        if (newData.playbook) {
          timeline.push({
            id: `playbook-${selectedTicketId}`,
            role: 'assistant',
            type: 'text',
            timestamp: ts(5),
            content: 'Playbook generated. Review and refine using the right panel.',
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
      },
    ]);
  }, [selectedTicketId, t]);

  // Fetch tickets from email ingestion processed tickets table
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const fetchTickets = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/email-ingestion/list`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (!cancelled && json.success && Array.isArray(json.data)) {
            setSidebarTickets(json.data as ActiveTicket[]);
          }
        }
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

  const handleSendMessage = (message: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date(),
        type: 'text',
      },
    ]);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-auto-${Date.now()}`,
          role: 'assistant',
          content: t('processingRequest'),
          timestamp: new Date(),
          type: 'text',
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

  const handleToggleManualSuppression = async () => {
    const ticketId = String(data?.session.ticket_id || selectedTicketId || '').trim();
    if (!ticketId || isManualSuppressionSaving) return;
    setIsManualSuppressionSaving(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/email-ingestion/tickets/${encodeURIComponent(ticketId)}/manual-suppression`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suppressed: !isManualSuppressed }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String((payload as any)?.error || `HTTP ${res.status}`));
      }
      const nextManualSuppressed = Boolean((payload as any)?.manual_suppressed);
      setIsManualSuppressed(nextManualSuppressed);
      setSidebarTickets((prev) => prev.map((ticket) => {
        const currentId = String(ticket.ticket_id || ticket.id || '');
        if (currentId !== ticketId) return ticket;
        const autoSuppressed = ticket.suppression_reason !== 'manual_override' ? Boolean(ticket.suppressed) : false;
        return {
          ...ticket,
          manual_suppressed: nextManualSuppressed,
          suppressed: nextManualSuppressed || autoSuppressed,
          suppression_reason: nextManualSuppressed
            ? String((payload as any)?.suppression_reason || 'manual_override')
            : (autoSuppressed ? ticket.suppression_reason ?? null : null),
          suppression_reason_label: nextManualSuppressed
            ? String((payload as any)?.suppression_reason_label || 'Manual suppression')
            : (autoSuppressed ? ticket.suppression_reason_label ?? null : null),
          suppression_confidence: nextManualSuppressed
            ? null
            : (autoSuppressed ? ticket.suppression_confidence ?? null : null),
        };
      }));
    } catch (err) {
      console.error('Failed to update manual suppression', err);
      setError((err as Error)?.message || 'Failed to update suppression');
    } finally {
      setIsManualSuppressionSaving(false);
    }
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
    ticketNumber,
    canonicalCompanyUi,
    canonicalRequesterUi,
  ].filter(Boolean).join(' · ') || getTicketContextMeta(selectedTicketView);
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
        { key: 'Org', val: data?.ssot?.company || selectedTicketView?.company || selectedTicketView?.org || 'Unknown org' },
        {
          key: 'User',
          val: normalizePlainText(
            selectUiUserFromSsot({
              affected: data?.ssot?.affected_user_name,
              requester: data?.ssot?.requester_name,
              fallbacks: [selectedTicketView?.requester],
            }),
            'Unknown user'
          ),
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

  return (
    <ResizableLayout
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
          {...(playbookPanelData ? { data: playbookPanelData } : {})}
        />
      }
      mainContent={
        <div className="flex-1 flex flex-col" style={{ background: 'transparent', minWidth: 0, height: '100%', minHeight: 0, padding: '10px', gap: '8px' }}>
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-muted)', border: '1px solid var(--green-border)', visibility: playbookReady ? 'visible' : 'hidden' }}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
                width: '28px',
                height: '28px',
                borderRadius: '9px',
                color: isManualSuppressed ? '#F59E0B' : 'var(--text-muted)',
                background: isManualSuppressed
                  ? 'linear-gradient(180deg, rgba(245,158,11,0.14), rgba(245,158,11,0.08))'
                  : 'var(--bg-card)',
                border: isManualSuppressed ? '1px solid rgba(245,158,11,0.30)' : '1px solid var(--border)',
                boxShadow: isManualSuppressed ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
                cursor: isManualSuppressionSaving ? 'not-allowed' : 'pointer',
                opacity: isManualSuppressionSaving ? 0.7 : 1,
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => {
                if (isManualSuppressionSaving) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(-1px)';
                if (!isManualSuppressed) {
                  el.style.borderColor = 'rgba(245,158,11,0.24)';
                  el.style.color = '#F59E0B';
                  el.style.background = 'rgba(245,158,11,0.06)';
                }
              }}
              onMouseLeave={(e) => {
                if (isManualSuppressionSaving) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.transform = 'translateY(0)';
                if (!isManualSuppressed) {
                  el.style.borderColor = 'var(--border)';
                  el.style.color = 'var(--text-muted)';
                  el.style.background = 'var(--bg-card)';
                }
              }}
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3.8 10a6.2 6.2 0 0 1 10.4-4.5L16.6 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16.2 10a6.2 6.2 0 0 1-10.4 4.5L3.4 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.8 7.2l-5.6 5.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
              <button
              onClick={handleRefreshPipeline}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '9px',
                color: loading ? 'var(--text-muted)' : 'var(--accent)',
                background: loading ? 'var(--bg-card)' : 'linear-gradient(180deg, rgba(91,127,255,0.12), rgba(91,127,255,0.07))',
                border: loading ? '1px solid var(--border)' : '1px solid rgba(91,127,255,0.26)',
                boxShadow: loading ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => {
                if (loading) return;
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, rgba(91,127,255,0.16), rgba(91,127,255,0.10))';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(91,127,255,0.36)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                if (loading) return;
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(180deg, rgba(91,127,255,0.12), rgba(91,127,255,0.07))';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(91,127,255,0.26)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }}
              title="Hard refresh pipeline"
              aria-label="Hard refresh pipeline"
            >
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M16.2 6.6A6.9 6.9 0 0 0 4.9 4.9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.9 4.9V2.7M4.9 4.9h2.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.8 13.4A6.9 6.9 0 0 0 15.1 15.1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15.1 15.1v2.2m0-2.2h-2.2"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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

            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
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
            hints={[
              'Reanalyze with new info',
              'Generate user questions',
              'Summarize for ticket',
              'Escalate to L3',
            ]}
          />
        </div>
      }
    />
  );
}
