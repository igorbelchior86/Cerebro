// ─────────────────────────────────────────────────────────────
// Triage Routes — Session management
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import type { SessionStatus } from '@cerebro/types';
import { triageSessionService } from '../../workflow/triage-session.js';

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

    const session = await triageSessionService.createSession({
      ticket_id,
      created_by,
      org_id,
      org_name,
      tenantId,
    });

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

    const session = await triageSessionService.getSession(id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      success: true,
      data: session,
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
    const { status, org_id, limit, offset } = req.query;

    const filters: Parameters<typeof triageSessionService.listSessions>[0] = {};
    if (status) filters.status = status as string;
    if (org_id) filters.org_id = org_id as string;
    if (limit) filters.limit = parseInt(String(limit), 10);
    if (offset) filters.offset = parseInt(String(offset), 10);

    const results = await triageSessionService.listSessions(filters);

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

    try {
      const updated = await triageSessionService.updateSessionStatus(id, status as SessionStatus);

      if (!updated) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      res.json({
        success: true,
        data: updated,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      if (err.message.startsWith('Invalid status')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

export default router;
