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
import { queryOne, execute } from '../db/index.js';

const router: Router = Router();

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
    const diagResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'diagnosis'`,
      [sessionId]
    );

    if (!diagResult) {
      return res.status(404).json({
        error: 'Diagnosis not found',
        sessionId,
      });
    }

    const diagnosis = JSON.parse(diagResult.content);

    // ─── Get validation ───────────────────────────────────────────
    const valResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'validation'`,
      [sessionId]
    );

    if (!valResult) {
      return res.status(404).json({
        error: 'Validation not found',
        sessionId,
      });
    }

    const validation = JSON.parse(valResult.content);

    // ─── Generate playbook ────────────────────────────────────────
    console.log(`[PLAYBOOK] Generating playbook for session ${sessionId}`);
    const playbook = await generatePlaybook(diagnosis, validation, pack);
    console.log(
      `[PLAYBOOK] Generated ${playbook.meta?.output_tokens || 0} tokens`
    );

    // ─── Persist playbook ─────────────────────────────────────────
    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
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

    const result = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'playbook'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.content);
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

    const result = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'playbook'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Playbook not found',
        sessionId,
      });
    }

    const playbook: PlaybookOutput = JSON.parse(result.content);

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

// ─── POST /playbook/full-flow ──────────────────────────────
/**
 * Complete flow: Evidence → Diagnosis → Validation → Playbook
 * @route POST /playbook/full-flow
 * @param {string} sessionId - Session ID with evidence pack
 * @returns {complete flow result}
 */
router.post('/full-flow', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    console.log(`[FULL-FLOW] Starting complete flow for ${sessionId}`);

    // Get all the data
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
      return res.status(404).json({ error: 'Evidence pack not found' });
    }

    const diagResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs WHERE session_id = $1 AND output_type = 'diagnosis'`,
      [sessionId]
    );
    const diagnosis = diagResult ? JSON.parse(diagResult.content) : null;

    const valResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs WHERE session_id = $1 AND output_type = 'validation'`,
      [sessionId]
    );
    const validation = valResult ? JSON.parse(valResult.content) : null;

    const playbookResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs WHERE session_id = $1 AND output_type = 'playbook'`,
      [sessionId]
    );
    const playbook = playbookResult ? JSON.parse(playbookResult.content) : null;

    return res.json({
      sessionId,
      flow: {
        evidence_pack: pack ? '✅ Ready' : '⏳ Pending',
        diagnosis: diagnosis ? '✅ Ready' : '⏳ Not generated',
        validation: validation ? '✅ Ready' : '⏳ Not generated',
        playbook: playbook ? '✅ Ready' : '⏳ Not generated',
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

export default router;
