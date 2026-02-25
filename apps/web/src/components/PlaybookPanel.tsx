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
  sessionStatus?: 'pending' | 'processing' | 'approved' | 'failed' | 'needs_more_info' | 'blocked' | undefined;
  children?: ReactNode;
}

function ShimmerBlock({ width = '100%', height = 10, radius = 6 }: { width?: string; height?: number; radius?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: `${radius}px`,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 37%, rgba(255,255,255,0.04) 63%)',
        backgroundSize: '400% 100%',
        animation: 'shimmer 1.4s ease infinite',
      }}
    />
  );
}

function confColor(c: number): string {
  if (c >= 0.7) return '#1DB98A';
  if (c >= 0.45) return '#EAB308';
  return 'rgba(228,234,248,0.28)';
}

function SectionLabel({ children, onToggle, isOpen }: { children: ReactNode; onToggle?: () => void; isOpen?: boolean }) {
  return (
    <div style={{
      fontFamily: 'var(--font-jetbrains-mono, monospace)',
      fontSize: '8.5px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: 'var(--text-faint)',
      marginBottom: '10px',
      paddingBottom: '7px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 10,
    }}>
      {children}
      {onToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--bento-outline)',
            color: 'var(--accent)',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.background = 'rgba(91,127,255,0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--bento-outline)';
            e.currentTarget.style.background = 'var(--bg-card)';
          }}
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function CategoryIcon({ category, size = 12 }: { category: string; size?: number }) {
  const iconProps = { width: size, height: size, strokeWidth: 2, stroke: 'currentColor', fill: 'none' };
  switch (category) {
    case 'Hardware':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'Network':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'Identity':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'Security':
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return (
        <svg {...iconProps} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      );
  }
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

function cleanTitle(text: string): string {
  // Robust removal of [H1], [H2], [rank 1], etc., even if preceded by markdown stars like **[H1]...
  return text
    .replace(/^([\s*_]*)(?:\[H\d+\]|\[rank\s*\d+\]|\(\d+\))\s*/gi, '$1')
    .trim();
}

export default function PlaybookPanel({ content, status = 'ready', data, sessionStatus, children }: PlaybookPanelProps) {
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [openEvidenceFor, setOpenEvidenceFor] = useState<number | null>(null);

  const ctx = data?.context ?? [];
  const hyps = data?.hypotheses ?? [];
  const chk: ChecklistItem[] = data?.checklist?.length
    ? data.checklist.map((item, i) => {
      const out: ChecklistItem = {
        id: item.id || `c${i}`,
        text: item.text,
      };
      if (item.details_md) out.details_md = item.details_md;
      return out;
    })
    : [];
  const esc = data?.escalate ?? [];
  const ticketId = data?.ticketId;

  return (
    <div className="animate-slideInRight" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, flexShrink: 0, background: 'transparent', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-60px', right: '-80px', width: '280px', height: '280px', borderRadius: '50%', background: 'var(--glow-playbook)', pointerEvents: 'none', zIndex: 0 }} />


      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 12px 14px', position: 'relative', zIndex: 1 }}>
        {ctx.length > 0 && (
          <div style={{
            position: 'sticky',
            top: '-14px',
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            zIndex: 20,
            margin: '0 -14px 22px -14px',
            padding: '14px 14px 14px 14px',
            borderBottom: isContextOpen ? 'none' : '1px solid var(--bento-outline)',
            boxShadow: '0 8px 16px -4px rgba(0,0,0,0.06)'
          }}>
            <SectionLabel
              isOpen={isContextOpen}
              onToggle={() => setIsContextOpen(!isContextOpen)}
            >
              Context
            </SectionLabel>
            {isContextOpen && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-300" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {ctx.map((c) => (
                  <div key={c.key} style={{ padding: '8px 10px', borderRadius: '7px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{c.key}</div>
                    <div style={{ fontSize: '11.5px', fontWeight: 500, color: c.highlight ?? 'var(--text-primary)' }}>{c.val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* HYPOTHESES SECTION */}
        <div style={{ marginBottom: '22px' }}>
          <SectionLabel>Hypotheses</SectionLabel>
          {hyps.length > 0 ? (
            hyps.map((h) => {
              const c = confColor(h.confidence);
              const tone = confidenceTone(h.confidence);
              const category = hypothesisCategory(h.hypothesis);
              const rankBg = h.rank === 1 ? '#F97316' : h.rank === 2 ? '#EAB308' : '#5B7FFF';
              return (
                <div
                  key={h.rank}
                  style={{
                    padding: '14px 14px 0 14px',
                    borderRadius: '12px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--bento-outline)',
                    marginBottom: '10px',
                    cursor: 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--bento-outline)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '3px 7px 3px 3px',
                      borderRadius: '8px',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--bento-outline)',
                      color: rankBg
                    }}>
                      <span style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 800,
                        color: '#fff',
                        background: rankBg
                      }}>
                        {h.rank}
                      </span>
                      <CategoryIcon category={category} size={11} />
                      <span style={{
                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                        fontSize: '9px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: 'var(--text-secondary)'
                      }}>
                        {category}
                      </span>
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 9px',
                          borderRadius: '7px',
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
                            width: '24px',
                            height: '24px',
                            borderRadius: '7px',
                            border: '1px solid var(--bento-outline)',
                            background: 'var(--bg-card)',
                            color: 'var(--accent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.background = 'rgba(91,127,255,0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--bento-outline)';
                            e.currentTarget.style.background = 'var(--bg-card)';
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="16" x2="12" y2="12" />
                            <line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '12.5px', lineHeight: 1.55, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
                    {h.hypothesis}
                  </div>

                  {openEvidenceFor === h.rank && h.evidence && h.evidence.length > 0 && (
                    <div
                      style={{
                        margin: '0 -14px 14px -14px',
                        padding: '12px 14px',
                        background: 'var(--modal-sidebar)',
                        borderTop: '1px solid var(--bento-outline)',
                        borderBottom: '1px solid var(--bento-outline)',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontWeight: 700 }}>
                        Supporting Evidence
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {h.evidence.map((ev) => {
                          const id = typeof ev === 'string' ? ev : ev.id;
                          const label = formatEvidenceChipLabel(ev);
                          return (
                            <div key={id} style={{ border: '1px solid var(--bento-outline)', borderRadius: '8px', padding: '8px 10px', background: 'var(--bg-card)' }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>{label}</div>
                              <div style={{ marginTop: '3px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', color: 'var(--text-muted)' }}>{id}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ height: '3px', margin: '0 -14px', background: 'var(--bento-outline)', position: 'relative' }}>
                    <div style={{
                      height: '100%',
                      width: `${h.confidence * 100}%`,
                      background: c,
                      boxShadow: `0 0 8px ${c}66`,
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '10px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <ShimmerBlock width="20px" height={20} radius={6} />
                <ShimmerBlock width="72px" height={10} />
                <ShimmerBlock width="58px" height={18} radius={999} />
              </div>
              <ShimmerBlock width="90%" height={12} />
              <ShimmerBlock width="78%" height={12} />
              <ShimmerBlock width="100%" height={6} radius={999} />
            </div>
          )}
        </div>

        {/* CHECKLIST SECTION */}
        <div style={{ marginBottom: '22px' }}>
          <SectionLabel>Checklist</SectionLabel>
          {chk.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {chk.map((item, i) => {
                const done = !!checked[item.id];
                const cleanedText = cleanTitle(item.text);
                return (
                  <div
                    key={item.id}
                    onClick={() => setChecked((p) => ({ ...p, [item.id]: !p[item.id] }))}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--bento-outline)',
                      cursor: 'pointer',
                      opacity: done ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!done) {
                        e.currentTarget.style.borderColor = 'var(--accent)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.025)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!done) {
                        e.currentTarget.style.borderColor = 'var(--bento-outline)';
                        e.currentTarget.style.background = 'var(--bg-card)';
                      }
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `1.5px solid ${done ? '#1DB98A' : 'var(--border-strong)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px',
                      background: done ? '#1DB98A' : 'var(--bg-panel)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: done ? '0 0 8px rgba(29,185,138,0.3)' : 'none'
                    }}>
                      {done && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{
                          fontFamily: 'var(--font-jetbrains-mono, monospace)',
                          fontSize: '9px',
                          fontWeight: 700,
                          color: done ? 'var(--text-faint)' : 'var(--accent)',
                          background: done ? 'var(--bg-badge)' : 'rgba(91,127,255,0.08)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          marginTop: '2px',
                          flexShrink: 0
                        }}>
                          {i + 1}
                        </span>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: done ? 'var(--text-faint)' : 'var(--text-primary)',
                          lineHeight: 1.5,
                          textDecoration: done ? 'line-through' : 'none',
                          transition: 'color 0.2s ease'
                        }}>
                          <MarkdownRenderer content={cleanedText} className="checklist-prose" />
                        </div>
                      </div>

                      {item.details_md && (
                        <div style={{
                          marginLeft: '26px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--modal-sidebar)',
                          borderLeft: `2px solid ${done ? 'var(--border)' : 'var(--accent)'}`,
                          opacity: done ? 0.7 : 1,
                          fontSize: '11.5px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.55
                        }}>
                          <MarkdownRenderer content={item.details_md} className="checklist-prose" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[0, 1, 2].map((i) => (
                <div key={`chk-sk-${i}`} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <ShimmerBlock width="15px" height={15} radius={4} />
                  <ShimmerBlock width="14px" height={10} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '2px' }}>
                    <ShimmerBlock width="92%" height={12} />
                    <ShimmerBlock width="75%" height={12} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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

        {chk.length === 0 && hyps.length === 0 && content && sessionStatus === 'approved' && status === 'ready' && (
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
