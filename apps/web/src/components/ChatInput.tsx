'use client';

import { FormEvent, KeyboardEvent, type ChangeEvent, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';

export interface ChatInputAttachmentDraft {
  id: string;
  file: File;
  name: string;
  mimeType: string;
  size: number;
  extension: string;
  kind: 'image' | 'document';
  previewUrl?: string;
}

export interface ChatInputSubmitPayload {
  message: string;
  attachments: ChatInputAttachmentDraft[];
  targetChannel: 'internal_ai' | 'external_psa_user';
}

interface ChatInputProps {
  onSubmit: (payload: ChatInputSubmitPayload) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  hints?: string[];
  attachmentsEnabled?: boolean;
  targetChannel?: 'internal_ai' | 'external_psa_user';
  onTargetChannelChange?: (channel: 'internal_ai' | 'external_psa_user') => void;
  showChannelToggle?: boolean;
}

function inferExtension(name: string, mimeType: string): string {
  const byName = String(name || '').split('.').pop()?.trim().toUpperCase();
  if (byName) return byName;
  const byType = String(mimeType || '').split('/').pop()?.trim().toUpperCase();
  return byType || 'FILE';
}

export default function ChatInput({
  onSubmit,
  placeholder = 'Refine analysis, ask questions, add context...',
  disabled = false,
  isLoading = false,
  hints,
  attachmentsEnabled = false,
  targetChannel = 'internal_ai',
  onTargetChannelChange,
  showChannelToggle = true,
}: ChatInputProps) {
  const t = useTranslations('ChatInput');
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [attachments, setAttachments] = useState<ChatInputAttachmentDraft[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const INPUT_LINE_HEIGHT_PX = 18;
  const INPUT_MAX_LINES = 5;

  const activeHints = hints || [
    t('hintReanalyze'),
    t('hintQuestions'),
    t('hintSummarize'),
    t('hintEscalate'),
  ];
  const channelPlaceholder = targetChannel === 'external_psa_user'
    ? 'Send update to user via PSA...'
    : 'Refine analysis with AI...';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const message = input.trim();
    if ((!message && attachments.length === 0) || disabled || isLoading) return;

    const payload: ChatInputSubmitPayload = {
      message,
      attachments,
      targetChannel,
    };

    setInput('');
    setAttachments([]);
    await onSubmit(payload);
  };

  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    const maxHeight = INPUT_LINE_HEIGHT_PX * INPUT_MAX_LINES;
    const nextHeight = Math.min(field.scrollHeight, maxHeight);
    field.style.height = `${nextHeight}px`;
    field.style.overflowY = field.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [input, INPUT_LINE_HEIGHT_PX, INPUT_MAX_LINES]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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

  const handlePickFiles = () => {
    if (!attachmentsEnabled || disabled || isLoading) return;
    fileInputRef.current?.click();
  };

  const onFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const mapped = files.map((file): ChatInputAttachmentDraft => {
      const mimeType = String(file.type || 'application/octet-stream').trim();
      const isImage = mimeType.startsWith('image/');
      return {
        id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        mimeType,
        size: file.size,
        extension: inferExtension(file.name, mimeType),
        kind: isImage ? 'image' : 'document',
        ...(isImage ? { previewUrl: URL.createObjectURL(file) } : {}),
      };
    });

    setAttachments((prev) => [...prev, ...mapped]);
    event.currentTarget.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
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
    transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
    flexShrink: 0,
  };

  const handleToolbarMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !isLoading) {
      e.currentTarget.style.borderColor = 'var(--border-accent)';
      e.currentTarget.style.background = 'var(--bg-card-hover)';
      e.currentTarget.style.boxShadow = '0 6px 12px rgba(20,24,38,0.12)';
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.color = 'var(--accent)';
    }
  };

  const handleToolbarMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !isLoading) {
      e.currentTarget.style.borderColor = 'var(--bento-outline)';
      e.currentTarget.style.background = 'var(--bg-panel)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.color = 'var(--text-muted)';
    }
  };
  const destinationPillLabel = targetChannel === 'internal_ai' ? 'AI' : 'User';
  const destinationPillStyle: CSSProperties = {
    border: '1px solid',
    borderColor: targetChannel === 'internal_ai' ? 'rgba(91,127,255,0.30)' : 'rgba(16,185,129,0.35)',
    borderRadius: '999px',
    width: '52px',
    height: '24px',
    padding: '0',
    fontSize: '10px',
    fontWeight: 700,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: targetChannel === 'internal_ai' ? 'var(--accent)' : '#047857',
    background: targetChannel === 'internal_ai' ? 'rgba(91,127,255,0.10)' : 'rgba(16,185,129,0.12)',
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.6 : 1,
    flexShrink: 0,
  };

  return (
    <div style={{ padding: '12px', border: '1px solid var(--bento-outline)', borderRadius: '14px', background: 'var(--bg-card)', flexShrink: 0 }}>
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={onFilesSelected} />
      {activeHints.length > 0 ? (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '-19px', marginBottom: '10px', padding: '0 8px' }}>
          {activeHints.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setInput(h)}
              style={{
                padding: '4px 10px 5px',
                borderRadius: '10px 10px 0 0',
                fontSize: '10.5px',
                color: 'var(--text-muted)',
                background: 'var(--bg-card)',
                border: '1px solid var(--bento-outline)',
                borderBottom: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-geist-sans, var(--font-dm-sans, sans-serif))',
                transition: 'var(--transition)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bento-outline)';
              }}
            >
              {h}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-panel)', border: `1px solid ${focused ? 'var(--border-accent)' : 'var(--bento-outline)'}`, borderRadius: '11px', padding: '8px 10px 8px 12px', transition: 'var(--transition)' }}>
          {showChannelToggle ? (
            <button
              type="button"
              onClick={() => {
                if (disabled || isLoading) return;
                onTargetChannelChange?.(targetChannel === 'internal_ai' ? 'external_psa_user' : 'internal_ai');
              }}
              title={`Destination: ${destinationPillLabel} (click to toggle)`}
              aria-label={`Destination: ${destinationPillLabel} (click to toggle)`}
              style={{
                ...destinationPillStyle,
                transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(20,24,38,0.15)';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !isLoading) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = targetChannel === 'internal_ai' ? 'rgba(91,127,255,0.30)' : 'rgba(16,185,129,0.35)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                }
              }}
            >
              {destinationPillLabel}
            </button>
          ) : null}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={disabled ? t('processing') : channelPlaceholder}
            disabled={disabled || isLoading}
            rows={1}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontFamily: 'var(--font-dm-sans, sans-serif)', fontSize: '12.5px', color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: `${INPUT_LINE_HEIGHT_PX}px`, resize: 'none' }}
          />
          <button type="submit" disabled={(!input.trim() && attachments.length === 0) || disabled || isLoading}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '8px',
              background: (input.trim() || attachments.length > 0) && !disabled ? 'var(--accent-muted)' : 'var(--bg-card)',
              border: `1px solid ${(input.trim() || attachments.length > 0) && !disabled ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
              cursor: (input.trim() || attachments.length > 0) && !disabled ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              flexShrink: 0,
              opacity: (!input.trim() && attachments.length === 0) || disabled ? 0.6 : 1,
              transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
              color: (input.trim() || attachments.length > 0) && !disabled ? 'var(--accent)' : 'var(--text-muted)'
            }}
            onMouseEnter={(e) => {
              if ((input.trim() || attachments.length > 0) && !disabled && !isLoading) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 16px rgba(20,24,38,0.15)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
              }
            }}
            onMouseLeave={(e) => {
              if ((input.trim() || attachments.length > 0) && !disabled && !isLoading) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-muted)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-accent)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              } else {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bento-outline)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              }
            }}
            title="Send (Enter)"
            aria-label="Send (Enter)"
          >
            {isLoading ? (
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', display: 'inline-block' }} />
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 10L10 6 2 2v3.5l5 .5-5 .5V10z" fill="currentColor" />
                </svg>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-jetbrains-mono, monospace)', opacity: 0.9 }}>↵</span>
              </>
            )}
          </button>
        </div>
      </form>

      {attachments.length > 0 ? (
        <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
          {attachments.map((attachment) => (
            <div key={attachment.id} style={{ border: '1px solid var(--bento-outline)', borderRadius: '9px', background: 'var(--bg-panel)', padding: '7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {attachment.kind === 'image' && attachment.previewUrl ? (
                  <img src={attachment.previewUrl} alt={attachment.name} style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--bento-outline)' }} />
                ) : (
                  <div style={{ width: '34px', height: '34px', borderRadius: '6px', border: '1px solid var(--bento-outline)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
                    {attachment.extension}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>{attachment.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{attachment.extension}</div>
                </div>
              </div>
              <button type="button" onClick={() => removeAttachment(attachment.id)} style={{ width: '22px', height: '22px', borderRadius: '6px', border: '1px solid var(--bento-outline)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }} aria-label={`Remove ${attachment.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', paddingRight: '2px' }}>
          <button
            type="button"
            disabled={!attachmentsEnabled || disabled || isLoading}
            style={{
              ...toolbarButtonStyle,
              ...(attachmentsEnabled ? {} : { opacity: 0.45, cursor: 'not-allowed' }),
            }}
            title={attachmentsEnabled ? 'Attach files' : 'Attachments unavailable in this context'}
            aria-label="Attach files"
            onClick={handlePickFiles}
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
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
            onMouseEnter={handleToolbarMouseEnter}
            onMouseLeave={handleToolbarMouseLeave}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1.8 4h1.5v3m6.2-3h5m-5 4h5m-5 4h5M2 12h2.2m-2.2-4h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
