// Re-export shim — PlaybookPanel has moved to @/features/chat/playbook/
// All existing import sites continue to work transparently.

export { default } from '@/features/chat/playbook/PlaybookPanel';
export type { PlaybookPanelProps, PlaybookData, ContextItem, Hypothesis, ChecklistItem, EscalateRow } from '@/features/chat/playbook/types';
