// This file is a re-export shim. The ChatSidebar component has been moved to
// @/features/chat/sidebar/ as part of the Phase 4 frontend consolidation.
// Existing imports pointing here will continue to work transparently.

export { default } from '@/features/chat/sidebar/ChatSidebar';
export type { ActiveTicket, ChatSidebarProps } from '@/features/chat/sidebar/types';
