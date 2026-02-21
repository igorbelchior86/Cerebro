'use client';

import { useState, type ReactNode } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface Hypothesis {
  rank: number;
  hypothesis: string;
  confidence: number;
  evidence?: Array<string | { id: string; label?: string }>;
}

interface ChecklistItem {
  id: string;
  text: string;
  details_md?: string;
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

function hypothesisCategory(text: string): string {
  const t = String(text || '').toLowerCase();
  if (/(laptop|monitor|display|usb|driver|hardware|dock)/.test(t)) return 'Hardware';
  if (/(network|vpn|dns|interface|latency|internet|connect)/.test(t)) return 'Network';
  if (/(user|identity|login|requester|account|mfa)/.test(t)) return 'Identity';
  if (/(security|defender|edr|xdr|malware|phish)/.test(t)) return 'Security';
  return 'Operational';
}

function confidenceTone(c: number): { label: string; color: string; bg: string; border: string } {
  if (c >= 0.8) return { label: 'High', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.28)' };
  if (c >= 0.65) return { label: 'Medium', color: '#EAB308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.26)' };
  return { label: 'Low', color: '#5B7FFF', bg: 'rgba(91,127,255,0.1)', border: 'rgba(91,127,255,0.28)' };
}

function formatEvidenceChipLabel(raw: string | { id: string; label?: string }): string {
  const value = typeof raw === 'string' ? raw : String(raw?.id || '').trim();
  const explicit = typeof raw === 'string' ? '' : String(raw?.label || '').trim();
  if (explicit) return explicit;
  if (!value) return 'Evidence';

  if (value.startsWith('fact-ticket-')) return 'Ticket evidence';
  if (value.startsWith('fact-device-')) return 'Device evidence';
  if (value.startsWith('fact-actor-')) return 'Actor evidence';
  if (value.startsWith('fact-doc-')) return 'Documentation evidence';
  if (value.startsWith('fact-signal-')) {
    if (value.includes('ninja-iface')) return 'Ninja network interface signal';
    if (value.includes('ninja-sw')) return 'Ninja software signal';
    return 'Operational signal';
  }
  if (value.startsWith('fact-conflict-')) return 'Data conflict signal';
  if (value.startsWith('fact-provider-')) return 'Provider evidence';

  return value.length > 44 ? `${value.slice(0, 41)}...` : value;
}

function parseChecklistFromMarkdown(content: string): ChecklistItem[] {
  const lines = content.split('\n');
  const items: ChecklistItem[] = [];
  let current: { id: string; text: string; details: string[] } | null = null;
  let idx = 0;

  const flush = () => {
    if (!current) return;
    const baseItem: ChecklistItem = {
      id: current.id,
      text: current.text.trim(),
    };
    const details = current.details.join('\n').trim();
    if (details) baseItem.details_md = details;
    items.push(baseItem);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, '');
    const stepMatch = line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (stepMatch) {
      flush();
      current = {
        id: `c${idx++}`,
        text: String(stepMatch[2] || '').trim(),
        details: [],
      };
      continue;
    }
    if (current) {
      if (line.trim().length === 0) {
        const last = current.details.length > 0 ? current.details[current.details.length - 1] : null;
        if (last !== null && last !== '') {
          current.details.push('');
        }
      } else {
        current.details.push(line);
      }
    }
  }
  flush();
  return items;
}

export default function PlaybookPanel({ content, status = 'ready', data, children }: PlaybookPanelProps) {
  const [copied, setCopied] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openEvidenceFor, setOpenEvidenceFor] = useState<number | null>(null);

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
  const chk: ChecklistItem[] = data?.checklist
    ? data.checklist.map((item, i) => {
      const out: ChecklistItem = {
        id: item.id || `c${i}`,
        text: item.text,
      };
      if (item.details_md) out.details_md = item.details_md;
      return out;
    })
    : (content ? parseChecklistFromMarkdown(content) : []);
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
              const tone = confidenceTone(h.confidence);
              const category = hypothesisCategory(h.hypothesis);
              const rankBg = h.rank === 1 ? '#F97316' : h.rank === 2 ? '#EAB308' : '#5B7FFF';
              return (
                <div key={h.rank} style={{ padding: '12px 13px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', marginBottom: '8px', cursor: 'default', transition: 'var(--transition)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '20px', height: '20px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0, background: rankBg }}>
                      {h.rank}
                    </span>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {category}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: `1px solid ${tone.border}`,
                        background: tone.bg,
                        color: tone.color,
                        fontSize: '10px',
                        fontWeight: 700,
                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                      }}
                    >
                      {tone.label} {Math.round(h.confidence * 100)}%
                    </span>
                    {h.evidence && h.evidence.length > 0 && (
                      <button
                        type="button"
                        aria-label="View evidence"
                        onClick={() => setOpenEvidenceFor((p) => (p === h.rank ? null : h.rank))}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '999px',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-panel)',
                          color: 'var(--accent)',
                          fontFamily: 'var(--font-jetbrains-mono, monospace)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        i
                      </button>
                    )}
                  </div>

                  <div style={{ fontSize: '12.5px', lineHeight: 1.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {h.hypothesis}
                  </div>

                  {openEvidenceFor === h.rank && h.evidence && h.evidence.length > 0 && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px 11px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-strong)',
                        background: 'var(--bg-panel)',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                        Evidence details
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {h.evidence.map((ev) => {
                          const id = typeof ev === 'string' ? ev : ev.id;
                          const label = formatEvidenceChipLabel(ev);
                          return (
                            <div key={id} style={{ border: '1px solid var(--border)', borderRadius: '7px', padding: '7px 8px', background: 'var(--bg-card)' }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{label}</div>
                              <div style={{ marginTop: '3px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)' }}>{id}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: '62px' }}>
                      Confidence
                    </span>
                    <div style={{ flex: 1, height: '5px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${h.confidence * 100}%`, borderRadius: '999px', background: c }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '10px', fontWeight: 700, color: c }}>
                      {Math.round(h.confidence * 100)}%
                    </span>
                  </div>
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
                    style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', opacity: done ? 0.55 : 1, transition: 'var(--transition)' }}
                    onMouseEnter={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-strong)'; }}
                    onMouseLeave={(e) => { if (!done) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                  >
                    <div style={{ width: '15px', height: '15px', borderRadius: '4px', border: `1.5px solid ${done ? '#1DB98A' : 'var(--border-strong)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.5px', background: done ? '#1DB98A' : 'transparent', transition: 'var(--transition)' }}>
                      {done && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-faint)', flexShrink: 0, marginTop: '0.5px', minWidth: '14px' }}>{i + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ fontSize: '12px', color: done ? 'var(--text-faint)' : 'var(--text-secondary)', lineHeight: 1.45, textDecoration: done ? 'line-through' : 'none' }}>
                        <MarkdownRenderer content={item.text} />
                      </div>
                      {item.details_md && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', opacity: done ? 0.75 : 1 }}>
                          <MarkdownRenderer content={item.details_md} />
                        </div>
                      )}
                    </div>
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
          <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            <MarkdownRenderer content={content} />
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
