'use client';

// ─── Shared types for PlaybookPanel feature module ───────────────

export interface Hypothesis {
    rank: number;
    hypothesis: string;
    confidence: number;
    evidence?: Array<string | { id: string; label?: string }>;
}

export interface ChecklistItem {
    id: string;
    text: string;
    details_md?: string;
}

export interface EscalateRow {
    icon: string;
    text: string;
}

export interface ContextItem {
    key: string;
    val: string;
    highlight?: string;
    editable?: boolean;
}

export interface PlaybookData {
    ticketId?: string;
    context?: ContextItem[];
    hypotheses?: Hypothesis[];
    checklist?: ChecklistItem[];
    escalate?: EscalateRow[];
}

export interface PlaybookPanelProps {
    content: string | null;
    status?: 'loading' | 'ready' | 'error';
    error?: string;
    data?: PlaybookData;
    sessionStatus?: 'pending' | 'processing' | 'approved' | 'failed' | 'needs_more_info' | 'blocked' | undefined;
    children?: React.ReactNode;
    onEditContextItem?: (key: string) => void;
}
