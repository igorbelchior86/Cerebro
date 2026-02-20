// ─────────────────────────────────────────────────────────────
// Playbook Routes — Generate & Retrieve Playbooks
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import type { PlaybookOutput } from '@playbook-brain/types';
import { generatePlaybook } from '../services/playbook-writer.js';
import {
  getEvidencePack,
  persistEvidencePack,
} from '../services/prepare-context.js';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../db/index.js';
import { diagnoseEvidencePack } from '../services/diagnose.js';
import { validateDiagnosis } from '../services/validate-policy.js';
import { PrepareContextService } from '../services/prepare-context.js';

const router: Router = Router();

// ─── GET /playbook/full-flow ──────────────────────────────
/**
 * Complete flow: Evidence → Diagnosis → Validation → Playbook
 * @route GET /playbook/full-flow
 * @param {string} sessionId - Session ID (UUID) or Ticket ID (e.g. T2026.001)
 * @returns {complete flow result}
 */
router.get('/full-flow', async (req, res) => {
  try {
    const rawId = (req.query.sessionId || req.body?.sessionId) as string;

    if (!rawId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    console.log(`[FULL-FLOW] Starting complete flow for ${rawId}`);

    // Resolve Session ID
    let sessionId = rawId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);

    if (!isUuid) {
      const session = await queryOne<{ id: string }>(
        'SELECT id FROM triage_sessions WHERE ticket_id = $1 OR id::text = $1 LIMIT 1',
        [rawId]
      );

      if (!session) {
        // Auto-create session if it doesn't exist
        console.log(`[FULL-FLOW] Creating new session for ticket ${rawId}`);
        const newSession = await queryOne<{ id: string }>(
          `INSERT INTO triage_sessions (id, ticket_id, status, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id`,
          [uuidv4(), rawId, 'pending', '00000000-0000-0000-0000-000000000000']
        );

        if (!newSession) {
          throw new Error('Failed to create triage session');
        }

        sessionId = newSession.id;

        // Return initializing state but let background processing continue
        // We set pack/diagnosis/etc to null to trigger background logic later
      } else {
        console.log(`[FULL-FLOW] Found existing session ${session.id} for ticket ${rawId}`);
        sessionId = session.id;
      }
    }

    console.log(`[FULL-FLOW] Using sessionId: ${sessionId}`);

    // Get all the data
    console.log('[FULL-FLOW] Fetching Evidence Pack...');
    let pack = await getEvidencePack(sessionId);
    if (!pack) {
      const result = await queryOne<{ payload: string }>(
        'SELECT payload FROM evidence_packs WHERE session_id = $1',
        [sessionId]
      );
      if (result) {
        pack = JSON.parse(result.payload);
      }
    }

    if (!pack) {
      console.log(`[FULL-FLOW] Evidence pack NOT found for ${sessionId}. Will trigger background preparation.`);
      // Continue execution so background processing can start
    } else {
      console.log(`[FULL-FLOW] Evidence pack found, status: ✅`);
    }

    const diagResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs WHERE session_id = $1 AND step = 'diagnose'`,
      [sessionId]
    );
    const diagnosis = diagResult ? JSON.parse(diagResult.payload) : null;

    const valResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs WHERE session_id = $1 AND step = 'validation'`,
      [sessionId]
    );
    const validation = valResult ? JSON.parse(valResult.payload) : null;

    const playbookResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs WHERE session_id = $1 AND step = 'playbook'`,
      [sessionId]
    );
    const playbook = playbookResult ? JSON.parse(playbookResult.payload) : null;

    // ─── Trigger Background Processing ────────────────────────────
    /**
     * Helper to run processing in background without blocking response.
     * Sequentially fills in missing steps.
     */
    const triggerBackgroundProcessing = async () => {
      try {
        let currentPack = pack;
        let currentDiagnosis = diagnosis;
        let currentValidation = validation;

        // 1. Evidence Pack
        if (!currentPack) {
          console.log(`[FULL-FLOW] Background: Preparing Evidence for ${sessionId}`);
          const contextService = new PrepareContextService();
          currentPack = await contextService.prepare({ sessionId, ticketId: rawId });
          await persistEvidencePack(sessionId, currentPack);
        }

        // 2. Diagnosis
        if (!currentDiagnosis && currentPack) {
          console.log(`[FULL-FLOW] Background: Generating Diagnosis for ${sessionId}`);
          currentDiagnosis = await diagnoseEvidencePack(currentPack);
          await execute(
            `INSERT INTO llm_outputs (session_id, step, payload, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (session_id, step) DO UPDATE SET payload = $3, created_at = NOW()`,
            [sessionId, 'diagnose', JSON.stringify(currentDiagnosis)]
          );
        }

        // 3. Validation
        if (!currentValidation && currentDiagnosis && currentPack) {
          console.log(`[FULL-FLOW] Background: Validating Diagnosis for ${sessionId}`);
          currentValidation = await validateDiagnosis(currentDiagnosis, currentPack);
          await execute(
            `INSERT INTO llm_outputs (session_id, step, payload, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (session_id, step) DO UPDATE SET payload = $3, created_at = NOW()`,
            [sessionId, 'validation', JSON.stringify(currentValidation)]
          );
        }

        // 4. Playbook
        if (!playbook && currentValidation?.safe_to_generate_playbook && currentDiagnosis && currentPack) {
          console.log(`[FULL-FLOW] Background: Generating Playbook for ${sessionId}`);
          const generatedPlaybook = await generatePlaybook(currentDiagnosis, currentValidation, currentPack);
          await execute(
            `INSERT INTO llm_outputs (session_id, step, payload, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (session_id, step) DO UPDATE SET payload = $3, created_at = NOW()`,
            [sessionId, 'playbook', JSON.stringify(generatedPlaybook)]
          );

          // Update session status to approved since it's an automated flow
          await execute(
            'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
            ['approved', sessionId]
          );
        }

        console.log(`[FULL-FLOW] Background processing complete for ${sessionId}`);
      } catch (bgErr) {
        console.error(`[FULL-FLOW] Background error for ${sessionId}:`, bgErr);
      }
    };

    // Run in background
    console.log(`[FULL-FLOW] Scheduling background processing for ${sessionId}`);
    triggerBackgroundProcessing();

    return res.json({
      sessionId,
      flow: {
        evidence_pack: pack ? '✅ Ready' : '⏳ Processing',
        diagnosis: diagnosis ? '✅ Ready' : '⏳ Waiting',
        validation: validation ? '✅ Ready' : '⏳ Waiting',
        playbook: playbook ? '✅ Ready' : '⏳ Waiting',
      },
      data: {
        pack,
        diagnosis,
        validation,
        playbook,
      },
    });
  } catch (err) {
    console.error('[FULL-FLOW] Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── POST /playbook ─────────────────────────────────────────
/**
 * @route POST /playbook
 * @param {string} sessionId - Session ID with validation complete
 * @returns {PlaybookOutput}
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // ─── Get evidence pack ────────────────────────────────────────
    let pack = await getEvidencePack(sessionId);

    if (!pack) {
      const result = await queryOne<{ payload: string }>(
        'SELECT payload FROM evidence_packs WHERE session_id = $1',
        [sessionId]
      );
      if (result) {
        pack = JSON.parse(result.payload);
      }
    }

    if (!pack) {
      return res.status(404).json({
        error: 'Evidence pack not found',
        sessionId,
      });
    }

    // ─── Get diagnosis ────────────────────────────────────────────
    const diagResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'diagnose'`,
      [sessionId]
    );

    if (!diagResult) {
      return res.status(404).json({
        error: 'Diagnosis not found',
        sessionId,
      });
    }

    const diagnosis = JSON.parse(diagResult.payload);

    // ─── Get validation ───────────────────────────────────────────
    const valResult = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'validation'`,
      [sessionId]
    );

    if (!valResult) {
      return res.status(404).json({
        error: 'Validation not found',
        sessionId,
      });
    }

    const validation = JSON.parse(valResult.payload);

    // ─── Generate playbook ────────────────────────────────────────
    console.log(`[PLAYBOOK] Generating playbook for session ${sessionId}`);
    const playbook = await generatePlaybook(diagnosis, validation, pack);
    console.log(
      `[PLAYBOOK] Generated ${playbook.meta?.output_tokens || 0} tokens`
    );

    // ─── Persist playbook ─────────────────────────────────────────
    await execute(
      `INSERT INTO llm_outputs (session_id, step, payload, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, step) DO UPDATE SET payload = $3, created_at = NOW()`,
      [sessionId, 'playbook', JSON.stringify(playbook)]
    );

    // ─── Update session status ────────────────────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['approved', sessionId]
    );

    return res.json({
      sessionId,
      playbook,
    });
  } catch (err) {
    console.error('[PLAYBOOK] Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /playbook/:sessionId ───────────────────────────────
/**
 * @route GET /playbook/:sessionId
 * @returns {PlaybookOutput | null}
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Skip if not a valid UUID (avoids Postgres crashes if route clashes)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
    if (!isUuid) return res.status(400).json({ error: 'Invalid UUID format' });

    const result = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'playbook'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.payload);
    return res.json({ sessionId, playbook });
  } catch (err) {
    console.error('[PLAYBOOK] GET Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /playbook/:sessionId/markdown ──────────────────────
/**
 * @route GET /playbook/:sessionId/markdown
 * Returns raw Markdown for display/rendering
 */
router.get('/:sessionId/markdown', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await queryOne<{ payload: string }>(
      `SELECT payload FROM llm_outputs 
       WHERE session_id = $1 AND step = 'playbook'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.payload);

    // ─── Return raw markdown for rendering ──────────────────────
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(playbook.content_md);
  } catch (err) {
    console.error('[PLAYBOOK] Markdown GET Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});



export default router;
