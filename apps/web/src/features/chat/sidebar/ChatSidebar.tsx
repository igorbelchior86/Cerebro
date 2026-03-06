'use client';

import { useMemo } from 'react';
import SettingsModal from '@/components/SettingsModal';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import ProfileModal from '@/components/ProfileModal';
import ThemeToggle from '@/components/ThemeToggle';
import { useSidebarState } from './useSidebarState';
import { SidebarHeader } from './SidebarHeader';
import { SidebarStats, SidebarFilterBar } from './SidebarControls';
import { SidebarSearchModal } from './SidebarSearchModal';
import { SidebarTicketCard } from './SidebarTicketCard';
import { StatusEditorModal } from './StatusEditorModal';
import type { ActiveTicket, ChatSidebarProps } from './types';
import { useLocale, useTranslations } from 'next-intl';

export type { ActiveTicket } from './types';
export type { ChatSidebarProps } from './types';

type TicketGroup = {
    key: string;
    label: string;
    tickets: ActiveTicket[];
};

function toLocalDayStart(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildTicketDayGroupLabel(
    createdAtRaw: string | undefined,
    locale: string,
    labels: { today: string; yesterday: string; noDate: string }
): { key: string; label: string } {
    const timestamp = Date.parse(String(createdAtRaw || ''));
    if (!Number.isFinite(timestamp)) return { key: 'undated', label: labels.noDate };
    const ticketDate = new Date(timestamp);
    const ticketDay = toLocalDayStart(ticketDate);
    const today = toLocalDayStart(new Date());
    const dayDiff = Math.round((today.getTime() - ticketDay.getTime()) / 86_400_000);
    const key = `${ticketDay.getFullYear()}-${String(ticketDay.getMonth() + 1).padStart(2, '0')}-${String(ticketDay.getDate()).padStart(2, '0')}`;
    if (dayDiff === 0) return { key, label: labels.today };
    if (dayDiff === 1) return { key, label: labels.yesterday };
    const full = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(ticketDate);
    return { key, label: full };
}

export default function ChatSidebar(props: ChatSidebarProps) {
    const t = useTranslations('ChatSidebar');
    const locale = useLocale();
    const {
        user, userName, userInitials, jobTitle, avatar, updateProfile,
        settingsOpen, setSettingsOpen,
        profileOpen, setProfileOpen,
        scope, setScope,
        searchQuery, setSearchQuery,
        selectedPersonalQueue, setSelectedPersonalQueue,
        selectedGlobalQueue, setSelectedGlobalQueue,
        hideSuppressed,
        clock,
        theme, toggleTheme,
        isSearchOpen, setIsSearchOpen,
        statusEditorTarget,
        statusEditorQuery, setStatusEditorQuery,
        statusEditorLoading, statusEditorSaving, statusEditorError,
        filteredStatusOptions,
        openStatusEditor, closeStatusEditor, handleSelectStatus,
        resolveTicketStatusLabel,
        listRef,
        listLoading,
        processing,
        visibleTickets,
        queueOptions,
        statusFilterOptions,
        hiddenStatusKeys,
        toggleStatusFilter,
        resetStatusFilter,
        unselectStatusFilter,
        persistSidebarState,
    } = useSidebarState(props);

    const { onSelectTicket, onCreateTicket, currentTicketId } = props;
    const groupedTickets = useMemo<TicketGroup[]>(() => {
        const groups: TicketGroup[] = [];
        for (const ticket of visibleTickets) {
            const grouping = buildTicketDayGroupLabel(ticket.created_at, locale, {
                today: t('dateToday'),
                yesterday: t('dateYesterday'),
                noDate: t('dateNoDate'),
            });
            const currentGroup = groups[groups.length - 1];
            if (currentGroup && currentGroup.key === grouping.key) {
                currentGroup.tickets.push(ticket);
                continue;
            }
            groups.push({ key: grouping.key, label: grouping.label, tickets: [ticket] });
        }
        return groups;
    }, [locale, t, visibleTickets]);

    return (
        <>
            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} onToggleTheme={toggleTheme} />
            <ProfileModal
                open={profileOpen}
                onClose={() => setProfileOpen(false)}
                currentName={userName}
                currentJobTitle={String(user?.preferences?.jobTitle || '')}
                currentAvatar={avatar ?? null}
                onSave={async (name, newJobTitle, file) => {
                    let base64Avatar = avatar;
                    if (file) {
                        base64Avatar = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => resolve(reader.result as string);
                            reader.onerror = reject;
                        });
                    }
                    await updateProfile({
                        name,
                        avatar: base64Avatar ?? null,
                        preferences: { ...(user?.preferences || {}), jobTitle: newJobTitle },
                    });
                }}
            />

            <aside style={{ width: '100%', minWidth: 0, flexShrink: 0, background: 'transparent', display: 'flex', flexDirection: 'column', position: 'relative', height: '100%' }}>
                {/* Ambient glow */}
                <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'var(--glow-sidebar)', pointerEvents: 'none', zIndex: 0 }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0, padding: 0 }}>
                    {/* 1. Control Hub (Unified Header & Stats) */}
                    <div style={{
                        margin: '0 0px',
                        borderRadius: '24px',
                        border: '1px solid var(--bento-outline)',
                        background: 'var(--bg-bento-panel)',
                        boxShadow: 'var(--shadow-card)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        flexShrink: 0
                    }}>
                        <SidebarHeader
                            searchQuery={searchQuery}
                            onSearchClick={() => setIsSearchOpen(true)}
                        />
                        <SidebarStats
                            processing={processing}
                            scope={scope}
                            onCreateTicket={() => {
                                const returnTicketId = visibleTickets[0]?.id;
                                onCreateTicket?.(returnTicketId ? { returnTicketId } : undefined);
                            }}
                            onSetScope={setScope}
                            labelPersonal={t('scopePersonal')}
                            labelGlobal={t('scopeGlobal')}
                            labelNewTicket={t('newTicket')}
                            labelActive={t('statActive')}
                        />
                    </div>

                    {/* 3. Ticket List Card */}
                    <div style={{ borderRadius: '24px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        {/* Filter Bar */}
                        <SidebarFilterBar
                            scope={scope}
                            selectedQueue={scope === 'personal' ? selectedPersonalQueue : selectedGlobalQueue}
                            queueOptions={queueOptions}
                            statusFilterOptions={statusFilterOptions}
                            hiddenStatusKeys={hiddenStatusKeys}
                            onQueueChange={(nextQueue) => {
                                if (scope === 'personal') {
                                    setSelectedPersonalQueue(nextQueue);
                                    return;
                                }
                                setSelectedGlobalQueue(nextQueue);
                            }}
                            onToggleStatusFilter={toggleStatusFilter}
                            onResetStatusFilter={resetStatusFilter}
                            onUnselectStatusFilter={unselectStatusFilter}
                            labelQueueSelect={t('globalQueueLabel')}
                            labelQueueSelectAria={t('globalQueueSelectAria')}
                            labelGlobalStatusFilterAria={t('globalStatusFilterAria')}
                            labelGlobalStatusFilterTitle={t('globalStatusFilterTitle')}
                            labelGlobalStatusFilterReset={t('globalStatusFilterReset')}
                            labelGlobalStatusFilterNoStatus={t('globalStatusFilterNoStatus')}
                            labelActive={t('statActive')}
                            count={processing}
                        />

                        {/* Ticket list */}
                        <div
                            ref={listRef}
                            onScroll={(e) => {
                                const nextTop = (e.currentTarget as HTMLDivElement).scrollTop;
                                persistSidebarState(nextTop);
                            }}
                            style={{ flex: 1, overflowY: 'auto', padding: '0px 10px 10px', display: 'flex', flexDirection: 'column', gap: '7px', position: 'relative', zIndex: 1 }}
                        >
                            {listLoading && visibleTickets.length === 0 ? (
                                [1, 2].map((i) => <div key={i} style={{ height: '80px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6 }} />)
                            ) : visibleTickets.length === 0 ? (
                                <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center' }}>{t('noTickets')}</p>
                            ) : (() => {
                                let runningIndex = 0;
                                return groupedTickets.map((group, groupIndex) => (
                                    <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <div
                                            style={{
                                                position: 'sticky',
                                                top: '0px', // Snaps exactly to the top edge now that container paddingTop is 0
                                                zIndex: 4,
                                                background: 'var(--bg-bento-shell)', // Theme-adaptive glass background
                                                backdropFilter: 'blur(24px)', // Powerful blur to solidly hide text scrolling behind
                                                WebkitBackdropFilter: 'blur(24px)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '10.5px',
                                                fontWeight: 800,
                                                letterSpacing: '0.08em',
                                                textTransform: 'uppercase',
                                                padding: '8px 14px',
                                                margin: groupIndex === 0 ? '0 -10px 4px -10px' : '4px -10px 4px -10px',
                                                borderBottom: '1px solid var(--bento-outline)',
                                                borderTop: groupIndex !== 0 ? '1px solid var(--bento-outline)' : 'none',
                                                borderBottomLeftRadius: '0px',
                                                borderBottomRightRadius: '0px',
                                            }}
                                        >
                                            {group.label}
                                        </div>
                                        {group.tickets.map((ticket) => {
                                            const idx = runningIndex;
                                            runningIndex += 1;
                                            return (
                                                <SidebarTicketCard
                                                    key={ticket.id}
                                                    ticket={ticket}
                                                    idx={idx}
                                                    isActive={currentTicketId === ticket.id}
                                                    resolveTicketStatusLabel={resolveTicketStatusLabel}
                                                    onSelect={() => {
                                                        persistSidebarState();
                                                        onSelectTicket?.(ticket.id);
                                                    }}
                                                    onOpenStatusEditor={openStatusEditor}
                                                    hideSuppressed={hideSuppressed}
                                                    labelDefaultIssue={t('defaultIssue')}
                                                    labelSuppressedBadge={t('suppressedBadge')}
                                                    labelSuppressedReasonNoise={t('suppressedReasonNoise')}
                                                    labelJustNow={t('justNow')}
                                                />
                                            );
                                        })}
                                    </div>
                                ));
                            })()}
                        </div>

                        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--bento-outline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', position: 'relative', zIndex: 1, minHeight: '54px' }}>
                            <UserProfileDropdown
                                userName={userName}
                                userRole={jobTitle}
                                userInitials={userInitials}
                                userAvatar={avatar ?? null}
                                onOpenSettings={() => setSettingsOpen(true)}
                                onEditProfile={() => setProfileOpen(true)}
                            />

                            {/* Minimalist Footer Utilities (Vertical Stack) */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 10px',
                                borderRadius: '14px',
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px solid var(--bento-outline)',
                                minWidth: '54px'
                            }}>
                                <div style={{
                                    height: '20px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontFamily: 'var(--font-jetbrains-mono, monospace)', fontSize: '9px',
                                    color: 'var(--text-muted)', letterSpacing: '0.04em',
                                    fontWeight: 600
                                }}>
                                    {clock}
                                </div>
                                <div style={{ width: '12px', height: '1px', background: 'var(--bento-outline)' }} />
                                <ThemeToggle theme={theme} onToggle={toggleTheme} size="sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Sidebar Search Modal */}
            <SidebarSearchModal
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
            />

            {/* Status Editor Modal */}
            {statusEditorTarget && (
                <StatusEditorModal
                    statusEditorQuery={statusEditorQuery}
                    onQueryChange={setStatusEditorQuery}
                    filteredStatusOptions={filteredStatusOptions}
                    statusEditorLoading={statusEditorLoading}
                    statusEditorSaving={statusEditorSaving}
                    statusEditorError={statusEditorError}
                    onClose={closeStatusEditor}
                    onSelectStatus={(option) => { void handleSelectStatus(option); }}
                />
            )}
        </>
    );
}
