'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import ChatSidebar, { type ActiveTicket } from '@/components/ChatSidebar';
import ChatMessage, { type Message } from '@/components/ChatMessage';
import ChatInput, { type ChatInputSubmitPayload } from '@/components/ChatInput';
import ResizableLayout from '@/components/ResizableLayout';
import { loadTriPaneSidebarTickets } from '@/lib/workflow-sidebar-adapter';

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
    channel: 'internal_ai',
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

  // Fetch canonical sidebar tickets from workflow inbox only (P0 source of truth)
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

    fetchTickets();
    const interval = setInterval(fetchTickets, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleSend = async ({ message: text }: ChatInputSubmitPayload) => {
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      type: 'text',
      channel: 'internal_ai',
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
          channel: 'internal_ai',
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
          channel: 'internal_ai',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResizableLayout
      transparentSidebar={true}
      sidebarContent={<ChatSidebar tickets={sidebarTickets} isLoading={isLoadingTickets} onSelectTicket={(id) => router.push(`/triage/${id}`, { scroll: false })} />}
      mainContent={
        <div className="flex-1 flex flex-col" style={{ background: 'transparent', minWidth: 0, height: '100%', minHeight: 0, padding: '12px', gap: '8px' }}>
          {/* Header */}
          <div
            style={{
              padding: '12px 16px',
              border: '1px solid var(--bento-outline)',
              borderRadius: '16px',
              background: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0,
              boxShadow: 'var(--shadow-card)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--green) 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                boxShadow: '0 2px 8px var(--accent-glow)',
              }}
            >
              ⚡
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Playbook Brain
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('assistant')} • {t('online')}
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--bento-outline)',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  background: 'var(--bg-panel)',
                  fontFamily: 'var(--font-jetbrains-mono)',
                }}
                title="P0 launch policy in-context"
              >
                AT 2W · Others RO
              </div>
              <span
                style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-2)', display: 'inline-block', boxShadow: '0 0 10px var(--accent-2)' }}
                className="animate-pulse"
              />
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              border: '1px solid var(--bento-outline)',
              borderRadius: '14px',
              background: 'var(--bg-card)',
            }}
          >
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Style', value: 'Bento', tone: 'var(--accent)' },
                { label: 'Palette', value: 'Deep', tone: 'var(--text-primary)' },
                { label: 'Mode', value: t('assistant'), tone: 'var(--green)' },
                { label: 'Hints', value: String(HINTS.length), tone: 'var(--text-primary)' },
              ].map((tile) => (
                <div key={tile.label} style={{ border: '1px solid var(--bento-outline)', borderRadius: '12px', background: 'var(--bg-panel)', padding: '10px 11px' }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>{tile.label}</div>
                  <div style={{ fontFamily: 'var(--font-geist-sans, sans-serif)', fontSize: '12px', fontWeight: 600, color: tile.tone }}>{tile.value}</div>
                </div>
              ))}
            </div>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <ChatMessage
                message={{ id: 'typing', role: 'system', content: t('processing'), type: 'status', channel: 'internal_ai' }}
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
            attachmentsEnabled={false}
            targetChannel="internal_ai"
            showChannelToggle={false}
          />
        </div>
      }
    />
  );
}
