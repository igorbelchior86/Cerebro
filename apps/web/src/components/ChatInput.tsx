'use client';

import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

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

  const applyInlineFormat = (prefix: string, suffix: string = prefix) => {
    const field = inputRef.current;
    if (!field || disabled || isLoading) return;

    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    const selected = input.slice(start, end);
    const replacement = `${prefix}${selected}${suffix}`;
    const next = `${input.slice(0, start)}${replacement}${input.slice(end)}`;

    setInput(next);
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + replacement.length;
      field.setSelectionRange(cursor, cursor);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const field = inputRef.current;
    if (!field || disabled || isLoading) return;

    const start = field.selectionStart ?? 0;
    const next = `${input.slice(0, start)}${prefix}${input.slice(start)}`;
    setInput(next);
    requestAnimationFrame(() => {
      field.focus();
      const cursor = start + prefix.length;
      field.setSelectionRange(cursor, cursor);
    });
  };

  const toolbarButtonStyle: CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    border: '1px solid var(--bento-outline)',
    background: 'var(--bg-panel)',
    color: 'var(--text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.55 : 1,
    transition: 'var(--transition)',
    flexShrink: 0,
  };

  return (
    <div style={{ padding: '12px', border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', flexShrink: 0 }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-panel)', border: `1px solid ${focused ? 'var(--border-accent)' : 'var(--bento-outline)'}`, borderRadius: '11px', padding: '8px 10px 8px 12px', transition: 'var(--transition)' }}>
          <input
            ref={inputRef}
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
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', paddingRight: '2px' }}>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Attachment (coming soon)"
            aria-label="Attachment (coming soon)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M11.8 5.1 7 9.9a2 2 0 0 1-2.8-2.8L9 2.3a3 3 0 1 1 4.2 4.2L7.6 12a4 4 0 1 1-5.7-5.6l5.2-5.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Emoji"
            aria-label="Insert emoji"
            onClick={() => applyInlineFormat('🙂', '')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="5.8" cy="6.5" r="0.7" fill="currentColor" />
              <circle cx="10.2" cy="6.5" r="0.7" fill="currentColor" />
              <path d="M5.2 9.6c.6.9 1.6 1.4 2.8 1.4 1.2 0 2.2-.5 2.8-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <div style={{ width: '1px', height: '18px', background: 'var(--bento-outline)' }} aria-hidden="true" />
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Bold"
            aria-label="Bold"
            onClick={() => applyInlineFormat('**')}
          >
            <span style={{ fontWeight: 700, fontSize: '14px', lineHeight: 1 }}>B</span>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Italic"
            aria-label="Italic"
            onClick={() => applyInlineFormat('*')}
          >
            <span style={{ fontStyle: 'italic', fontSize: '14px', lineHeight: 1 }}>I</span>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Underline"
            aria-label="Underline"
            onClick={() => applyInlineFormat('<u>', '</u>')}
          >
            <span style={{ textDecoration: 'underline', fontSize: '14px', lineHeight: 1 }}>U</span>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Bulleted list"
            aria-label="Bulleted list"
            onClick={() => applyLinePrefix('- ')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="3" cy="4" r="1.2" fill="currentColor" />
              <circle cx="3" cy="8" r="1.2" fill="currentColor" />
              <circle cx="3" cy="12" r="1.2" fill="currentColor" />
              <path d="M6 4h7M6 8h7M6 12h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Numbered list"
            aria-label="Numbered list"
            onClick={() => applyLinePrefix('1. ')}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1.8 4h1.5v3m6.2-3h5m-5 4h5m-5 4h5M2 12h2.2m-2.2-4h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled={disabled || isLoading}
            style={toolbarButtonStyle}
            title="Inline image (coming soon)"
            aria-label="Inline image (coming soon)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2.3" y="3" width="11.4" height="10" rx="1.8" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="6" cy="6.4" r="1.1" fill="currentColor" />
              <path d="m4 11 2.6-2.5L8.7 11l2.1-2 1.2 1.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {activeHints.length > 0 ? activeHints.map((h) => (
          <button key={h} type="button" onClick={() => setInput(h)}
            style={{ padding: '4px 9px', borderRadius: '8px', fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-panel)', border: '1px solid var(--bento-outline)', cursor: 'pointer', fontFamily: 'var(--font-geist-sans, var(--font-dm-sans, sans-serif))', transition: 'var(--transition)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bento-outline)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            {h}
          </button>
        )) : null}
      </div>
    </div>
  );
}
