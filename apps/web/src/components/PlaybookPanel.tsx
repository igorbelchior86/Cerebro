'use client';

import { useState, type ReactNode } from 'react';

interface Hypothesis {
  rank: number;
  hypothesis: string;
  confidence: number;
  evidence?: string[];
}

interface ChecklistItem {
  id: string;
  text: string;
}

interface EscalateRow {
  icon: string;
  text: string;
}

interface ContextItem {
  key: string;
  val: string;
  highlight?: string;
}

interface PlaybookData {
  ticketId?: string;
  context?: ContextItem[];
  hypotheses?: Hypothesis[];
  checklist?: ChecklistItem[];
  escalate?: EscalateRow[];
}

interface PlaybookPanelProps {
  content: string | null;
  status?: 'loading' | 'ready' | 'error';
  error?: string;
  data?: PlaybookData;
  children?: ReactNode;
}

function confColor(c: number): string {
  if (c >= 0.7) return '#1DB98A';
  if (c >= 0.45) return '#EAB308';
  return 'rgba(228,234,248,0.28)';
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-faint)', marginBottom: '10px', paddingBottom: '7px', borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

export default function PlaybookPanel({ content, status = 'ready', data, children }: PlaybookPanelProps) {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const handleCopy = () => {
    navigator.clipboard?.writeText(content ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (status === 'loading') {
    return (
      <div className="animate-slideInRight" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, flexShrink: 0, background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid rgba(91,127,255,0.25)', borderTopColor: '#5B7FFF', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Generating playbook...</p>
      </div>
    );
  }

  if (!content && !data) {
    return (
      <div className="animate-slideInRight" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, flexShrink: 0, background: 'var(--bg-panel)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', background: 'var(--bg-card)', border: '1px dashed var(--border-strong)' }}>📄</div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Playbook will appear here</p>
      </div>
    );
  }

  const ctx = data?.context ?? [];
  const hyps = data?.hypotheses ?? [];
  const chk: ChecklistItem[] = data?.checklist ?? (content
    ? content.split('\n').filter((l) => /^\d+\./.test(l)).map((l, i) => ({ id: `c${i}`, text: l.replace(/^\d+\.\s*/, '') }))
    : []);
  const esc = data?.escalate ?? [];
  const ticketId = data?.ticketId;

  return (
    <div className="animate-slideInRight" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, flexShrink: 0, background: 'var(--bg-panel)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
      <div style={{ position: 'absolute', top: '-60px', right: '-80px', width: '280px', height: '280px', borderRadius: '50%', background: 'var(--glow-playbook)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Topbar */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, position: 'relative', zIndex: 1, background: 'var(--bg-panel)' }}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: '#1DB98A', flexShrink: 0 }}>
          <rect x="1" y="1" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M4 5h6M4 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1 }}>
          Network Playbook{ticketId ? ` — ${ticketId}` : ''}
        </span>
        <button onClick={handleCopy}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, border: `1px solid ${copied ? 'var(--green-border)' : 'var(--border)'}`, background: 'var(--bg-card)', color: copied ? 'var(--green)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'var(--transition)' }}
        >
          {copied ? (
            <span className="animate-check-pop" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Copied!
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="4" y="4" width="7" height="7" rx="1.5"/><path d="M8 4V2.5A1.5 1.5 0 006.5 1h-4A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4"/></svg>
              Copy
            </span>
          )}
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', fontSize: '10.5px', fontWeight: 600, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'white', cursor: 'pointer', opacity: 0.88 }}>
          Export
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px', position: 'relative', zIndex: 1 }}>
        {ctx.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <SectionLabel>Context</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {ctx.map((c) => (
                <div key={c.key} style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{c.key}</div>
                  <div style={{ fontSize: '11.5px', fontWeight: 500, color: c.highlight ?? 'var(--text-primary)' }}>{c.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {hyps.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <SectionLabel>Hypotheses</SectionLabel>
            {hyps.map((h) => {
              const c = confColor(h.confidence);
              const rankBg = h.rank === 1 ? '#F97316' : h.rank === 2 ? '#EAB308' : '#5B7FFF';
              return (
                <div key={h.rank} style={{ padding: '11px 13px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '7px', cursor: 'default', transition: 'var(--transition)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: h.evidence?.length ? '6px' : 0 }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0, background: rankBg }}>{h.rank}</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{h.hypothesis}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', fontWeight: 700, color: c }}>{Math.round(h.confidence * 100)}%</span>
                      <div style={{ width: '44px', height: '3px', borderRadius: '99px', background: 'var(--border)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${h.confidence * 100}%`, borderRadius: '99px', background: c }} />
                      </div>
                    </div>
                  </div>
                  {h.evidence && h.evidence.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {h.evidence.map((ev) => (
                        <span key={ev} style={{ padding: '2px 7px', borderRadius: '4px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--accent)', background: 'var(--accent-muted)', border: '1px solid rgba(91,127,255,0.15)' }}>{ev}</span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {chk.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <SectionLabel>Checklist</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {chk.map((item, i) => {
                const done = !!checked[item.id];
                return (
                  <div key={item.id} onClick={() => setChecked((p) => ({ ...p, [item.id]: !p[item.id] }))}
                    style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '9px 11px', borderRadius: '7px', background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', opacity: done ? 0.55 : 1, transition: 'var(--transition)' }}
                    onMouseEnter={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                    onMouseLeave={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ width: '15px', height: '15px', borderRadius: '4px', border: `1.5px solid ${done ? '#1DB98A' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.5px', background: done ? '#1DB98A' : 'transparent', transition: 'var(--transition)' }}>
                      {done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', flexShrink: 0, marginTop: '0.5px', minWidth: '14px' }}>{i + 1}.</span>
                    <span style={{ fontSize: '12px', color: done ? 'var(--text-faint)' : 'var(--text-secondary)', lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none' }}>{item.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {esc.length > 0 && (
          <div style={{ marginBottom: '22px' }}>
            <SectionLabel>Escalate when</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {esc.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '9px 11px', borderRadius: '7px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)' }}>
                  <span style={{ fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{r.icon}</span>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {chk.length === 0 && hyps.length === 0 && content && (
          <div style={{ whiteSpace: 'pre-wrap', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {content}
          </div>
        )}
      </div>

      {children && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0, position: 'relative', zIndex: 1 }}>
          {children}
        </div>
      )}
    </div>
  );
}
