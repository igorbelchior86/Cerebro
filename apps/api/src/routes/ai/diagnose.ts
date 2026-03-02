// ─────────────────────────────────────────────────────────────
// Phase 3 Routes — Diagnose & Validate
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import type {
  DiagnosisOutput,
  ValidationOutput,
  EvidencePack,
} from '@cerebro/types';
import { diagnoseEvidencePack } from '../../services/ai/diagnose.js';
import { validateDiagnosis, isSafeToGenerate } from '../../services/domain/validate-policy.js';
import { getEvidencePack } from '../../services/context/prepare-context.js';
import { query, queryOne, execute } from '../../db/index.js';

const router: Router = Router();

// ─── POST /diagnose ──────────────────────────────────────────
/**
 * @route POST /diagnose
 * @param {string} sessionId - Session ID with prepared evidence pack
 * @returns {DiagnosisOutput}
 */
router.post('/', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // ─── Get cached evidence pack or from database ────────────────
    let pack: EvidencePack | null = await getEvidencePack(sessionId);

    if (!pack) {
      const result = await queryOne<{ pack: EvidencePack }>(
        'SELECT pack FROM evidence_packs WHERE session_id = $1',
        [sessionId]
      );
      pack = result?.pack || null;
    }

    if (!pack) {
      return res.status(404).json({
        error: 'Evidence pack not found',
        sessionId,
      });
    }

    // ─── Update session status to processing ──────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', sessionId]
    );

    // ─── Generate diagnosis via Claude 3.5 Sonnet ────────────────
    console.log(`[DIAGNOSE] Starting diagnosis for session ${sessionId}`);
    const diagnosis = await diagnoseEvidencePack(pack);
    console.log(`[DIAGNOSE] Diagnosis complete - ${diagnosis.top_hypotheses.length} hypotheses`);

    // ─── Persist diagnosis to database ────────────────────────────
    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
      [sessionId, 'diagnosis', JSON.stringify(diagnosis)]
    );

    return res.json({
      sessionId,
      diagnosis,
    });
  } catch (err) {
    console.error('[DIAGNOSE] Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /diagnose/:sessionId ───────────────────────────────
/**
 * @route GET /diagnose/:sessionId
 * @returns {DiagnosisOutput | null}
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'diagnosis'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Diagnosis not found',
        sessionId,
      });
    }

    const diagnosis: DiagnosisOutput = JSON.parse(result.content);
    return res.json({ sessionId, diagnosis });
  } catch (err) {
    console.error('[DIAGNOSE] GET Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── POST /validate ──────────────────────────────────────────
/**
 * @route POST /validate
 * @param {string} sessionId - Session ID with diagnosis
 * @param {object} configOverride - Optional validation config
 * @returns {ValidationOutput}
 */
router.post('/validate', async (req, res) => {
  try {
    const { sessionId, config } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // ─── Get evidence pack ────────────────────────────────────────
    let pack: EvidencePack | null = await getEvidencePack(sessionId);

    if (!pack) {
      const result = await queryOne<{ pack: EvidencePack }>(
        'SELECT pack FROM evidence_packs WHERE session_id = $1',
        [sessionId]
      );
      pack = result?.pack || null;
    }

    if (!pack) {
      return res.status(404).json({
        error: 'Evidence pack not found',
        sessionId,
      });
    }

    // ─── Get diagnosis ───────────────────────────────────────────
    const diagResult = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'diagnosis'`,
      [sessionId]
    );

    if (!diagResult) {
      return res.status(404).json({
        error: 'Diagnosis not found. Run POST /diagnose first.',
        sessionId,
      });
    }

    const diagnosis: DiagnosisOutput = JSON.parse(diagResult.content);

    // ─── Validate diagnosis against policies ──────────────────────
    console.log(`[VALIDATE] Validating diagnosis for session ${sessionId}`);
    const validation = await validateDiagnosis(diagnosis, pack, config);
    console.log(
      `[VALIDATE] Status: ${validation.status}, Safe to generate: ${validation.safe_to_generate_playbook}`
    );

    // ─── Persist validation to database ───────────────────────────
    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
      [sessionId, 'validation', JSON.stringify(validation)]
    );

    // ─── Update session status ────────────────────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      [validation.status, sessionId]
    );

    return res.json({
      sessionId,
      validation,
      nextSteps: validation.safe_to_generate_playbook
        ? ['POST /playbook to generate the playbook']
        : validation.status === 'blocked'
          ? ['Fix violations before proceeding']
          : ['Answer required questions', 'Apply required fixes'],
    });
  } catch (err) {
    console.error('[VALIDATE] Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── GET /validation/:sessionId ──────────────────────────────
/**
 * @route GET /validation/:sessionId
 * @returns {ValidationOutput | null}
 */
router.get('/validation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await queryOne<{ content: string }>(
      `SELECT content FROM llm_outputs 
       WHERE session_id = $1 AND output_type = 'validation'`,
      [sessionId]
    );

    if (!result) {
      return res.status(404).json({
        error: 'Validation not found',
        sessionId,
      });
    }

    const validation: ValidationOutput = JSON.parse(result.content);
    return res.json({ sessionId, validation });
  } catch (err) {
    console.error('[VALIDATE] GET Error:', err);
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── POST /diagnose-and-validate ─────────────────────────────
/**
 * Combined endpoint: Evidence Pack → Diagnosis → Validation
 * @route POST /diagnose-and-validate
 * @param {string} sessionId - Session ID with prepared evidence pack
 * @returns {Diagnosis + Validation maçdou}
 */
router.post('/diagnose-and-validate', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // ─── Get evidence pack ────────────────────────────────────────
    let pack: EvidencePack | null = await getEvidencePack(sessionId);

    if (!pack) {
      const result = await queryOne<{ pack: EvidencePack }>(
        'SELECT pack FROM evidence_packs WHERE session_id = $1',
        [sessionId]
      );
      pack = result?.pack || null;
    }

    if (!pack) {
      return res.status(404).json({
        error: 'Evidence pack not found',
        sessionId,
      });
    }

    // ─── Update session status ────────────────────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      ['processing', sessionId]
    );

    // ─── Step 1: Diagnose ────────────────────────────────────────
    console.log(`[FULL-FLOW] Starting diagnosis for session ${sessionId}`);
    const diagnosis = await diagnoseEvidencePack(pack);

    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
      [sessionId, 'diagnosis', JSON.stringify(diagnosis)]
    );

    // ─── Step 2: Validate ────────────────────────────────────────
    console.log(`[FULL-FLOW] Starting validation for session ${sessionId}`);
    const validation = await validateDiagnosis(diagnosis, pack);

    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
      [sessionId, 'validation', JSON.stringify(validation)]
    );

    // ─── Update session status ────────────────────────────────────
    await execute(
      'UPDATE triage_sessions SET status = $1, updated_at = NOW() WHERE id = $2',
      [validation.status, sessionId]
    );

    console.log(
      `[FULL-FLOW] Complete - Status: ${validation.status}, Safe: ${validation.safe_to_generate_playbook}`
    );

    return res.json({
      sessionId,
      diagnosis,
      validation,
      nextSteps: validation.safe_to_generate_playbook
        ? ['POST /playbook to generate the playbook']
        : validation.status === 'blocked'
          ? ['Fix violations before proceeding']
          : ['Answer required questions', 'Apply required fixes'],
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
