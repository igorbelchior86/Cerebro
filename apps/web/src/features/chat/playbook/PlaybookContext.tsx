'use client';

import { useState } from 'react';
import { CollapseToggleButton, SectionLabel } from './primitives';
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
    return (
        <div
            style={{
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                position: 'relative',
                transition: 'all 0.2s ease',
            }}
        >
            {c.editable && onEditContextItem ? (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditContextItem(c.key); }}
                    style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '20px', height: '20px', borderRadius: '6px',
                        border: '1px solid var(--bento-outline)',
                        background: 'var(--bg-panel)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(110, 134, 201, 0.08)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bento-outline)'; e.currentTarget.style.background = 'var(--bg-panel)'; }}
                >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                </button>
            ) : null}
            <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', fontWeight: 700 }}>{c.key}</div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: c.highlight ?? 'var(--text-primary)', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.val}</div>
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
            padding: '10px 0 10px 0',
            borderBottom: isContextOpen ? 'none' : '1px solid var(--bento-outline)',
            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.04)',
        }}>
            <div style={{ padding: '0 14px' }}>
                <SectionLabel isOpen={isContextOpen} onToggle={() => setIsContextOpen(!isContextOpen)}>
                    Context
                </SectionLabel>
            </div>
            <div style={{
                display: 'grid',
                gridTemplateRows: isContextOpen ? '1fr' : '0fr',
                transition: 'grid-template-rows 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
            }}>
                <div style={{ overflow: 'hidden' }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        width: '100%',
                        position: 'relative',
                        padding: '0 14px',
                        paddingTop: '6px',
                        paddingBottom: '24px',
                        marginBottom: '-24px',
                        transition: 'opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), visibility 0.4s',
                        opacity: isContextOpen ? 1 : 0,
                        transform: isContextOpen ? 'translateY(0)' : 'translateY(-10px)',
                        visibility: isContextOpen ? 'visible' : 'hidden',
                    }}>
                        {/* Customer Identity */}
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '8px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                padding: '12px',
                                borderRadius: '16px',
                                border: '1px solid var(--bento-outline)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--border-accent)';
                                e.currentTarget.style.boxShadow = '0 12px 24px rgba(20,24,38,0.2)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--bento-outline)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                            }}
                        >
                            {customerIdentityItems.map((c) => (
                                <div key={c.key} style={{ gridColumn: c.key === 'Additional contacts' ? 'span 2' : 'span 1' }}>
                                    <ContextCell c={c} {...(onEditContextItem ? { onEditContextItem } : {})} />
                                </div>
                            ))}

                            {optionalTicketMetadataItems.length > 0 ? (
                                <div style={{ gridColumn: '1 / -1', marginTop: '2px', position: 'relative', paddingBottom: '38px' }}>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateRows: isTicketMetadataOpen ? '1fr' : '0fr',
                                        transition: 'grid-template-rows 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
                                    }}>
                                        <div style={{ overflow: 'hidden' }}>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '8px',
                                                transition: 'opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1), transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), visibility 0.4s',
                                                opacity: isTicketMetadataOpen ? 1 : 0,
                                                transform: isTicketMetadataOpen ? 'translateY(0)' : 'translateY(-10px)',
                                                visibility: isTicketMetadataOpen ? 'visible' : 'hidden',
                                                paddingTop: isTicketMetadataOpen ? '8px' : '0',
                                            }}>
                                                {optionalTicketMetadataItems.map((c) => (
                                                    <ContextCell key={c.key} c={c} {...(onEditContextItem ? { onEditContextItem } : {})} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', right: 0, bottom: 0 }}>
                                        <CollapseToggleButton
                                            isOpen={isTicketMetadataOpen}
                                            expandedDirection="up"
                                            onToggle={() => setIsTicketMetadataOpen((prev) => !prev)}
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Technical split: Network + Environment */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', paddingBottom: '20px', marginBottom: '-20px' }}>
                            <div
                                style={{
                                    display: 'flex', flexDirection: 'column', gap: '6px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    padding: '8px', borderRadius: '14px', border: '1px solid var(--bento-outline)',
                                    transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(20,24,38,0.15)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--bento-outline)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                                }}
                            >
                                <div style={{ fontSize: '7.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', opacity: 0.8 }}>Network</div>
                                {networkItems.map((c) => (
                                    <div key={c.key} style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '8px', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>{c.key}</div>
                                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: c.highlight ?? 'var(--text-secondary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{c.val}</div>
                                    </div>
                                ))}
                            </div>

                            <div
                                style={{
                                    display: 'flex', flexDirection: 'column', gap: '6px',
                                    background: 'rgba(255, 255, 255, 0.015)',
                                    padding: '8px', borderRadius: '14px', border: '1px solid var(--bento-outline)',
                                    transition: 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border-accent)';
                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(20,24,38,0.15)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--bento-outline)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
                                }}
                            >
                                <div style={{ fontSize: '7.5px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', opacity: 0.8 }}>Environment</div>
                                {environmentItems.map((c) => (
                                    <div key={c.key} style={{ padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '8px', color: 'var(--text-faint)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>{c.key}</div>
                                        <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{c.val}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
