// ─────────────────────────────────────────────────────────────
// Triage Routes — Session management
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { TriageSession, SessionStatus } from '@cerebro/types';
import { query, execute } from '../db/index.js';

const router: ExpressRouter = Router();

/**
 * POST /triage/sessions
 * Create a new triage session
 */
router.post('/sessions', async (req, res, next) => {
  try {
    const { ticket_id, org_id, org_name, created_by } = req.body;
    const tenantId = req.auth?.tid || null;

    if (!ticket_id || !created_by) {
      res.status(400).json({
        error: 'ticket_id and created_by are required',
      });
      return;
    }

    const sessionId = uuidv4();

    await execute(
      `
      INSERT INTO triage_sessions (id, ticket_id, org_id, org_name, status, created_by, tenant_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
      [sessionId, ticket_id, org_id || null, org_name || null, 'pending', created_by, tenantId]
    );

    const session: TriageSession = {
      id: sessionId,
      ticket_id,
      org_id,
      org_name,
      status: 'pending',
      created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    res.status(201).json({
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /triage/sessions/:id
 * Get triage session by ID
 */
router.get('/sessions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const results = await query<TriageSession>(
      `
      SELECT id, ticket_id, org_id, org_name, status, created_by, created_at, updated_at
      FROM triage_sessions
      WHERE id = $1
      `,
      [id]
    );

    if (results.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: results[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /triage/sessions
 * List all sessions with optional filter
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const { status, org_id, limit = 50, offset = 0 } = req.query;

    let whereClause = '1=1';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (org_id) {
      whereClause += ` AND org_id = $${paramIndex}`;
      params.push(org_id as string);
      paramIndex++;
    }

    params.push(parseInt(String(limit), 10));
    params.push(parseInt(String(offset), 10));

    const results = await query<TriageSession>(
      `
      SELECT id, ticket_id, org_id, org_name, status, created_by, created_at, updated_at
      FROM triage_sessions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      params
    );

    res.json({
      success: true,
      data: results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /triage/sessions/:id
 * Update session status
 */
router.patch('/sessions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      res.status(400).json({ error: 'status is required' });
      return;
    }

    const validStatuses: SessionStatus[] = [
      'pending',
      'processing',
      'approved',
      'needs_more_info',
      'blocked',
      'failed',
    ];

    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    await execute(
      `
      UPDATE triage_sessions
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [status, id]
    );

    const results = await query<TriageSession>(
      `
      SELECT id, ticket_id, org_id, org_name, status, created_by, created_at, updated_at
      FROM triage_sessions
      WHERE id = $1
      `,
      [id]
    );

    if (results.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: results[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
