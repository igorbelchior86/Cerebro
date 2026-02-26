'use client';

import type { ReactNode } from 'react';

export function P0PageShell({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border p-4 md:p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section
      className="rounded-2xl border p-4"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {subtitle ? <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  const toneStyles: Record<'neutral' | 'good' | 'warn' | 'bad' | 'info', { color: string; bg: string; border: string }> = {
    neutral: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--border-subtle)' },
    good: { color: '#21c58e', bg: 'rgba(33,197,142,0.10)', border: 'rgba(33,197,142,0.25)' },
    warn: { color: '#f0b429', bg: 'rgba(240,180,41,0.10)', border: 'rgba(240,180,41,0.28)' },
    bad: { color: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.28)' },
    info: { color: '#7aa2ff', bg: 'rgba(122,162,255,0.10)', border: 'rgba(122,162,255,0.25)' },
  };
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {children}
    </span>
  );
}

export function InlineButton({
  children,
  onClick,
  disabled,
  kind = 'secondary',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: 'secondary' | 'primary' | 'danger';
}) {
  const styleByKind: Record<'secondary' | 'primary' | 'danger', { color: string; bg: string; border: string }> = {
    secondary: { color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.03)', border: 'var(--border-subtle)' },
    primary: { color: '#dfe8ff', bg: 'rgba(91,127,255,0.14)', border: 'rgba(91,127,255,0.3)' },
    danger: { color: '#fecaca', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  };
  const s = styleByKind[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div
      className="rounded-xl border p-4 text-sm"
      style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)' }}
    >
      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{title}</div>
      <div className="mt-1">{detail}</div>
    </div>
  );
}

export function ErrorBanner({ message, hint }: { message: string; hint?: string }) {
  return (
    <div
      className="rounded-xl border p-3 text-sm"
      style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)', color: '#fecaca' }}
    >
      <div className="font-medium">{message}</div>
      {hint ? <div className="mt-1 text-xs opacity-90">{hint}</div> : null}
    </div>
  );
}

export function MetaText({ children }: { children: ReactNode }) {
  return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{children}</span>;
}
