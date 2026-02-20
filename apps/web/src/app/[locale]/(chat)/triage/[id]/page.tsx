'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import axios from 'axios';
import ChatSidebar, { ActiveTicket } from '@/components/ChatSidebar';
import ChatMessage, { Message } from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import PlaybookPanel from '@/components/PlaybookPanel';

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
          params: { sessionId: params.id },
          withCredentials: true,
        });

        const flowData = res.data.data;
        const newData = {
          session: { id: params.id, ticket_id: '', status: 'active' },
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
  }, [params.id]);

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

  const mockTickets: ActiveTicket[] = data
    ? [
      {
        id: data.session.id,
        ticket_id:
          data.session.ticket_id || `Ticket-${params.id.substring(0, 8)}`,
        status:
          playbookReady ? 'completed'
            : loading ? 'pending'
              : 'processing',
      },
    ]
    : [];

  const ticketLabel = data?.session.ticket_id || `Ticket-${params.id.substring(0, 8)}`;

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-root)' }}>
      {/* Sidebar */}
      <ChatSidebar
        tickets={mockTickets}
        currentTicketId={params.id}
        isLoading={loading}
      />

      {/* Chat Area */}
      <div
        className="flex flex-col flex-1"
        style={{ background: 'var(--bg-chat)', minWidth: 0 }}
      >
        {/* Chat header */}
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

      {/* Playbook Panel — slides in from right when ready */}
      {playbookReady && (
        <PlaybookPanel
          content={data?.playbook?.content_md || null}
          status={playbookStatus}
        />
      )}
    </div>
  );
}
