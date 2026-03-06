import CerebroLogo from '@/components/CerebroLogo';

interface SidebarHeaderProps {
    searchQuery: string;
    onSearchClick: () => void;
}

export function SidebarHeader({ searchQuery, onSearchClick }: SidebarHeaderProps) {
    return (
        <div style={{ padding: '14px 14px 8px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                {/* 1. Brand Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                        border: '1px solid var(--bento-outline)', boxShadow: 'var(--shadow-card)', flexShrink: 0
                    }}>
                        <CerebroLogo size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{
                            fontSize: '16px', lineHeight: 1, fontWeight: 700,
                            color: 'var(--text-primary)', letterSpacing: '-0.03em'
                        }}>Cerebro</div>
                    </div>
                </div>

                {/* 2. Utility Hub (Search Only) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        type="button"
                        onClick={onSearchClick}
                        style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            border: '1px solid var(--bento-outline)', background: 'var(--bg-card)',
                            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--bento-outline)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                        aria-label="Search"
                        title="Search (Click to open)"
                    >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M10.5 10.5L13.6 13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        {searchQuery.length > 0 && (
                            <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg-card)' }} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
