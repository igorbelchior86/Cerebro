'use client';

import { useState, useRef, useEffect } from 'react';
import ChatSidebar from '@/components/ChatSidebar';
import ChatMessage, { type Message } from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import ResizableLayout from '@/components/ResizableLayout';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Olá! Sou o Playbook Brain. Posso verificar suas integrações, consultar dados do IT Glue, NinjaOne e Autotask, ou ajudar a diagnosticar problemas. Como posso ajudar?',
  timestamp: new Date(),
  type: 'text',
};

const HINTS = [
  'Verificar status das integrações',
  'IT Glue está conectado?',
  'Listar orgs do IT Glue',
  'O que você consegue fazer?',
];

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      sidebarContent={<ChatSidebar tickets={[]} isLoading={false} />}
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
                Assistant
              </span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-2)', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>online</span>
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
                message={{ id: 'typing', role: 'system', content: 'Processando...', type: 'status' }}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput
            onSubmit={handleSend}
            isLoading={isLoading}
            disabled={isLoading}
            placeholder="Pergunte algo sobre suas integrações, tickets ou dispositivos..."
            hints={HINTS}
          />
        </div>
      }
    />
  );
}
