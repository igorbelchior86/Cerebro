import type { ReactNode } from 'react';
import CerebroLogo from '@/components/CerebroLogo';

export default function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header
        className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(8,9,16,0.85)',
          borderBottom: '1px solid var(--border-subtle)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <CerebroLogo size={28} priority />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Cerebro
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <a
            href="/"
            className="px-3 py-1.5 rounded-lg text-sm transition"
            style={{ color: 'var(--text-secondary)' }}
          >
            Dashboard
          </a>
          <a
            href="/triage/new"
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
            style={{
              color: 'var(--accent-1)',
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            + New Triage
          </a>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
