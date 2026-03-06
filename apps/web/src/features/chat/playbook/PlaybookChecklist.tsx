'use client';

import { useState } from 'react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { ShimmerBlock, cleanTitle, StickyHeader } from './primitives';
import type { ChecklistItem } from './types';

interface PlaybookChecklistProps {
    items: ChecklistItem[];
}

export function PlaybookChecklist({ items: chk }: PlaybookChecklistProps) {
    const [checked, setChecked] = useState<Record<string, boolean>>({});

    return (
        <div style={{ marginBottom: '22px' }}>
            <StickyHeader>Checklist</StickyHeader>
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
                                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                                    padding: '12px 14px', borderRadius: '12px',
                                    background: 'var(--bg-card)', border: '1px solid var(--bento-outline)',
                                    cursor: 'pointer', opacity: done ? 0.6 : 1, transition: 'all 0.2s ease',
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
                                    width: '18px', height: '18px', borderRadius: '5px',
                                    border: `1.5px solid ${done ? '#1DB98A' : 'var(--border-strong)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0, marginTop: '1px',
                                    background: done ? '#1DB98A' : 'var(--bg-panel)',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: done ? '0 0 8px rgba(29,185,138,0.3)' : 'none',
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
                                            fontSize: '9px', fontWeight: 700,
                                            color: done ? 'var(--text-faint)' : 'var(--accent)',
                                            background: done ? 'var(--bg-badge)' : 'var(--accent-muted)',
                                            padding: '1px 5px', borderRadius: '4px',
                                            marginTop: '2px', flexShrink: 0,
                                        }}>
                                            {i + 1}
                                        </span>
                                        <div style={{
                                            fontSize: '13px', fontWeight: 600,
                                            color: done ? 'var(--text-faint)' : 'var(--text-primary)',
                                            lineHeight: 1.5,
                                            textDecoration: done ? 'line-through' : 'none',
                                            transition: 'color 0.2s ease',
                                        }}>
                                            <MarkdownRenderer content={cleanedText} className="checklist-prose" />
                                        </div>
                                    </div>

                                    {item.details_md && (
                                        <div style={{
                                            marginLeft: '26px', padding: '10px 12px', borderRadius: '8px',
                                            background: 'var(--modal-sidebar)',
                                            borderLeft: `2px solid ${done ? 'var(--border)' : 'var(--accent)'}`,
                                            opacity: done ? 0.7 : 1,
                                            fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.55,
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
    );
}
