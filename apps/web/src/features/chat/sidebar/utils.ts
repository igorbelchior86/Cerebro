// Shared utilities and constants for the ChatSidebar feature module.

import type { ActiveTicket } from './types';

export const SIDEBAR_STATE_KEY = 'chatSidebarState.v2';
export const SIDEBAR_HIDE_SUPPRESSED_KEY = 'chatSidebarHideSuppressed.v1';
export const API = process.env.NEXT_PUBLIC_API_URL || '/api';
export const GLOBAL_QUEUE_FALLBACKS = ['Service Desk', 'Escalations', 'Projects'];

export const PRIORITY_COLOR: Record<string, string> = {
    P1: '#F97316',
    P2: '#EAB308',
    P3: 'var(--accent)',
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
    if (!createdAt) {
        if (age && age.trim() !== '') return normalizeText(age, justNowFallback);
        return justNowFallback;
    }
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
        if (age && age.trim() !== '') return normalizeText(age, justNowFallback);
        return justNowFallback;
    }
    const now = new Date();
    const isToday =
        date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();

    const timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeLabel;
    const dateLabel = date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
    return `${dateLabel} ${timeLabel}`;
}

function parseFiniteTimestamp(value: unknown): number | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) return undefined;
    return timestamp;
}

function parseTicketNumberDate(value: unknown): number | undefined {
    const raw = String(value ?? '').trim();
    if (!raw) return undefined;
    const match = raw.match(/T(\d{4})(\d{2})(\d{2})\.\d+/i);
    if (!match) return undefined;
    const [, yearRaw, monthRaw, dayRaw] = match;
    if (!yearRaw || !monthRaw || !dayRaw) return undefined;

    const year = Number.parseInt(yearRaw, 10);
    const month = Number.parseInt(monthRaw, 10);
    const day = Number.parseInt(dayRaw, 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
    return Date.UTC(year, month - 1, day, 0, 0, 0, 0);
}

function parseTicketSequence(value: unknown): number {
    const raw = String(value ?? '').trim();
    if (!raw) return -1;
    const match = raw.match(/T\d{8}\.(\d+)/i);
    if (!match) return -1;
    const sequenceRaw = match[1];
    if (!sequenceRaw) return -1;
    const sequence = Number.parseInt(sequenceRaw, 10);
    return Number.isFinite(sequence) ? sequence : -1;
}

export function resolveTicketChronology(ticket: ActiveTicket): {
    timestamp: number;
    hasCanonicalTimestamp: boolean;
    sequence: number;
} {
    const canonicalTimestamp = parseFiniteTimestamp(ticket.created_at);
    const ticketKey = String(ticket.ticket_number || ticket.ticket_id || ticket.id || '').trim();
    const ticketDate = parseTicketNumberDate(ticketKey);

    if (canonicalTimestamp !== undefined) {
        return {
            timestamp: canonicalTimestamp,
            hasCanonicalTimestamp: true,
            sequence: parseTicketSequence(ticketKey),
        };
    }

    if (ticketDate !== undefined) {
        return {
            timestamp: ticketDate,
            hasCanonicalTimestamp: false,
            sequence: parseTicketSequence(ticketKey),
        };
    }

    return {
        timestamp: Number.NEGATIVE_INFINITY,
        hasCanonicalTimestamp: false,
        sequence: parseTicketSequence(ticketKey),
    };
}
