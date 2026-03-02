'use client';

import CerebroLogo from '@/components/CerebroLogo';
import ThemeToggle from '@/components/ThemeToggle';

interface SidebarHeaderProps {
    clock: string;
    theme: 'dark' | 'light';
    searchQuery: string;
    onSearchChange: (v: string) => void;
    onToggleTheme: () => void;
}

export function SidebarHeader({ clock, theme, searchQuery, onSearchChange, onToggleTheme }: SidebarHeaderProps) {
    return (
        <div style={{ borderRadius: '24px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '16px 14px 12px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    {/* Logo */}
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))', border: '1px solid var(--bento-outline)', boxShadow: 'var(--shadow-card)', flexShrink: 0 }}>
                        <CerebroLogo size={20} />
                    </div>
                    <div style={{ minWidth: 0, marginRight: '4px' }}>
                        <div style={{ fontSize: '14px', lineHeight: 1, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Cerebro</div>
                    </div>
                    {/* Search field */}
                    <label
                        style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', transition: 'var(--transition)' }}
                        onMouseEnter={(e) => {
                            const input = e.currentTarget.querySelector('input');
                            if (input) {
                                input.style.borderColor = 'var(--border-accent)';
                                input.style.background = 'var(--bg-card-hover)';
                                input.style.boxShadow = '0 6px 16px rgba(20,24,38,0.12)';
                                input.style.transform = 'translateY(-1.5px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            const input = e.currentTarget.querySelector('input');
                            if (input && document.activeElement !== input) {
                                input.style.borderColor = 'var(--bento-outline)';
                                input.style.background = 'var(--bg-card)';
                                input.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02)';
                                input.style.transform = 'translateY(0)';
                            }
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }}>
                            <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.4" />
                            <path d="M10.5 10.5L13.6 13.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Search"
                            aria-label="Search tickets"
                            style={{
                                width: '100%',
                                height: '34px',
                                borderRadius: '17px',
                                border: '1px solid var(--bento-outline)',
                                background: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                padding: '0 11px 0 30px',
                                fontSize: '12.5px',
                                outline: 'none',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.02)',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                            onFocus={(e) => {
                                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border-accent)';
                                (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 3px var(--accent-glow), 0 4px 12px rgba(20,24,38,0.1)';
                                (e.currentTarget as HTMLInputElement).style.transform = 'translateY(0)';
                            }}
                            onBlur={(e) => {
                                (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--bento-outline)';
                                (e.currentTarget as HTMLInputElement).style.boxShadow = '0 2px 5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.02)';
                            }}
                        />
                    </label>
                </div>
                {/* Clock and theme toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--bento-outline)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
                            <path d="M8 4.8V8l2.4 1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span style={{ fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9.5px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                            {clock}
                        </span>
                    </span>
                    <ThemeToggle theme={theme} onToggle={onToggleTheme} size="sm" />
                </div>
            </div>
        </div>
    );
}
