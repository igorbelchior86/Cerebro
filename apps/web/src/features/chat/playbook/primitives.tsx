'use client';

// ─── Shared primitive UI components for PlaybookPanel ────────────

export function ShimmerBlock({ width = '100%', height = 10, radius = 6 }: { width?: string; height?: number; radius?: number }) {
    return (
        <div
            style={{
                width,
                height,
                borderRadius: `${radius}px`,
                background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 37%, rgba(255,255,255,0.04) 63%)',
                backgroundSize: '400% 100%',
                animation: 'shimmer 1.4s ease infinite',
            }}
        />
    );
}

export function confColor(c: number): string {
    if (c >= 0.7) return '#1DB98A';
    if (c >= 0.45) return '#EAB308';
    return 'rgba(228,234,248,0.28)';
}

export function CollapseToggleButton({
    isOpen,
    onToggle,
    expandedDirection = 'down',
}: {
    isOpen: boolean;
    onToggle: () => void;
    expandedDirection?: 'down' | 'up';
}) {
    const openRotation = expandedDirection === 'down' ? 'rotate(0deg)' : 'rotate(-180deg)';
    const closedRotation = expandedDirection === 'down' ? 'rotate(-180deg)' : 'rotate(0deg)';

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--bento-outline)',
                color: 'var(--accent)',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                position: 'relative',
                overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(91, 127, 255, 0.15), 0 4px 12px rgba(91, 127, 255, 0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--bento-outline)';
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
            title={isOpen ? 'Collapse' : 'Expand'}
        >
            <div style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(circle at center, rgba(91,127,255,0.12) 0%, transparent 80%)',
                opacity: 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
            }} />
            <svg
                width="10"
                height="10"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                    transform: isOpen ? openRotation : closedRotation,
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
    );
}

export function SectionLabel({ children, onToggle, isOpen }: { children: React.ReactNode; onToggle?: () => void; isOpen?: boolean }) {
    return (
        <div style={{
            fontFamily: 'var(--font-jetbrains-mono, monospace)',
            fontSize: '8.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--text-faint)',
            marginBottom: '10px',
            paddingBottom: '7px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 10,
        }}>
            {children}
            {onToggle && typeof isOpen === 'boolean' ? <CollapseToggleButton isOpen={isOpen} onToggle={onToggle} /> : null}
        </div>
    );
}

export function CategoryIcon({ category, size = 12 }: { category: string; size?: number }) {
    const iconProps = { width: size, height: size, strokeWidth: 2, stroke: 'currentColor', fill: 'none' };
    switch (category) {
        case 'Hardware':
            return (
                <svg {...iconProps} viewBox="0 0 24 24">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
            );
        case 'Network':
            return (
                <svg {...iconProps} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            );
        case 'Identity':
            return (
                <svg {...iconProps} viewBox="0 0 24 24">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            );
        case 'Security':
            return (
                <svg {...iconProps} viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
            );
        default:
            return (
                <svg {...iconProps} viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            );
    }
}

export function hypothesisCategory(text: string): string {
    const t = String(text || '').toLowerCase();
    if (/(laptop|monitor|display|usb|driver|hardware|dock)/.test(t)) return 'Hardware';
    if (/(network|vpn|dns|interface|latency|internet|connect)/.test(t)) return 'Network';
    if (/(user|identity|login|requester|account|mfa)/.test(t)) return 'Identity';
    if (/(security|defender|edr|xdr|malware|phish)/.test(t)) return 'Security';
    return 'Operational';
}

export function confidenceTone(c: number): { label: string; color: string; bg: string; border: string } {
    if (c >= 0.8) return { label: 'High', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.28)' };
    if (c >= 0.65) return { label: 'Medium', color: '#EAB308', bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.26)' };
    return { label: 'Low', color: '#5B7FFF', bg: 'rgba(91,127,255,0.1)', border: 'rgba(91,127,255,0.28)' };
}

export function formatEvidenceChipLabel(raw: string | { id: string; label?: string }): string {
    const value = typeof raw === 'string' ? raw : String(raw?.id || '').trim();
    const explicit = typeof raw === 'string' ? '' : String(raw?.label || '').trim();
    if (explicit) return explicit;
    if (!value) return 'Evidence';

    if (value.startsWith('fact-ticket-')) return 'Ticket evidence';
    if (value.startsWith('fact-device-')) return 'Device evidence';
    if (value.startsWith('fact-actor-')) return 'Actor evidence';
    if (value.startsWith('fact-doc-')) return 'Documentation evidence';
    if (value.startsWith('fact-signal-')) {
        if (value.includes('ninja-iface')) return 'Ninja network interface signal';
        if (value.includes('ninja-sw')) return 'Ninja software signal';
        return 'Operational signal';
    }
    if (value.startsWith('fact-conflict-')) return 'Data conflict signal';
    if (value.startsWith('fact-provider-')) return 'Provider evidence';

    return value.length > 44 ? `${value.slice(0, 41)}...` : value;
}

export function cleanTitle(text: string): string {
    return text
        .replace(/^([\s*_]*)(?:\[H\d+\]|\[rank\s*\d+\]|\(\d+\))\s*/gi, '$1')
        .trim();
}
