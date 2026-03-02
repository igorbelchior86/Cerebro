'use client';

import { PRIORITY_COLOR, STATUS_CONFIG, STATUS_LABEL, normalizeTicketTitle, normalizeText, formatCreatedAt } from './utils';
import type { ActiveTicket } from './types';

function MetaIcon({ type }: { type: 'clock' | 'company' | 'user' }) {
    const common = { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none' } as const;
    if (type === 'clock') {
        return (
            <svg {...common} aria-hidden="true" role="img" aria-label="Time Icon">
                <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8 4.8V8.1L10.5 9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }
    if (type === 'company') {
        return (
            <svg {...common} aria-hidden="true" role="img" aria-label="Company Icon">
                <path d="M2.5 13.5h11M4.2 13.5V3.2h7.6v10.3M6.3 5.2h.01M9.7 5.2h.01M6.3 7.7h.01M9.7 7.7h.01M6.3 10.2h.01M9.7 10.2h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
        );
    }
    return (
        <svg {...common} aria-hidden="true" role="img" aria-label="User Icon">
            <circle cx="8" cy="5.8" r="2.3" stroke="currentColor" strokeWidth="1.4" />
            <path d="M3.6 13.5c.6-2.1 2.3-3.2 4.4-3.2s3.8 1.1 4.4 3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

interface SidebarTicketCardProps {
    ticket: ActiveTicket;
    idx: number;
    isActive: boolean;
    resolveTicketStatusLabel: (ticket: ActiveTicket) => string;
    onSelect: () => void;
    onOpenStatusEditor: (ticket: ActiveTicket) => void;
    hideSuppressed: boolean;
    labelDefaultIssue: string;
    labelUnknownOrg: string;
    labelSuppressedBadge: string;
    labelSuppressedReasonNoise: string;
    labelJustNow: string;
}

export function SidebarTicketCard({
    ticket,
    idx,
    isActive,
    resolveTicketStatusLabel,
    onSelect,
    onOpenStatusEditor,
    hideSuppressed,
    labelDefaultIssue,
    labelUnknownOrg,
    labelSuppressedBadge,
    labelSuppressedReasonNoise,
    labelJustNow,
}: SidebarTicketCardProps) {
    const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.pending;
    const priority = ticket.priority ?? 'P3';
    const canSelectTicket = !ticket.isDraft;
    const isSuppressed = Boolean(ticket.suppressed);
    const suppressionLabel = normalizeText(ticket.suppression_reason_label ?? ticket.suppression_reason ?? '', labelSuppressedReasonNoise);

    const normalized = {
        priority,
        id: normalizeText(ticket.ticket_number ?? ticket.ticket_id, ticket.id),
        status: STATUS_LABEL[ticket.status] ?? 'PENDING',
        ticketStatus: resolveTicketStatusLabel(ticket),
        title: normalizeTicketTitle(ticket.title, labelDefaultIssue),
        company: normalizeText(ticket.company ?? ticket.org, labelUnknownOrg),
        requester: normalizeText(ticket.requester ?? ticket.site, 'Unknown requester'),
        createdAt: ticket.created_at ?? '',
    };
    const createdAtLabel = formatCreatedAt(normalized.createdAt, ticket.age, labelJustNow);

    return (
        <div
            key={ticket.id}
            role={canSelectTicket ? 'button' : undefined}
            tabIndex={canSelectTicket ? 0 : undefined}
            aria-disabled={canSelectTicket ? undefined : true}
            onClick={() => { if (canSelectTicket) onSelect(); }}
            onKeyDown={(e) => {
                if (!canSelectTicket) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onSelect();
            }}
            className="animate-fadeIn"
            style={{
                position: 'relative', padding: '12px', borderRadius: '12px',
                cursor: canSelectTicket ? 'pointer' : 'default',
                background: isActive ? 'var(--bg-card-active)' : 'var(--bg-card)',
                border: `1px solid ${isActive ? 'var(--border-accent)' : 'var(--bento-outline)'}`,
                boxShadow: isActive ? '0 0 0 1px var(--accent-muted), 0 10px 22px rgba(5,7,11,0.18)' : '0 6px 14px rgba(5,7,11,0.08)',
                textAlign: 'left', overflow: 'hidden', width: '100%',
                animationDelay: `${idx * 0.05}s`,
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', flexShrink: 0,
                transition: 'var(--transition)', opacity: isSuppressed && !isActive ? 0.88 : 1,
            }}
            onMouseEnter={(e) => {
                if (!isActive && canSelectTicket) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card-hover)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 22px rgba(20,24,38,0.2)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }
            }}
            onMouseLeave={(e) => {
                if (!isActive && canSelectTicket) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)';
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(20,24,38,0.12)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                }
            }}
        >
            {isActive && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 0% 50%, var(--accent-glow) 0%, transparent 70%)', pointerEvents: 'none' }} />}
            <div style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: '3px', borderRadius: '0 3px 3px 0', background: PRIORITY_COLOR[priority] ?? '#5B7FFF', opacity: isActive ? 1 : 0.55 }} />

            {/* Top row: priority + id + status badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px', fontWeight: 700, color: PRIORITY_COLOR[priority] ?? '#5B7FFF', letterSpacing: '0.05em', flexShrink: 0 }}>{priority}</span>
                    <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{normalized.id}</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    {isSuppressed && !hideSuppressed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', borderRadius: '999px', fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#C98A1B', background: 'rgba(201,138,27,0.10)', border: '1px solid rgba(201,138,27,0.22)' }}>
                            <svg width="7" height="7" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                                <path d="M2 5h6M4 3h2M4 7h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                            </svg>
                            {labelSuppressedBadge}
                        </span>
                    )}
                    {!ticket.isDraft && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '999px', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                            {normalized.status}
                        </span>
                    )}
                </div>
            </div>

            {/* Title */}
            <p style={{ fontSize: '13px', fontWeight: 650, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.34, letterSpacing: '-0.012em', marginBottom: isSuppressed && !hideSuppressed ? '6px' : '10px', width: '100%', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '34px' }}>
                {normalized.title}
            </p>

            {isSuppressed && !hideSuppressed && (
                <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '8.5px', color: '#C98A1B', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {suppressionLabel}
                    {typeof ticket.suppression_confidence === 'number' ? ` · ${Math.round(ticket.suppression_confidence * 100)}%` : ''}
                </p>
            )}

            {/* Metadata grid */}
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', columnGap: '9px', rowGap: '4px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-faint)', flexShrink: 0 }}>
                    <MetaIcon type="clock" />
                    {createdAtLabel}
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <MetaIcon type="company" />
                    {normalized.company}
                </span>
                {/* Status badge with inline edit button */}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '999px', background: 'var(--bg-card-hover)', border: '1px solid var(--bento-outline)', color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '92px' }}>{normalized.ticketStatus}</span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenStatusEditor(ticket); }}
                            aria-label="Edit ticket status"
                            title="Edit ticket status"
                            style={{ width: '16px', height: '16px', borderRadius: '999px', border: '1px solid var(--bento-outline)', background: 'var(--bg-panel)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                        >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                        </button>
                    </span>
                </span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    <MetaIcon type="user" />
                    {normalized.requester}
                </span>
            </div>
        </div>
    );
}
