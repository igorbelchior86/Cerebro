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
  session: { id: string; ticket_id: string; status: string };
  evidence_pack?: any;
  diagnosis?: unknown;
  validation?: unknown;
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
  const sidebarTicketsRef = useRef<ActiveTicket[]>([]);

  // Add state for real tickets
  const [sidebarTickets, setSidebarTickets] = useState<ActiveTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

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

  const getTicketContextMeta = (ticket?: ActiveTicket) => {
    if (!ticket) return selectedTicketId;
    const parts = [
      ticket.ticket_id || ticket.id,
      ticket.company || ticket.org,
      ticket.requester || ticket.site,
    ].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(' · ') : selectedTicketId;
  };

  useEffect(() => {
    sidebarTicketsRef.current = sidebarTickets;
  }, [sidebarTickets]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await axios.get(`${apiUrl}/playbook/full-flow`, {
          params: { sessionId: selectedTicketId },
          withCredentials: true,
        });

        const flowData = res.data.data;
        const newData = {
          session: { id: selectedTicketId, ticket_id: '', status: 'active' },
          ...flowData,
        };

        setData(newData);
        const currentTicket = sidebarTicketsRef.current.find((t) => t.id === selectedTicketId);
        const ticketId = newData.session.ticket_id || currentTicket?.ticket_id || selectedTicketId;
        const subject = normalizePlainText(cleanTitle(currentTicket?.title), 'Untitled ticket');
        const problemDescription = normalizePlainText(currentTicket?.description, subject);
        const requester = normalizePlainText(currentTicket?.requester || currentTicket?.site, 'Unknown user');
        const org = normalizePlainText(currentTicket?.company || currentTicket?.org, 'Unknown org');
        const site = normalizePlainText(currentTicket?.site, 'Unknown site');
        const priority = currentTicket?.priority || 'P3';
        const priorityLabel = priority === 'P1' ? 'P1 Critical' : priority;
        const firstEventTime = parseDate(currentTicket?.created_at);
        const ts = (offsetSec: number) => new Date(firstEventTime.getTime() + offsetSec * 1000);

        const timeline: Message[] = [
          {
            id: `autotask-${selectedTicketId}`,
            role: 'assistant',
            type: 'autotask',
            timestamp: ts(0),
            content: `New ticket detected: \`${ticketId}\` — "${problemDescription}" from ${requester} at ${org}, ${site}. Priority: **${priorityLabel}**. Starting context collection.`,
          },
        ];

        const pack = newData.evidence_pack;
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
            ? 'Running iterative cross-source correlation (intake → IT Glue → Ninja → history → refine).'
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
        setError(axios.isAxiosError(err) ? err.message : String(err));
        setPlaybookStatus('error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
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
    const fetchTickets = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/email-ingestion/list`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setSidebarTickets(json.data);
        }
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        setIsLoadingTickets(false);
      }
    };

    fetchTickets();
    const interval = setInterval(fetchTickets, 10000);
    return () => clearInterval(interval);
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

  // Ensure current ticket is visible in case it's not in the DB yet, or just display the current DB list
  const currentMock: ActiveTicket | null = data
    ? {
      id: data.session.id,
      ticket_id: data.session.ticket_id || `Ticket-${selectedTicketId.substring(0, 8)}`,
      status: playbookReady ? 'completed' : loading ? 'pending' : 'processing',
    }
    : null;

  const displayTickets = [...sidebarTickets];
  if (currentMock && !displayTickets.find(t => t.id === currentMock.id)) {
    displayTickets.unshift(currentMock);
  }

  const selectedTicket = displayTickets.find((t) => t.id === selectedTicketId);
  const ticketTitle = cleanTitle(selectedTicket?.title) || 'Untitled ticket';
  const ticketNumber = data?.session.ticket_id || selectedTicket?.ticket_id || `Ticket-${selectedTicketId.substring(0, 8)}`;
  const ticketLabel = `${ticketNumber} — ${ticketTitle}`;
  const ticketMetaLabel = getTicketContextMeta(selectedTicket);

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
        />
      }
      mainContent={
        <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-root)', minWidth: 0, height: '100%' }}>
          {/* Header */}
          <div
            className="px-5 py-3 flex items-center gap-3 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}
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
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)', marginLeft: playbookReady ? '0' : 'auto' }}>
              {playbookReady ? '' : loading ? t('statusInitializing') : t('statusProcessing')}
            </span>
          </div>
          <div className="px-5 pb-2" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
            <p style={{ fontFamily: 'var(--font-jetbrains-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ticketMetaLabel}
            </p>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-2">
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
