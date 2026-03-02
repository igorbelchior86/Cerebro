'use client';

import SettingsModal from '@/components/SettingsModal';
import UserProfileDropdown from '@/components/UserProfileDropdown';
import ProfileModal from '@/components/ProfileModal';
import { SIDEBAR_HIDE_SUPPRESSED_KEY } from './utils';
import { useSidebarState } from './useSidebarState';
import { SidebarHeader } from './SidebarHeader';
import { SidebarStats, SidebarFilterBar } from './SidebarControls';
import { SidebarTicketCard } from './SidebarTicketCard';
import { StatusEditorModal } from './StatusEditorModal';
import type { ChatSidebarProps } from './types';
import { useTranslations } from 'next-intl';

export type { ActiveTicket } from './types';
export type { ChatSidebarProps } from './types';

export default function ChatSidebar(props: ChatSidebarProps) {
    const t = useTranslations('ChatSidebar');
    const {
        user, userName, userInitials, jobTitle, avatar, updateProfile,
        settingsOpen, setSettingsOpen,
        profileOpen, setProfileOpen,
        filter, setFilter,
        scope, setScope,
        searchQuery, setSearchQuery,
        selectedGlobalQueue, setSelectedGlobalQueue,
        hideSuppressed, setHideSuppressed,
        theme, toggleTheme,
        clock,
        statusEditorTarget,
        statusEditorQuery, setStatusEditorQuery,
        statusEditorLoading, statusEditorSaving, statusEditorError,
        filteredStatusOptions,
        openStatusEditor, closeStatusEditor, handleSelectStatus,
        resolveTicketStatusLabel,
        listRef,
        listLoading,
        suppressedCount, processing,
        visibleTickets,
        queueOptions,
        persistSidebarState,
    } = useSidebarState(props);

    const { onSelectTicket, onCreateTicket, currentTicketId } = props;

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
                    {/* 1. Header (Logo + Search + Clock + Theme) */}
                    <SidebarHeader
                        clock={clock}
                        theme={theme}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onToggleTheme={toggleTheme}
                    />

                    {/* 2. Stats + Scope Switcher */}
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

                    {/* 3. Ticket List Card */}
                    <div style={{ borderRadius: '24px', border: '1px solid var(--bento-outline)', background: 'var(--bg-bento-panel)', boxShadow: 'var(--shadow-card)', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                        {/* Filter Bar */}
                        <SidebarFilterBar
                            scope={scope}
                            filter={filter}
                            hideSuppressed={hideSuppressed}
                            suppressedCount={suppressedCount}
                            selectedGlobalQueue={selectedGlobalQueue}
                            queueOptions={queueOptions}
                            onFilterChange={setFilter}
                            onToggleHideSuppressed={() => setHideSuppressed((prev) => {
                                const next = !prev;
                                localStorage.setItem(SIDEBAR_HIDE_SUPPRESSED_KEY, next ? '1' : '0');
                                return next;
                            })}
                            onQueueChange={setSelectedGlobalQueue}
                            labelQueueSelect={t('globalQueueLabel')}
                            labelQueueSelectAria={t('globalQueueSelectAria')}
                            labelHideSuppressedEnabled={t('hideSuppressedEnabled')}
                            labelHideSuppressedDisabled={t('hideSuppressedDisabled')}
                            getFilterLabel={(key) => t(key)}
                        />

                        {/* Ticket list */}
                        <div
                            ref={listRef}
                            onScroll={(e) => persistSidebarState(filter, (e.currentTarget as HTMLDivElement).scrollTop)}
                            style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 10px', display: 'flex', flexDirection: 'column', gap: '7px', position: 'relative', zIndex: 1 }}
                        >
                            {listLoading && visibleTickets.length === 0 ? (
                                [1, 2].map((i) => <div key={i} style={{ height: '80px', borderRadius: '9px', background: 'var(--bg-card)', border: '1px solid var(--border)', opacity: 0.6 }} />)
                            ) : visibleTickets.length === 0 ? (
                                <p style={{ marginTop: '20px', fontSize: '11px', color: 'var(--text-faint)', textAlign: 'center' }}>{t('noTickets')}</p>
                            ) : visibleTickets.map((ticket, idx) => (
                                <SidebarTicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    idx={idx}
                                    isActive={currentTicketId === ticket.id}
                                    resolveTicketStatusLabel={resolveTicketStatusLabel}
                                    onSelect={() => {
                                        persistSidebarState(filter);
                                        onSelectTicket?.(ticket.id);
                                    }}
                                    onOpenStatusEditor={openStatusEditor}
                                    hideSuppressed={hideSuppressed}
                                    labelDefaultIssue={t('defaultIssue')}
                                    labelUnknownOrg={t('unknownOrg')}
                                    labelSuppressedBadge={t('suppressedBadge')}
                                    labelSuppressedReasonNoise={t('suppressedReasonNoise')}
                                    labelJustNow={t('justNow')}
                                />
                            ))}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1, minHeight: '60px' }}>
                            <UserProfileDropdown
                                userName={userName}
                                userRole={jobTitle}
                                userInitials={userInitials}
                                userAvatar={avatar ?? null}
                                onOpenSettings={() => setSettingsOpen(true)}
                                onEditProfile={() => setProfileOpen(true)}
                            />
                        </div>
                    </div>
                </div>
            </aside>

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
