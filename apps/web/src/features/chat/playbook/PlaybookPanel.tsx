'use client';

import MarkdownRenderer from '@/components/MarkdownRenderer';
import { PlaybookContext } from './PlaybookContext';
import { PlaybookHypotheses } from './PlaybookHypotheses';
import { PlaybookChecklist } from './PlaybookChecklist';
import { PlaybookEscalate } from './PlaybookEscalate';
import type { PlaybookPanelProps, ChecklistItem } from './types';

export default function PlaybookPanel({
    content,
    status = 'ready',
    data,
    sessionStatus,
    children,
    onEditContextItem,
}: PlaybookPanelProps) {
    const ctx = data?.context ?? [];
    const hyps = data?.hypotheses ?? [];
    const chk: ChecklistItem[] = data?.checklist?.length
        ? data.checklist.map((item, i) => {
            const out: ChecklistItem = { id: item.id || `c${i}`, text: item.text };
            if (item.details_md) out.details_md = item.details_md;
            return out;
        })
        : [];
    const esc = data?.escalate ?? [];

    return (
        <div
            className="animate-slideInRight"
            style={{
                width: '100%', height: '100%', minWidth: 0, minHeight: 0,
                flexShrink: 0, background: 'transparent',
                display: 'flex', flexDirection: 'column',
                position: 'relative', overflow: 'hidden',
            }}
        >
            {/* Background glow */}
            <div style={{
                position: 'absolute', top: '-60px', right: '-80px',
                width: '280px', height: '280px', borderRadius: '50%',
                background: 'var(--glow-playbook)', pointerEvents: 'none', zIndex: 0,
            }} />

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 12px 14px', position: 'relative', zIndex: 1 }}>
                <PlaybookContext items={ctx} {...(onEditContextItem ? { onEditContextItem } : {})} />
                <PlaybookHypotheses hypotheses={hyps} />
                <PlaybookChecklist items={chk} />
                <PlaybookEscalate rows={esc} />

                {chk.length === 0 && hyps.length === 0 && content && sessionStatus === 'approved' && status === 'ready' && (
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                        <MarkdownRenderer content={content} />
                    </div>
                )}
            </div>

            {children && (
                <div style={{
                    padding: '12px 18px', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: '8px', flexShrink: 0,
                    position: 'relative', zIndex: 1,
                }}>
                    {children}
                </div>
            )}
        </div>
    );
}
