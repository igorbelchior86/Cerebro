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
  evidence_pack?: unknown;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenState = useRef<{
    hasEvidence?: boolean;
    hasDiagnosis?: boolean;
    hasValidation?: boolean;
    hasPlaybook?: boolean;
  }>({});

  // Add state for real tickets
  const [sidebarTickets, setSidebarTickets] = useState<ActiveTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

        const newMessages: Message[] = [];

        if (newData.evidence_pack && !lastSeenState.current.hasEvidence) {
          newMessages.push({
            id: `msg-evidence-${Date.now()}`,
            role: 'assistant',
            content: t('evidenceCollected'),
            timestamp: new Date(),
            type: 'evidence',
          });
          lastSeenState.current.hasEvidence = true;
        }

        if (newData.diagnosis && !lastSeenState.current.hasDiagnosis) {
          newMessages.push({
            id: `msg-diagnosis-${Date.now()}`,
            role: 'assistant',
            content: t('diagnosisGenerated'),
            timestamp: new Date(),
            type: 'diagnosis',
          });
          lastSeenState.current.hasDiagnosis = true;
        }

        if (newData.validation && !lastSeenState.current.hasValidation) {
          newMessages.push({
            id: `msg-validation-${Date.now()}`,
            role: 'assistant',
            content: t('validationCleared'),
            timestamp: new Date(),
            type: 'validation',
          });
          lastSeenState.current.hasValidation = true;
        }

        if (newData.playbook && !lastSeenState.current.hasPlaybook) {
          newMessages.push({
            id: `msg-playbook-${Date.now()}`,
            role: 'assistant',
            content: t('playbookReady'),
            timestamp: new Date(),
            type: 'text',
          });
          lastSeenState.current.hasPlaybook = true;
          setPlaybookReady(true);
        }

        if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
        }
      } catch (err) {
        setError(axios.isAxiosError(err) ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [selectedTicketId]);

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

  const ticketLabel = data?.session.ticket_id || `Ticket-${selectedTicketId.substring(0, 8)}`;

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
        playbookReady ? (
          <PlaybookPanel
            content={data?.playbook?.content_md || null}
            status={playbookStatus}
          />
        ) : undefined
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
            <p style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1 }}>
              {ticketLabel}
            </p>
            {playbookReady && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-muted)', border: '1px solid var(--green-border)' }}>
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {t('statusPlaybookReady')}
              </span>
            )}
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono)', marginLeft: playbookReady ? '0' : 'auto' }}>
              {playbookReady ? '' : loading ? t('statusInitializing') : t('statusProcessing')}
            </span>
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

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <ChatInput
            onSubmit={handleSendMessage}
            placeholder={t('placeholder')}
            disabled={loading}
            isLoading={false}
          />
        </div>
      }
    />
  );
}
