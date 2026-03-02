'use client';

import { SectionLabel } from './primitives';
import type { EscalateRow } from './types';

interface PlaybookEscalateProps {
    rows: EscalateRow[];
}

export function PlaybookEscalate({ rows }: PlaybookEscalateProps) {
    if (rows.length === 0) return null;

    return (
        <div style={{ marginBottom: '22px' }}>
            <SectionLabel>Escalate when</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {rows.map((r, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex', gap: '8px', alignItems: 'flex-start',
                            padding: '9px 11px', borderRadius: '7px',
                            background: 'rgba(248,113,113,0.05)',
                            border: '1px solid rgba(248,113,113,0.12)',
                        }}
                    >
                        <span style={{ fontSize: '11px', flexShrink: 0, marginTop: '1px' }}>{r.icon}</span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{r.text}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
