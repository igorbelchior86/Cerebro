import { v4 as uuidv4 } from 'uuid';
import type { TriageSession, SessionStatus } from '@cerebro/types';
import { query, execute } from '../../db/index.js';

export class TriageSessionService {
    /**
     * Create a new triage session
     */
    async createSession(params: {
        ticket_id: string;
        created_by: string;
        org_id?: string;
        org_name?: string;
        tenantId: string | null;
    }): Promise<TriageSession> {
        const sessionId = uuidv4();

        await execute(
            `
      INSERT INTO triage_sessions (id, ticket_id, org_id, org_name, status, created_by, tenant_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
            [
                sessionId,
                params.ticket_id,
                params.org_id || null,
                params.org_name || null,
                'pending',
                params.created_by,
                params.tenantId
            ]
        );

        return {
            id: sessionId,
            ticket_id: params.ticket_id,
            ...(params.org_id ? { org_id: params.org_id } : {}),
            ...(params.org_name ? { org_name: params.org_name } : {}),
            status: 'pending',
            created_by: params.created_by,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    }

    /**
     * Get triage session by ID
     */
    async getSession(id: string): Promise<TriageSession | null> {
        const results = await query<TriageSession>(
            `
      SELECT id, ticket_id, org_id, org_name, status, created_by, created_at, updated_at
      FROM triage_sessions
      WHERE id = $1
      `,
            [id]
        );
        return results[0] || null;
    }

    /**
     * List all sessions with optional filter
     */
    async listSessions(filters: {
        status?: string | string[];
        org_id?: string | string[];
        limit?: number;
        offset?: number
    }): Promise<TriageSession[]> {
        const limit = filters.limit ?? 50;
        const offset = filters.offset ?? 0;

        let whereClause = '1=1';
        const params: (string | number)[] = [];
        let paramIndex = 1;

        if (filters.status) {
            whereClause += ` AND status = $${paramIndex}`;
            params.push(String(filters.status));
            paramIndex++;
        }

        if (filters.org_id) {
            whereClause += ` AND org_id = $${paramIndex}`;
            params.push(String(filters.org_id));
            paramIndex++;
        }

        params.push(limit);
        params.push(offset);

        return query<TriageSession>(
            `
      SELECT id, ticket_id, org_id, org_name, status, created_by, created_at, updated_at
      FROM triage_sessions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
            params
        );
    }

    /**
     * Update session status
     */
    async updateSessionStatus(id: string, status: SessionStatus): Promise<TriageSession | null> {
        const validStatuses: SessionStatus[] = [
            'pending',
            'processing',
            'approved',
            'needs_more_info',
            'blocked',
            'failed',
        ];

        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        await execute(
            `
      UPDATE triage_sessions
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      `,
            [status, id]
        );

        return this.getSession(id);
    }
}

export const triageSessionService = new TriageSessionService();
