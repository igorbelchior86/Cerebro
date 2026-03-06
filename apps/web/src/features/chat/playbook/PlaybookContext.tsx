'use client';

import { useState } from 'react';
import { SectionLabel } from './primitives';
import type { ContextItem } from './types';

interface PlaybookContextProps {
    items: ContextItem[];
    onEditContextItem?: (key: string) => void;
}

const CUSTOMER_IDENTITY_KEYS = ['Org', 'Contact', 'Additional contacts'];
const OPTIONAL_METADATA_KEYS = ['Priority', 'Issue Type', 'Sub-Issue Type', 'Service Level Agreement'];
const NETWORK_KEYS = ['ISP', 'Phone Provider', 'Firewall'];
const ENVIRONMENT_KEYS = ['User Device', 'Additional Devices', 'WiFi', 'Switch'];

function ContextCell({ c, onEditContextItem }: { c: ContextItem; onEditContextItem?: (key: string) => void }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                padding: '8px 10px',
                borderRadius: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease',
            }}
        >
            {c.editable && onEditContextItem && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditContextItem(c.key); }}
                    style={{
                        position: 'absolute', top: '6px', right: '6px',
                        width: '24px', height: '24px', borderRadius: '6px',
                        border: '1px solid var(--bento-outline)',
                        background: 'var(--bg-panel)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        opacity: isHovered ? 1 : 0,
                        transform: isHovered ? 'scale(1)' : 'scale(0.9)',
                        pointerEvents: isHovered ? 'auto' : 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(110, 134, 201, 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bento-outline)'; e.currentTarget.style.background = 'var(--bg-panel)'; }}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                </button>
            )}
            <div style={{ fontSize: '9px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px', fontWeight: 700 }}>{c.key}</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: c.highlight ?? 'var(--text-primary)', lineHeight: 1.35, wordBreak: 'break-word' }}>{c.val}</div>
        </div>
    );
}

export function PlaybookContext({ items, onEditContextItem }: PlaybookContextProps) {
    const [isContextOpen, setIsContextOpen] = useState(true);
    const [isTicketMetadataOpen, setIsTicketMetadataOpen] = useState(false);

    const customerIdentityItems = items.filter((c) => CUSTOMER_IDENTITY_KEYS.includes(c.key));
    const optionalTicketMetadataItems = items.filter((c) => OPTIONAL_METADATA_KEYS.includes(c.key));
    const networkItems = items.filter((c) => NETWORK_KEYS.includes(c.key));
    const environmentItems = ENVIRONMENT_KEYS
        .map((key) => items.find((c) => c.key === key))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (items.length === 0) return null;

    return (
        <div style={{
            position: 'sticky',
            top: '0px',
            background: 'var(--bg-panel)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            zIndex: 20,
            margin: '0 -14px 0 -14px',
            padding: '8px 0',
            borderBottom: isContextOpen ? 'none' : '1px solid var(--bento-outline)',
        }}>
            <div style={{ padding: '0 14px' }}>
                <SectionLabel isOpen={isContextOpen} onToggle={() => setIsContextOpen(!isContextOpen)}>
                    Context
                </SectionLabel>
            </div>
            <div style={{
                display: 'grid', gridTemplateRows: isContextOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            }}>
                <div style={{ overflow: 'visible' }}>
                    <div style={{
                        display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', position: 'relative',
                        padding: '6px 14px 2px',
                        transition: 'opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), visibility 0.4s',
                        opacity: isContextOpen ? 1 : 0, transform: isContextOpen ? 'translateY(0)' : 'translateY(-10px)', visibility: isContextOpen ? 'visible' : 'hidden',
                    }}>
                        {/* Unified Bento Context Surface */}
                        <div style={{
                            display: 'flex', flexDirection: 'column', gap: '10px',
                            background: 'rgba(255, 255, 255, 0.02)', padding: '12px',
                            borderRadius: '18px', border: '1px solid var(--bento-outline)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
                        }}>
                            {/* Primary Identity Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {customerIdentityItems.map((c) => (
                                    <div key={c.key} style={{ gridColumn: c.key === 'Additional contacts' ? 'span 2' : 'span 1' }}>
                                        <ContextCell c={c} {...(onEditContextItem ? { onEditContextItem } : {})} />
                                    </div>
                                ))}

                                {optionalTicketMetadataItems.length > 0 && (
                                    <div style={{ gridColumn: 'span 2', marginTop: isTicketMetadataOpen ? '2px' : '-6px' }}>
                                        <div style={{ display: 'grid', gridTemplateRows: isTicketMetadataOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}>
                                            <div style={{ overflow: 'hidden' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px' }}>
                                                    {optionalTicketMetadataItems.map((c) => (
                                                        <ContextCell key={c.key} c={c} {...(onEditContextItem ? { onEditContextItem } : {})} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setIsTicketMetadataOpen(!isTicketMetadataOpen)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '4px -12px -12px', padding: '6px 0', cursor: 'pointer',
                                                color: 'var(--text-muted)', transition: 'all 0.2s',
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ transform: isTicketMetadataOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                                                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ height: '1px', background: 'var(--bento-outline)', margin: '2px 0' }} />

                            {/* Secondary Technical Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '4px' }}>Network</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {networkItems.map((c) => (
                                            <div key={c.key} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '8px', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1px' }}>{c.key}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.25 }}>{c.val}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <div style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '4px' }}>Environment</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {environmentItems.map((c) => (
                                            <div key={c.key} style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                                <div style={{ fontSize: '8px', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1px' }}>{c.key}</div>
                                                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.25 }}>{c.val}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
