// ─────────────────────────────────────────────────────────────
// Context Persistence Layer
// All DB persist/get operations for evidence packs, ticket
// artifacts, SSOT, context appendix, and enrichment caches.
// ─────────────────────────────────────────────────────────────

import type { EvidencePack } from '@cerebro/types';
import { query, queryOne, execute, transaction } from '../../db/index.js';
import { operationalLogger } from '../../lib/operational-logger.js';
import type {
    TicketSSOT,
    TicketTextArtifact,
    TicketContextAppendix,
} from './prepare-context.types.js';

function persistenceCorrelation(ticketId?: string) {
    return {
        ticket_id: ticketId ? String(ticketId) : null,
    };
}

const EVIDENCE_PACK_LOCK_NAMESPACE = 41023;

type TicketScopedArtifactKind =
    | 'ticket_ssot'
    | 'ticket_text_artifact'
    | 'ticket_context_appendix';

function buildLatestSessionGuardedUpsert(tableName: TicketScopedArtifactKind): string {
    return `
        WITH eligible_session AS (
            SELECT s.id
            FROM triage_sessions s
            WHERE s.id = $2
              AND s.ticket_id = $1
              AND NOT (
                LOWER(COALESCE(s.status, '')) = 'failed'
                AND LOWER(COALESCE(s.last_error, '')) LIKE '%manual refresh restart%'
              )
              AND s.id = (
                SELECT ts.id
                FROM triage_sessions ts
                WHERE ts.ticket_id = $1
                ORDER BY ts.created_at DESC, ts.id DESC
                LIMIT 1
              )
        )
        INSERT INTO ${tableName} (ticket_id, session_id, payload, created_at, updated_at)
        SELECT $1, $2, $3, NOW(), NOW()
        FROM eligible_session
        ON CONFLICT (ticket_id)
        DO UPDATE SET
            payload = EXCLUDED.payload,
            session_id = EXCLUDED.session_id,
            updated_at = NOW()
        WHERE EXISTS (SELECT 1 FROM eligible_session)
    `;
}

async function persistLatestTicketScopedArtifact(
    tableName: TicketScopedArtifactKind,
    ticketId: string,
    sessionId: string,
    payload: unknown
): Promise<boolean> {
    const affectedRows = await execute(
        buildLatestSessionGuardedUpsert(tableName),
        [ticketId, sessionId, JSON.stringify(payload)]
    );
    return affectedRows > 0;
}

// ─── EvidencePack ────────────────────────────────────────────

/**
 * Persist EvidencePack ao banco
 */
export async function persistEvidencePack(sessionId: string, pack: EvidencePack): Promise<void> {
    try {
        const serializedPack = JSON.stringify(pack);
        await transaction(async (client) => {
            await client.query(
                'SELECT pg_advisory_xact_lock($1, hashtext($2))',
                [EVIDENCE_PACK_LOCK_NAMESPACE, sessionId]
            );

            // Serialize writes per session so concurrent refreshes cannot double-insert.
            const updated = await client.query(
                `UPDATE evidence_packs
                 SET payload = $1, created_at = NOW()
                 WHERE session_id = $2`,
                [serializedPack, sessionId]
            );

            if ((updated.rowCount || 0) > 0) {
                return;
            }

            await client.query(
                `INSERT INTO evidence_packs (session_id, payload, created_at)
                 VALUES ($1, $2, NOW())`,
                [sessionId, serializedPack]
            );
        });
        operationalLogger.info('context.persistence.evidence_pack_persisted', {
            module: 'services.context.persistence',
            session_id: sessionId,
        });
    } catch (error) {
        operationalLogger.error('context.persistence.evidence_pack_persist_failed', error, {
            module: 'services.context.persistence',
            session_id: sessionId,
        });
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
        operationalLogger.error('context.persistence.evidence_pack_fetch_failed', error, {
            module: 'services.context.persistence',
            session_id: sessionId,
        });
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
        const persisted = await persistLatestTicketScopedArtifact('ticket_ssot', ticketId, sessionId, payload);
        if (!persisted) {
            operationalLogger.info('context.persistence.ssot_persist_skipped_superseded', {
                module: 'services.context.persistence',
                session_id: sessionId,
                ticket_id: ticketId,
            }, persistenceCorrelation(ticketId));
            return;
        }
        operationalLogger.info('context.persistence.ssot_persisted', {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
    } catch (error) {
        operationalLogger.error('context.persistence.ssot_persist_failed', error, {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
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
        const persisted = await persistLatestTicketScopedArtifact('ticket_text_artifact', ticketId, sessionId, payload);
        if (!persisted) {
            operationalLogger.info('context.persistence.ticket_text_artifact_persist_skipped_superseded', {
                module: 'services.context.persistence',
                session_id: sessionId,
                ticket_id: ticketId,
            }, persistenceCorrelation(ticketId));
            return;
        }
        operationalLogger.info('context.persistence.ticket_text_artifact_persisted', {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
    } catch (error) {
        operationalLogger.error('context.persistence.ticket_text_artifact_persist_failed', error, {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
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
        operationalLogger.error('context.persistence.ticket_text_artifact_fetch_failed', error, {
            module: 'services.context.persistence',
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
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
        const persisted = await persistLatestTicketScopedArtifact('ticket_context_appendix', ticketId, sessionId, payload);
        if (!persisted) {
            operationalLogger.info('context.persistence.ticket_context_appendix_persist_skipped_superseded', {
                module: 'services.context.persistence',
                session_id: sessionId,
                ticket_id: ticketId,
            }, persistenceCorrelation(ticketId));
            return;
        }
        operationalLogger.info('context.persistence.ticket_context_appendix_persisted', {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
    } catch (error) {
        operationalLogger.error('context.persistence.ticket_context_appendix_persist_failed', error, {
            module: 'services.context.persistence',
            session_id: sessionId,
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
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
        operationalLogger.error('context.persistence.ticket_context_appendix_fetch_failed', error, {
            module: 'services.context.persistence',
            ticket_id: ticketId,
        }, persistenceCorrelation(ticketId));
        return null;
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
        operationalLogger.error('context.persistence.itglue_snapshot_persist_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
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
        operationalLogger.error('context.persistence.itglue_enriched_fetch_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
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
        operationalLogger.error('context.persistence.itglue_enriched_persist_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
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
        operationalLogger.error('context.persistence.ninja_snapshot_persist_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
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
        operationalLogger.error('context.persistence.ninja_enriched_fetch_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
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
        operationalLogger.error('context.persistence.ninja_enriched_persist_failed', error, {
            module: 'services.context.persistence',
            org_id: orgId,
        });
    }
}
