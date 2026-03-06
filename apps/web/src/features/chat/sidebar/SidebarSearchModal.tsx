'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

interface SidebarSearchModalProps {
    open: boolean;
    onClose: () => void;
    searchQuery: string;
    onSearchChange: (v: string) => void;
}

export function SidebarSearchModal({ open, onClose, searchQuery, onSearchChange }: SidebarSearchModalProps) {
    const t = useTranslations('ChatSidebar');
    const inputRef = useRef<HTMLInputElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open) {
            // Small delay to ensure the modal is rendered before focusing
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [open]);

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!open) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                background: 'rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                animation: 'animate-in fade-in duration-200',
            }}
            onClick={onClose}
        >
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '600px',
                    background: 'var(--bg-elevated)',
                    borderRadius: '24px',
                    border: '1px solid var(--border-strong)',
                    boxShadow: '0 32px 64px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    animation: 'animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 cubic-bezier(0.16, 1, 0.3, 1)',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: 'var(--text-muted)' }}>
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.6" />
                            <path d="M10.5 10.5L13.6 13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                    </div>
                    <input
                        ref={inputRef}
                        type="search"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search tickets, customers, or analysis..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: '18px',
                            fontFamily: 'var(--font-dm-sans, sans-serif)',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onClose();
                        }}
                    />
                    <button
                        onClick={onClose}
                        style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--bento-outline)',
                            color: 'var(--text-muted)',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontFamily: 'var(--font-jetbrains-mono, monospace)',
                        }}
                    >
                        ESC
                    </button>
                </div>

                {searchQuery.length === 0 ? (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Recent Searches
                        </div>
                        <div style={{ color: 'var(--text-faint)', fontSize: '13px', padding: '12px', border: '1px dashed var(--bento-outline)', borderRadius: '12px', textAlign: 'center' }}>
                            No recent searches found.
                        </div>
                    </div>
                ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Searching for "{searchQuery}"...
                    </div>
                )}
            </div>
        </div>
    );
}
