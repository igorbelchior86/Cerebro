'use client';

import { FormEvent, KeyboardEvent, useState } from 'react';
import { useTranslations } from 'next-intl';

interface ChatInputProps {
  onSubmit: (message: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  hints?: string[];
}

export default function ChatInput({
  onSubmit,
  placeholder = 'Refine analysis, ask questions, add context...',
  disabled = false,
  isLoading = false,
  hints,
}: ChatInputProps) {
  const t = useTranslations('ChatInput');
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);

  const activeHints = hints || [
    t('hintReanalyze'),
    t('hintQuestions'),
    t('hintSummarize'),
    t('hintEscalate'),
  ];

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
    <div style={{ padding: '12px', border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', flexShrink: 0 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-panel)', border: `1px solid ${focused ? 'var(--border-accent)' : 'var(--bento-outline)'}`, borderRadius: '11px', padding: '8px 10px 8px 12px', transition: 'var(--transition)' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={disabled ? t('processing') : placeholder}
            disabled={disabled || isLoading}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-dm-sans, sans-serif)', fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          />
          <button type="submit" disabled={!input.trim() || disabled || isLoading}
            style={{ width: '28px', height: '28px', borderRadius: '8px', background: input.trim() && !disabled ? 'var(--accent-muted)' : 'var(--bg-card)', border: `1px solid ${input.trim() && !disabled ? 'var(--border-accent)' : 'var(--bento-outline)'}`, cursor: input.trim() && !disabled ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !input.trim() || disabled ? 0.6 : 1, transition: 'var(--transition)', color: input.trim() && !disabled ? 'var(--accent)' : 'var(--text-muted)' }}
            onMouseEnter={(e) => { if (input.trim() && !disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            onMouseLeave={(e) => { if (input.trim() && !disabled) (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
          >
            {isLoading ? (
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', display: 'inline-block' }} />
            ) : (
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 10L10 6 2 2v3.5l5 .5-5 .5V10z" fill="currentColor" />
              </svg>
            )}
          </button>
        </div>
      </form>
      {activeHints.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
          {activeHints.map((h) => (
            <button key={h} type="button" onClick={() => setInput(h)}
              style={{ padding: '4px 9px', borderRadius: '8px', fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-panel)', border: '1px solid var(--bento-outline)', cursor: 'pointer', fontFamily: 'var(--font-geist-sans, var(--font-dm-sans, sans-serif))', transition: 'var(--transition)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bento-outline)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
            >
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
