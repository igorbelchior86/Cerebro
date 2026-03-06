// ─────────────────────────────────────────────────────────────
// Phase 3 Routes — Diagnose & Validate
// ─────────────────────────────────────────────────────────────

import { Router } from 'express';
import type {
  DiagnosisOutput,
  ValidationOutput,
  EvidencePack,
} from '@cerebro/types';
import { diagnoseEvidencePack } from '../../ai/diagnose.js';
import { validateDiagnosis } from '../../domain/validate-policy.js';
import { getEvidencePack } from '../../context/prepare-context.js';
import { queryOne, execute } from '../../../db/index.js';
import { operationalLogger } from '../../../lib/operational-logger.js';

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
    operationalLogger.info('routes.ai.diagnose.started', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
    });
    const diagnosis = await diagnoseEvidencePack(pack);
    operationalLogger.info('routes.ai.diagnose.completed', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
      hypothesis_count: diagnosis.top_hypotheses.length,
    });

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
    operationalLogger.error('routes.ai.diagnose.failed', err, {
      module: 'routes.ai.diagnose',
      signal: 'integration_failure',
      degraded_mode: true,
    });
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
    operationalLogger.error('routes.ai.diagnose_get.failed', err, {
      module: 'routes.ai.diagnose',
      signal: 'integration_failure',
      degraded_mode: true,
    });
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
    operationalLogger.info('routes.ai.validate.started', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
    });
    const validation = await validateDiagnosis(diagnosis, pack, config);
    operationalLogger.info('routes.ai.validate.completed', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
      validation_status: validation.status,
      safe_to_generate_playbook: validation.safe_to_generate_playbook,
    });

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
    operationalLogger.error('routes.ai.validate.failed', err, {
      module: 'routes.ai.diagnose',
      signal: 'integration_failure',
      degraded_mode: true,
    });
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
    operationalLogger.error('routes.ai.validation_get.failed', err, {
      module: 'routes.ai.diagnose',
      signal: 'integration_failure',
      degraded_mode: true,
    });
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
    operationalLogger.info('routes.ai.diagnose_validate_flow.diagnose_started', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
    });
    const diagnosis = await diagnoseEvidencePack(pack);

    await execute(
      `INSERT INTO llm_outputs (session_id, output_type, content, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (session_id, output_type) DO UPDATE SET content = $3, created_at = NOW()`,
      [sessionId, 'diagnosis', JSON.stringify(diagnosis)]
    );

    // ─── Step 2: Validate ────────────────────────────────────────
    operationalLogger.info('routes.ai.diagnose_validate_flow.validate_started', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
    });
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

    operationalLogger.info('routes.ai.diagnose_validate_flow.completed', {
      module: 'routes.ai.diagnose',
      session_id: sessionId,
      validation_status: validation.status,
      safe_to_generate_playbook: validation.safe_to_generate_playbook,
    });

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
    operationalLogger.error('routes.ai.diagnose_validate_flow.failed', err, {
      module: 'routes.ai.diagnose',
      signal: 'integration_failure',
      degraded_mode: true,
    });
    res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
