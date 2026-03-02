'use client';

import { useState } from 'react';
import { SectionLabel, CategoryIcon, ShimmerBlock, confColor, confidenceTone, hypothesisCategory, formatEvidenceChipLabel } from './primitives';
import type { Hypothesis } from './types';

interface PlaybookHypothesesProps {
    hypotheses: Hypothesis[];
}

export function PlaybookHypotheses({ hypotheses: hyps }: PlaybookHypothesesProps) {
    const [openEvidenceFor, setOpenEvidenceFor] = useState<number | null>(null);

    return (
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
                                overflow: 'hidden',
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
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '3px 7px 3px 3px', borderRadius: '8px',
                                    background: 'var(--bg-panel)', border: '1px solid var(--bento-outline)', color: rankBg,
                                }}>
                                    <span style={{
                                        width: '18px', height: '18px', borderRadius: '5px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '10px', fontWeight: 800, color: '#fff', background: rankBg,
                                    }}>
                                        {h.rank}
                                    </span>
                                    <CategoryIcon category={category} size={11} />
                                    <span style={{
                                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                                        fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.04em', color: 'var(--text-secondary)',
                                    }}>
                                        {category}
                                    </span>
                                </div>

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                                        padding: '3px 9px', borderRadius: '7px',
                                        border: `1px solid ${tone.border}`, background: tone.bg, color: tone.color,
                                        fontSize: '10px', fontWeight: 700,
                                        fontFamily: 'var(--font-jetbrains-mono, monospace)',
                                    }}>
                                        {tone.label} {Math.round(h.confidence * 100)}%
                                    </span>
                                    {h.evidence && h.evidence.length > 0 && (
                                        <button
                                            type="button"
                                            aria-label="View evidence"
                                            onClick={() => setOpenEvidenceFor((p) => (p === h.rank ? null : h.rank))}
                                            style={{
                                                width: '24px', height: '24px', borderRadius: '7px',
                                                border: '1px solid var(--bento-outline)', background: 'var(--bg-card)',
                                                color: 'var(--accent)', display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s ease',
                                            }}
                                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(91,127,255,0.08)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bento-outline)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
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
                                <div style={{
                                    margin: '0 -14px 14px -14px', padding: '12px 14px',
                                    background: 'var(--modal-sidebar)',
                                    borderTop: '1px solid var(--bento-outline)',
                                    borderBottom: '1px solid var(--bento-outline)',
                                }}>
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
                                    height: '100%', width: `${h.confidence * 100}%`,
                                    background: c, boxShadow: `0 0 8px ${c}66`,
                                    transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
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
    );
}
