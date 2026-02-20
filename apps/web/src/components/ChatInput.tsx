'use client';

import { FormEvent, KeyboardEvent, useState } from 'react';

interface ChatInputProps {
  onSubmit: (message: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  hints?: string[];
}

const DEFAULT_HINTS = [
  'Reanalisar com nova info',
  'Gerar perguntas ao usuário',
  'Resumir para ticket',
  'Escalar para L3',
];

export default function ChatInput({
  onSubmit,
  placeholder = 'Refine analysis, ask questions, add context...',
  disabled = false,
  isLoading = false,
  hints = DEFAULT_HINTS,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled || isLoading) return;
    const msg = input.trim();
    setInput('');
    await onSubmit(msg);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-input)', border: `1px solid ${focused ? 'var(--border-accent)' : 'var(--border)'}`, borderRadius: '9px', padding: '8px 12px', transition: 'var(--transition)' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={disabled ? 'Processing...' : placeholder}
            disabled={disabled || isLoading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-dm-sans, sans-serif)', fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          />
          <button type="submit" disabled={!input.trim() || disabled || isLoading}
            style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--accent)', border: 'none', cursor: input.trim() && !disabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !input.trim() || disabled ? 0.5 : 0.85, transition: 'opacity 0.15s' }}
            onMouseEnter={(e) => { if (input.trim() && !disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { if (input.trim() && !disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          >
            {isLoading ? (
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', display: 'inline-block' }} />
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 10L10 6 2 2v3.5l5 .5-5 .5V10z" fill="white"/>
              </svg>
            )}
          </button>
        </div>
      </form>
      {hints.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', marginTop: '8px', flexWrap: 'wrap' }}>
          {hints.map((h) => (
            <button key={h} type="button" onClick={() => setInput(h)}
              style={{ padding: '3px 9px', borderRadius: '5px', fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans, sans-serif)', transition: 'var(--transition)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
            >
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
