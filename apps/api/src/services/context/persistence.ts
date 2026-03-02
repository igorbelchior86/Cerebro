// ─────────────────────────────────────────────────────────────
// Context Persistence Layer
// All DB persist/get operations for evidence packs, ticket
// artifacts, SSOT, context appendix, and enrichment caches.
// ─────────────────────────────────────────────────────────────

import type { EvidencePack } from '@cerebro/types';
import { query, queryOne, execute } from '../../db/index.js';
import type {
    TicketSSOT,
    TicketTextArtifact,
    TicketContextAppendix,
} from './prepare-context.types.js';

// ─── EvidencePack ────────────────────────────────────────────

/**
 * Persist EvidencePack ao banco
 */
export async function persistEvidencePack(sessionId: string, pack: EvidencePack): Promise<void> {
    try {
        const existing = await queryOne(`SELECT id FROM evidence_packs WHERE session_id = $1`, [sessionId]);

        if (existing) {
            await execute(
                `UPDATE evidence_packs SET payload = $1, created_at = NOW() WHERE session_id = $2`,
                [JSON.stringify(pack), sessionId]
            );
        } else {
            await execute(
                `INSERT INTO evidence_packs (session_id, payload, created_at) VALUES ($1, $2, NOW())`,
                [sessionId, JSON.stringify(pack)]
            );
        }
        console.log(`[DB] Persisted EvidencePack for session ${sessionId}`);
    } catch (error) {
        console.error('[DB] Failed to persist EvidencePack:', error);
        throw error;
    }
}

/**
 * Recupera EvidencePack do banco
 */
export async function getEvidencePack(sessionId: string): Promise<EvidencePack | null> {
    try {
        const result = await queryOne<{ payload: EvidencePack }>(
            `SELECT payload FROM evidence_packs WHERE session_id = $1`,
            [sessionId]
        );
        return result?.payload || null;
    } catch (error) {
        console.error('[DB] Failed to retrieve EvidencePack:', error);
        return null;
    }
}

// ─── Ticket SSOT ─────────────────────────────────────────────

/**
 * Persist SSOT cache for a ticket
 */
export async function persistTicketSSOT(
    ticketId: string,
    sessionId: string,
    payload: TicketSSOT
): Promise<void> {
    try {
        const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_ssot');
        if (!canPersist) {
            console.log(`[DB] Skipped SSOT persist for superseded session ${sessionId} ticket ${ticketId}`);
            return;
        }
        await execute(
            `INSERT INTO ticket_ssot (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
            [ticketId, sessionId, JSON.stringify(payload)]
        );
        console.log(`[DB] Persisted SSOT for ticket ${ticketId}`);
    } catch (error) {
        console.error('[DB] Failed to persist SSOT:', error);
        throw error;
    }
}

// ─── Ticket Text Artifact ─────────────────────────────────────

export async function persistTicketTextArtifact(
    ticketId: string,
    sessionId: string,
    payload: TicketTextArtifact
): Promise<void> {
    try {
        const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_text_artifact');
        if (!canPersist) {
            console.log(`[DB] Skipped ticket text artifact persist for superseded session ${sessionId} ticket ${ticketId}`);
            return;
        }
        await execute(
            `INSERT INTO ticket_text_artifacts (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
            [ticketId, sessionId, JSON.stringify(payload)]
        );
        console.log(`[DB] Persisted ticket text artifact for ticket ${ticketId}`);
    } catch (error) {
        console.error('[DB] Failed to persist ticket text artifact:', error);
    }
}

export async function getTicketTextArtifact(
    ticketId: string
): Promise<{ payload: TicketTextArtifact; created_at: string; updated_at: string } | null> {
    try {
        const row = await queryOne<{ payload: TicketTextArtifact; created_at: string; updated_at: string }>(
            `SELECT payload, created_at, updated_at
       FROM ticket_text_artifacts
       WHERE ticket_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
            [ticketId]
        );
        return row || null;
    } catch (error) {
        console.error('[DB] Failed to fetch ticket text artifact:', error);
        return null;
    }
}

// ─── Ticket Context Appendix ──────────────────────────────────

export async function persistTicketContextAppendix(
    ticketId: string,
    sessionId: string,
    payload: TicketContextAppendix
): Promise<void> {
    try {
        const canPersist = await canPersistTicketScopedArtifact(ticketId, sessionId, 'ticket_context_appendix');
        if (!canPersist) {
            console.log(`[DB] Skipped ticket context appendix persist for superseded session ${sessionId} ticket ${ticketId}`);
            return;
        }
        await execute(
            `INSERT INTO ticket_context_appendix (ticket_id, session_id, payload, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticket_id)
       DO UPDATE SET payload = EXCLUDED.payload, session_id = EXCLUDED.session_id, updated_at = NOW()`,
            [ticketId, sessionId, JSON.stringify(payload)]
        );
        console.log(`[DB] Persisted ticket context appendix for ticket ${ticketId}`);
    } catch (error) {
        console.error('[DB] Failed to persist ticket context appendix:', error);
    }
}

export async function getTicketContextAppendix(
    ticketId: string
): Promise<{ payload: TicketContextAppendix; created_at: string; updated_at: string } | null> {
    try {
        const row = await queryOne<{ payload: TicketContextAppendix; created_at: string; updated_at: string }>(
            `SELECT payload, created_at, updated_at
       FROM ticket_context_appendix
       WHERE ticket_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
            [ticketId]
        );
        return row || null;
    } catch (error) {
        console.error('[DB] Failed to fetch ticket context appendix:', error);
        return null;
    }
}

// ─── Artifact Guard ───────────────────────────────────────────

async function canPersistTicketScopedArtifact(
    ticketId: string,
    sessionId: string,
    artifactKind: 'ticket_ssot' | 'ticket_text_artifact' | 'ticket_context_appendix'
): Promise<boolean> {
    try {
        const session = await queryOne<{
            id: string;
            ticket_id: string;
            status: string;
            last_error: string | null;
        }>(
            `SELECT id, ticket_id, status, last_error
       FROM triage_sessions
       WHERE id = $1
       LIMIT 1`,
            [sessionId]
        );
        if (!session) return false;
        if (String(session.ticket_id || '') !== String(ticketId || '')) return false;

        const status = String(session.status || '').toLowerCase();
        const lastError = String(session.last_error || '').toLowerCase();
        if (status === 'failed' && lastError.includes('manual refresh restart')) {
            return false;
        }

        const latest = await queryOne<{ id: string }>(
            `SELECT id
       FROM triage_sessions
       WHERE ticket_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
            [ticketId]
        );
        const isLatest = String(latest?.id || '') === String(sessionId || '');
        if (!isLatest) {
            console.log(`[DB] Guard rejected ${artifactKind} persist: session ${sessionId} is not latest for ticket ${ticketId}`);
            return false;
        }
        return true;
    } catch (error) {
        console.error(`[DB] Artifact guard failed for ${artifactKind}; allowing persist as fallback:`, error);
        return true;
    }
}

// ─── IT Glue Org Snapshot / Enriched Cache ────────────────────

export async function persistItglueOrgSnapshot(
    orgId: string,
    payload: Record<string, unknown>,
    sourceHash: string
): Promise<void> {
    try {
        await execute(
            `INSERT INTO itglue_org_snapshot (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
            [orgId, JSON.stringify(payload), sourceHash]
        );
    } catch (error) {
        console.error('[DB] Failed to persist IT Glue snapshot:', error);
    }
}

export async function getItglueOrgEnriched(
    orgId: string
): Promise<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string } | null> {
    try {
        const row = await queryOne<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string }>(
            `SELECT payload, source_hash, created_at, updated_at
       FROM itglue_org_enriched
       WHERE org_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
            [orgId]
        );
        return row || null;
    } catch (error) {
        console.error('[DB] Failed to fetch IT Glue enriched cache:', error);
        return null;
    }
}

export async function upsertItglueOrgEnriched(
    orgId: string,
    payload: Record<string, unknown>,
    sourceHash: string
): Promise<void> {
    try {
        await execute(
            `INSERT INTO itglue_org_enriched (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
            [orgId, JSON.stringify(payload), sourceHash]
        );
    } catch (error) {
        console.error('[DB] Failed to persist IT Glue enriched cache:', error);
    }
}

// ─── Ninja Org Snapshot / Enriched Cache ─────────────────────

export async function persistNinjaOrgSnapshot(
    orgId: string,
    payload: Record<string, unknown>,
    sourceHash: string
): Promise<void> {
    try {
        await execute(
            `INSERT INTO ninja_org_snapshot (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
            [orgId, JSON.stringify(payload), sourceHash]
        );
    } catch (error) {
        console.error('[DB] Failed to persist Ninja snapshot:', error);
    }
}

export async function getNinjaOrgEnriched(
    orgId: string
): Promise<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string } | null> {
    try {
        const row = await queryOne<{ payload: Record<string, unknown>; source_hash: string; created_at: string; updated_at: string }>(
            `SELECT payload, source_hash, created_at, updated_at
       FROM ninja_org_enriched
       WHERE org_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
            [orgId]
        );
        return row || null;
    } catch (error) {
        console.error('[DB] Failed to fetch Ninja enriched cache:', error);
        return null;
    }
}

export async function upsertNinjaOrgEnriched(
    orgId: string,
    payload: Record<string, unknown>,
    sourceHash: string
): Promise<void> {
    try {
        await execute(
            `INSERT INTO ninja_org_enriched (org_id, payload, source_hash, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (org_id)
       DO UPDATE SET payload = EXCLUDED.payload, source_hash = EXCLUDED.source_hash, updated_at = NOW()`,
            [orgId, JSON.stringify(payload), sourceHash]
        );
    } catch (error) {
        console.error('[DB] Failed to persist Ninja enriched cache:', error);
    }
}
