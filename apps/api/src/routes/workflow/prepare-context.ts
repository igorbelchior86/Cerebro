// ─────────────────────────────────────────────────────────────
// PrepareContext Routes
// ─────────────────────────────────────────────────────────────

import { Router, type Router as ExpressRouter } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { PrepareContextService, persistEvidencePack, getEvidencePack } from '../../services/context/prepare-context.js';
import { query } from '../../db/index.js';

const router: ExpressRouter = Router();
const service = new PrepareContextService();

/**
 * POST /prepare-context
 * Coleta dados de múltiplas fontes e monta EvidencePack
 */
router.post('/', async (req, res, next) => {
  try {
    const { session_id, ticket_id, org_id } = req.body;

    if (!session_id || !ticket_id) {
      res.status(400).json({
        error: 'session_id and ticket_id are required',
      });
      return;
    }

    // Update session to processing
    const beginTime = Date.now();

    const evidencePack = await service.prepare({
      sessionId: session_id,
      ticketId: ticket_id,
      orgId: org_id,
    });

    // Persist to database
    await persistEvidencePack(session_id, evidencePack);

    // Update session status
    await query(
      `UPDATE triage_sessions SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [session_id]
    );

    const duration = Date.now() - beginTime;

    res.status(201).json({
      success: true,
      data: {
        evidence_pack: evidencePack,
        session_id,
        duration_ms: duration,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /prepare-context/:sessionId
 * Retrieve EvidencePack from cache
 */
router.get('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const pack = await getEvidencePack(sessionId);

    if (!pack) {
      res.status(404).json({ error: 'EvidencePack not found' });
      return;
    }

    res.json({
      success: true,
      data: pack,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /prepare-context/session-and-collect/:ticketId
 * Create session and immediately collect evidence in one step
 */
router.post('/session-and-collect/:ticketId', async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { org_id, org_name, created_by } = req.body;
    const tenantId = req.auth?.tid || null;

    if (!created_by) {
      res.status(400).json({ error: 'created_by is required' });
      return;
    }

    // Create session first
    const sessionId = uuidv4();

    await query(
      `
      INSERT INTO triage_sessions (id, ticket_id, org_id, org_name, status, created_by, tenant_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `,
      [sessionId, ticketId, org_id || null, org_name || null, 'processing', created_by, tenantId]
    );

    // Prepare context immediately
    const evidencePack = await service.prepare({
      sessionId,
      ticketId,
      orgId: org_id,
    });

    // Persist to database
    await persistEvidencePack(sessionId, evidencePack);

    res.status(201).json({
      success: true,
      data: {
        session_id: sessionId,
        evidence_pack: evidencePack,
        signalCount: evidencePack.signals.length,
        documentCount: evidencePack.docs.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
