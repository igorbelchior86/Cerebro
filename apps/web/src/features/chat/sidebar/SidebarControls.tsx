'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { QueueOption } from './types';

interface SidebarStatsProps {
    processing: number;
    scope: 'personal' | 'global';
    onCreateTicket: () => void;
    onSetScope: (scope: 'personal' | 'global') => void;
    labelPersonal: string;
    labelGlobal: string;
    labelNewTicket: string;
    labelActive: string;
}

interface SidebarFilterBarProps {
    scope: 'personal' | 'global';
    selectedQueue: string;
    queueOptions: QueueOption[];
    statusFilterOptions: Array<{ key: string; label: string; count: number }>;
    hiddenStatusKeys: Record<string, true>;
    onQueueChange: (q: string) => void;
    onToggleStatusFilter: (key: string) => void;
    onResetStatusFilter: () => void;
    labelQueueSelect: string;
    labelQueueSelectAria: string;
    labelGlobalStatusFilterAria: string;
    labelGlobalStatusFilterTitle: string;
    labelGlobalStatusFilterReset: string;
    labelGlobalStatusFilterNoStatus: string;
}

export function SidebarStats({
    processing,
    scope,
    onCreateTicket,
    onSetScope,
    labelPersonal,
    labelGlobal,
    labelNewTicket,
    labelActive,
}: SidebarStatsProps) {
    return (
        <div style={{ borderRadius: '20px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.55fr)', gap: '6px', padding: '10px 10px 8px', position: 'relative', zIndex: 1 }}>
                {/* Active count */}
                <div style={{ textAlign: 'center', padding: '6px 5px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                    <div style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '13px', fontWeight: 700, letterSpacing: '-0.04em', marginBottom: '2px', color: 'var(--accent)' }}>{processing}</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{labelActive}</div>
                </div>
                {/* New Ticket button */}
                <button
                    type="button"
                    onClick={onCreateTicket}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '6px 10px', borderRadius: '10px', border: '1px solid var(--border-accent)',
                        background: 'linear-gradient(135deg, var(--accent-muted) 0%, rgba(111,143,126,0.06) 100%)',
                        color: 'var(--accent)', cursor: 'pointer', fontSize: '9px', fontWeight: 800,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        boxShadow: '0 8px 18px rgba(111,143,126,0.16)', transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 22px rgba(111,143,126,0.24)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 18px rgba(111,143,126,0.16)';
                    }}
                    aria-label={labelNewTicket}
                >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 3.2v9.6M3.2 8h9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                    <span>{labelNewTicket}</span>
                </button>
            </div>
            {/* Scope Switcher */}
            <div style={{ padding: '0 10px 10px', position: 'relative', zIndex: 1 }}>
                <div role="tablist" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', padding: '3px', borderRadius: '11px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute', top: '3px', left: '3px', width: 'calc(50% - 3px)', height: 'calc(100% - 6px)',
                            borderRadius: '8px', background: 'var(--accent-muted)', border: '1px solid var(--border-accent)',
                            boxShadow: '0 6px 14px rgba(20,24,38,0.12)',
                            transform: scope === 'personal' ? 'translateX(0)' : 'translateX(100%)',
                            transition: 'var(--transition)', pointerEvents: 'none',
                        }}
                    />
                    {(['personal', 'global'] as const).map((mode) => (
                        <button
                            key={mode}
                            type="button"
                            role="tab"
                            aria-selected={scope === mode}
                            onClick={() => onSetScope(mode)}
                            style={{
                                position: 'relative', zIndex: 1, border: 'none', background: 'transparent',
                                color: scope === mode ? 'var(--accent)' : 'var(--text-muted)',
                                fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                                padding: '6px 0', borderRadius: '8px', cursor: 'pointer', transition: 'var(--transition)',
                            }}
                        >
                            {mode === 'personal' ? labelPersonal : labelGlobal}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SidebarFilterBar({
    scope,
    selectedQueue,
    queueOptions,
    statusFilterOptions,
    hiddenStatusKeys,
    onQueueChange,
    onToggleStatusFilter,
    onResetStatusFilter,
    labelQueueSelect,
    labelQueueSelectAria,
    labelGlobalStatusFilterAria,
    labelGlobalStatusFilterTitle,
    labelGlobalStatusFilterReset,
    labelGlobalStatusFilterNoStatus,
}: SidebarFilterBarProps) {
    const [globalStatusFilterOpen, setGlobalStatusFilterOpen] = useState(false);
    const globalStatusFilterRef = useRef<HTMLDivElement>(null);
    const hiddenStatusCount = useMemo(() => Object.keys(hiddenStatusKeys).length, [hiddenStatusKeys]);

    useEffect(() => {
        if (!globalStatusFilterOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!globalStatusFilterRef.current) return;
            if (globalStatusFilterRef.current.contains(event.target as Node)) return;
            setGlobalStatusFilterOpen(false);
        };
        window.addEventListener('mousedown', onPointerDown);
        return () => window.removeEventListener('mousedown', onPointerDown);
    }, [globalStatusFilterOpen]);

    useEffect(() => {
        setGlobalStatusFilterOpen(false);
    }, [scope]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px 8px', position: 'relative', zIndex: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                    {labelQueueSelect}
                </span>
                <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                    <select
                        value={selectedQueue}
                        onChange={(e) => onQueueChange(e.target.value)}
                        aria-label={labelQueueSelectAria}
                        style={{
                            width: '100%', height: '30px', borderRadius: '10px', border: '1px solid var(--bento-outline)',
                            background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 28px 0 10px',
                            fontSize: '10px', fontWeight: 600, outline: 'none', appearance: 'none',
                            textOverflow: 'ellipsis', cursor: 'pointer',
                        }}
                    >
                        {queueOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </select>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ position: 'absolute', right: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                        <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                <div ref={globalStatusFilterRef} style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                        type="button"
                        aria-label={labelGlobalStatusFilterAria}
                        title={labelGlobalStatusFilterTitle}
                        onClick={() => setGlobalStatusFilterOpen((prev) => !prev)}
                        style={{
                            width: '30px', height: '30px', borderRadius: '10px',
                            border: `1px solid ${globalStatusFilterOpen ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                            background: globalStatusFilterOpen ? 'var(--accent-muted)' : 'var(--bg-card)',
                            color: globalStatusFilterOpen ? 'var(--accent)' : 'var(--text-muted)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', cursor: 'pointer', transition: 'var(--transition)',
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M2.5 4h11M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {hiddenStatusCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-4px', minWidth: '14px', height: '14px', padding: '0 3px',
                                borderRadius: '999px', background: 'var(--accent)', border: '1px solid var(--border-accent)', color: '#fff',
                                fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8px', fontWeight: 700, lineHeight: '12px', textAlign: 'center',
                            }}>
                                {hiddenStatusCount > 99 ? '99+' : hiddenStatusCount}
                            </span>
                        )}
                    </button>

                    {globalStatusFilterOpen && (
                            <div
                                style={{
                                    position: 'absolute', top: '34px', right: 0, width: '260px', maxHeight: '280px', overflowY: 'auto',
                                    borderRadius: '12px', border: '1px solid var(--modal-border)', background: 'var(--modal-surface)',
                                    boxShadow: '0 12px 30px rgba(0,0,0,0.18)', backdropFilter: 'blur(10px)', padding: '10px', zIndex: 50,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {labelGlobalStatusFilterTitle}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={onResetStatusFilter}
                                        style={{
                                            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textDecoration: 'underline',
                                            color: 'var(--accent)', fontSize: '10px', fontWeight: 600,
                                        }}
                                    >
                                        {labelGlobalStatusFilterReset}
                                    </button>
                                </div>
                                {statusFilterOptions.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{labelGlobalStatusFilterNoStatus}</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {statusFilterOptions.map((option) => {
                                            const checked = !hiddenStatusKeys[option.key];
                                            return (
                                                <label
                                                    key={option.key}
                                                    style={{
                                                        display: 'grid', gridTemplateColumns: '16px minmax(0, 1fr) auto', alignItems: 'center', gap: '8px', cursor: 'pointer',
                                                        borderRadius: '8px', padding: '4px 6px', background: checked ? 'var(--accent-muted)' : 'transparent',
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => onToggleStatusFilter(option.key)}
                                                        style={{ margin: 0 }}
                                                    />
                                                    <span style={{ fontSize: '11px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {option.label}
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>{option.count}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                    )}
                </div>
            </div>
        </div>
    );
}
