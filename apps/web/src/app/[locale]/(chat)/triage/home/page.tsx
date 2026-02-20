'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ChatSidebar, { type ActiveTicket } from '@/components/ChatSidebar';
import ChatMessage, { type Message } from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ResizableLayout from '@/components/ResizableLayout';

import { useRouter } from '@/i18n/routing';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
  const t = useTranslations('ChatHome');
  const router = useRouter();

  const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: t('welcome'),
    timestamp: new Date(),
    type: 'text',
  };

  const HINTS = [
    t('hintStatus'),
    t('hintItGlue'),
    t('hintOrgs'),
    t('hintWhatCanYouDo'),
  ];

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);

  // Custom states for tickets from backend
  const [sidebarTickets, setSidebarTickets] = useState<ActiveTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch tickets from email ingestion processed tickets table
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch(`${API}/email-ingestion/list`);
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
    const interval = setInterval(fetchTickets, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSend = async (text: string) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text',
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Build history excluding welcome message
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { reply: string };

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
          type: 'text',
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Erro: ${(err as Error).message}`,
          timestamp: new Date(),
          type: 'text',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResizableLayout
      sidebarContent={<ChatSidebar tickets={sidebarTickets} isLoading={isLoadingTickets} onSelectTicket={(id) => router.push(`/triage/${id}`)} />}
      mainContent={
        <div className="flex-1 flex flex-col" style={{ background: 'var(--bg-root)', minWidth: 0, height: '100%' }}>
          {/* Header */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '28px', height: '28px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #5B7FFF 0%, #1DB98A 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
              }}
            >
              ⚡
            </div>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Playbook Brain
              </span>
              <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-muted)' }}>
                {t('assistant')}
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-2)', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{t('online')}</span>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 20px 8px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <ChatMessage
                message={{ id: 'typing', role: 'system', content: t('processing'), type: 'status' }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput
            onSubmit={handleSend}
            isLoading={isLoading}
            disabled={isLoading}
            placeholder={t('placeholder')}
            hints={HINTS}
          />
        </div>
      }
    />
  );
}
