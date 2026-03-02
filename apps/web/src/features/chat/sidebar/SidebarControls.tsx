'use client';

import { FILTERS } from './utils';
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
    filter: string;
    hideSuppressed: boolean;
    suppressedCount: number;
    selectedGlobalQueue: string;
    queueOptions: QueueOption[];
    onFilterChange: (f: string) => void;
    onToggleHideSuppressed: () => void;
    onQueueChange: (q: string) => void;
    labelQueueSelect: string;
    labelQueueSelectAria: string;
    labelHideSuppressedEnabled: string;
    labelHideSuppressedDisabled: string;
    getFilterLabel: (localeKey: string) => string;
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
                        background: 'linear-gradient(135deg, rgba(91,127,255,0.16) 0%, rgba(91,127,255,0.08) 100%)',
                        color: 'var(--accent)', cursor: 'pointer', fontSize: '9px', fontWeight: 800,
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                        boxShadow: '0 8px 18px rgba(91,127,255,0.10)', transition: 'var(--transition)',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 10px 22px rgba(91,127,255,0.16)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 18px rgba(91,127,255,0.10)';
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
    filter,
    hideSuppressed,
    suppressedCount,
    selectedGlobalQueue,
    queueOptions,
    onFilterChange,
    onToggleHideSuppressed,
    onQueueChange,
    labelQueueSelect,
    labelQueueSelectAria,
    labelHideSuppressedEnabled,
    labelHideSuppressedDisabled,
    getFilterLabel,
}: SidebarFilterBarProps) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px 8px', position: 'relative', zIndex: 1 }}>
            {scope === 'personal' ? (
                <>
                    {/* Status filter tabs */}
                    <div style={{ display: 'flex', gap: '3px', flex: 1, minWidth: 0, padding: '3px', borderRadius: '10px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                        {FILTERS.map((f) => (
                            <button
                                type="button"
                                key={f.id}
                                onClick={() => onFilterChange(f.id)}
                                style={{
                                    flex: 1, padding: '6px 0', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                                    background: filter === f.id ? 'var(--accent-muted)' : 'transparent',
                                    color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                                    transition: 'var(--transition)',
                                }}
                            >
                                {getFilterLabel(f.localeKey)}
                            </button>
                        ))}
                    </div>
                    {/* Hide suppressed toggle */}
                    <button
                        type="button"
                        aria-pressed={hideSuppressed}
                        title={hideSuppressed ? labelHideSuppressedEnabled : labelHideSuppressedDisabled}
                        onClick={onToggleHideSuppressed}
                        style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            border: `1px solid ${hideSuppressed ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                            background: hideSuppressed ? 'var(--accent-muted)' : 'var(--bg-card)',
                            color: hideSuppressed ? 'var(--accent)' : 'var(--text-muted)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'var(--transition)',
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path d="M2.5 4h11M5 8h6M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        {suppressedCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-4px', minWidth: '14px', height: '14px', padding: '0 3px',
                                borderRadius: '999px',
                                background: hideSuppressed ? 'var(--accent)' : 'var(--bg-card)',
                                border: `1px solid ${hideSuppressed ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                                color: hideSuppressed ? '#fff' : 'var(--text-muted)',
                                fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8px', fontWeight: 700,
                                lineHeight: '12px', textAlign: 'center',
                            }}>
                                {suppressedCount > 99 ? '99+' : suppressedCount}
                            </span>
                        )}
                    </button>
                </>
            ) : (
                /* Global queue selector */
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', minWidth: 0 }}>
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                        {labelQueueSelect}
                    </span>
                    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                        <select
                            value={selectedGlobalQueue}
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
                </div>
            )}
        </div>
    );
}
