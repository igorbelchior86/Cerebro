// Shared utilities and constants for the ChatSidebar feature module.

import type { ActiveTicket } from './types';

export const SIDEBAR_STATE_KEY = 'chatSidebarState.v2';
export const SIDEBAR_HIDE_SUPPRESSED_KEY = 'chatSidebarHideSuppressed.v1';
export const API = process.env.NEXT_PUBLIC_API_URL || '/api';
export const GLOBAL_QUEUE_FALLBACKS = ['Service Desk', 'Escalations', 'Projects'];

export const PRIORITY_COLOR: Record<string, string> = {
    P1: '#F97316',
    P2: '#EAB308',
    P3: '#5B7FFF',
    P4: 'var(--bento-outline)',
};

export const STATUS_CONFIG = {
    completed: { color: 'var(--green)', bg: 'var(--green-muted)', border: 'var(--green-border)', dot: 'var(--green)', localeKey: 'statusDone', pulse: false },
    processing: { color: 'var(--accent)', bg: 'var(--accent-muted)', border: 'var(--border-accent)', dot: 'var(--accent)', localeKey: 'statusProcessing', pulse: true },
    pending: { color: 'var(--yellow)', bg: 'rgba(234,179,8,0.10)', border: 'rgba(234,179,8,0.22)', dot: 'var(--yellow)', localeKey: 'statusPending', pulse: true },
    failed: { color: 'var(--red)', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)', dot: 'var(--red)', localeKey: 'statusFailed', pulse: false },
};

export const STATUS_LABEL: Record<ActiveTicket['status'], string> = {
    completed: 'DONE',
    processing: 'PROCESSING',
    pending: 'WAITING',
    failed: 'FAILED',
};

export const FILTERS = [
    { id: 'all', localeKey: 'filterAll' },
    { id: 'processing', localeKey: 'statusProcessing' },
    { id: 'completed', localeKey: 'statusDone' },
    { id: 'failed', localeKey: 'statusFailed' },
];
export const FILTER_IDS = new Set(FILTERS.map((f) => f.id));

const HTML_ENTITY_MAP: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
};

export function normalizeText(value?: string, fallback = ''): string {
    const raw = (value ?? '').trim();
    if (!raw) return fallback;

    const withoutTags = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');
    const decoded = withoutTags.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => HTML_ENTITY_MAP[m] ?? ' ');
    return decoded.replace(/\s+/g, ' ').trim() || fallback;
}

export function normalizeTicketTitle(value?: string, fallback = ''): string {
    const normalized = normalizeText(value, fallback);
    return normalized.replace(/\s+Description\s*:\s*.*$/i, '').trim() || fallback;
}

export function formatCreatedAt(createdAt?: string, age?: string, justNowFallback = 'just now'): string {
    if (age && age.trim() !== '') return normalizeText(age, justNowFallback);
    if (!createdAt) return justNowFallback;
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return justNowFallback;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
