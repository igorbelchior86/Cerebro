'use client';

import type { AutotaskPicklistOption } from '@/lib/p0-ui-client';

interface StatusEditorModalProps {
    statusEditorQuery: string;
    onQueryChange: (v: string) => void;
    filteredStatusOptions: AutotaskPicklistOption[];
    statusEditorLoading: boolean;
    statusEditorSaving: boolean;
    statusEditorError: string;
    onClose: () => void;
    onSelectStatus: (option: AutotaskPicklistOption) => void;
}

export function StatusEditorModal({
    statusEditorQuery,
    onQueryChange,
    filteredStatusOptions,
    statusEditorLoading,
    statusEditorSaving,
    statusEditorError,
    onClose,
    onSelectStatus,
}: StatusEditorModalProps) {
    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(8, 12, 20, 0.34)',
                backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 80, padding: '18px',
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(560px, 100%)', borderRadius: '22px',
                    border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)',
                    boxShadow: '0 24px 60px rgba(8, 12, 20, 0.26)', padding: '18px',
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Edit Ticket Status</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Source: Autotask ticket status metadata</div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ width: '28px', height: '28px', borderRadius: '999px', border: '1px solid var(--bento-outline)', background: 'var(--bg-card)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                {/* Search */}
                <input
                    type="text"
                    value={statusEditorQuery}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Type to search status..."
                    style={{ width: '100%', height: '42px', borderRadius: '14px', border: '1px solid var(--bento-outline)', background: 'var(--bg-card)', color: 'var(--text-primary)', padding: '0 12px', outline: 'none', fontSize: '12px', marginBottom: '12px' }}
                />

                {statusEditorError && (
                    <div style={{ color: '#EF4444', fontSize: '11px', lineHeight: 1.5, marginBottom: '10px' }}>{statusEditorError}</div>
                )}

                {/* Options list */}
                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {statusEditorLoading ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Loading ticket statuses...</div>
                    ) : filteredStatusOptions.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelectStatus(option)}
                            disabled={statusEditorSaving}
                            style={{
                                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: '12px',
                                border: '1px solid var(--bento-outline)', background: 'var(--bg-card)',
                                color: 'var(--text-primary)', cursor: statusEditorSaving ? 'wait' : 'pointer',
                                fontSize: '11.5px', fontWeight: 600,
                            }}
                        >
                            {option.label}
                        </button>
                    ))}
                    {!statusEditorLoading && filteredStatusOptions.length === 0 && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No matching statuses.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
