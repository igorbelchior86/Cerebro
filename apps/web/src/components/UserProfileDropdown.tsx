'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface UserProfileDropdownProps {
    userName: string;
    userRole?: string;
    userInitials: string;
    userAvatar?: string | null;
    onOpenSettings: () => void;
    onEditProfile: () => void;
}

export default function UserProfileDropdown({
    userName,
    userRole,
    userInitials,
    userAvatar,
    onOpenSettings,
    onEditProfile,
}: UserProfileDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const t = useTranslations('UserProfileDropdown');

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        try {
            await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
            document.cookie = 'pb_session=; Max-Age=0; path=/';
            router.push('/login');
        } catch (err) {
            console.error(t('logoutFailed'), err);
            router.push('/login');
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '11px 15px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: isOpen ? 'var(--bg-card-active, rgba(255,255,255,0.05))' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                    textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                    if (!isOpen) e.currentTarget.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.03))';
                }}
                onMouseLeave={(e) => {
                    if (!isOpen) e.currentTarget.style.background = 'transparent';
                }}
            >
                <div
                    style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: userAvatar ? `url(${userAvatar}) center/cover` : 'linear-gradient(135deg, var(--accent), #8fa999)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        color: 'white',
                        flexShrink: 0
                    }}
                >
                    {!userAvatar && userInitials}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {userName}
                    </div>
                    {userRole && (
                        <div style={{
                            fontFamily: 'var(--font-jetbrains-mono, monospace)',
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase'
                        }}>
                            {userRole}
                        </div>
                    )}
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '8px',
                        width: '280px',
                        background: '#202123', // ChatGPT dark theme tone
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '8px',
                        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: 'fadeIn 0.15s ease-out'
                    }}
                >
                    <button
                        onClick={() => { setIsOpen(false); onEditProfile(); }}
                        style={{ padding: '8px 12px 12px', border: 'none', background: 'transparent', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', cursor: 'pointer', borderRadius: '8px 8px 0 0', outline: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: userAvatar ? `url(${userAvatar}) center/cover` : 'linear-gradient(135deg, var(--accent), #8fa999)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                            {!userAvatar && userInitials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ececf1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userName}</div>
                            <div style={{ fontSize: '11px', color: '#8e8ea0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userRole}</div>
                        </div>
                    </button>

                    <MenuItem icon={<IconSettings />} label={t('settings')} onClick={() => { setIsOpen(false); onOpenSettings(); }} />

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

                    <MenuItem icon={<IconLogout />} label={t('logout')} onClick={handleLogout} />
                </div>
            )}
        </div>
    );
}

// Subcomponents

function MenuItem({ icon, label, onClick, hasArrow }: { icon: React.ReactNode, label: string, onClick?: () => void, hasArrow?: boolean }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: '#ececf1',
                fontSize: '13.5px',
                textAlign: 'left',
                transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e8ea0', width: '20px' }}>
                {icon}
            </div>
            <span style={{ flex: 1 }}>{label}</span>
            {hasArrow && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8e8ea0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            )}
        </button>
    );
}

// Icons
const IconSettings = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);
const IconLogout = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);
