import { Router, type Router as ExpressRouter } from 'express';
import type {
  DiagnosisOutput,
  EvidencePack,
  ManagerQueueSnapshotItem,
  ValidationOutput,
} from '@playbook-brain/types';
import type { TrustCorrelationRefs } from '../services/p0-trust-contracts.js';
import { requireAdmin } from '../middleware/auth.js';
import { p0TrustStore } from '../services/p0-trust-store.js';
import { P0AiTriageAssistService } from '../services/p0-ai-triage-assist.js';
import {
  P0ReadOnlyEnrichmentService,
  ReadOnlyIntegrationMutationError,
} from '../services/p0-readonly-enrichment.js';
import { P0ManagerOpsVisibilityService } from '../services/p0-manager-ops-visibility.js';
import { p0RolloutControlService } from '../services/p0-rollout-control.js';

const router: ExpressRouter = Router();
router.use(requireAdmin);

const aiAssistService = new P0AiTriageAssistService({ store: p0TrustStore });
const readOnlyEnrichmentService = new P0ReadOnlyEnrichmentService({ store: p0TrustStore });
const managerOpsVisibilityService = new P0ManagerOpsVisibilityService();

router.get('/p0/ai-decisions', (req, res) => {
  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }
  const limit = Number(req.query.limit || 50);
  res.json({
    success: true,
    data: p0TrustStore.listAIDecisions({ tenantId, limit }),
    timestamp: new Date().toISOString(),
  });
});

router.get('/p0/audit', (req, res) => {
  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }
  const limit = Number(req.query.limit || 50);
  const actionPrefix = String(req.query.actionPrefix || '').trim() || undefined;
  res.json({
    success: true,
    data: p0TrustStore.listAudits({ tenantId, limit, ...(actionPrefix ? { actionPrefix } : {}) }),
    timestamp: new Date().toISOString(),
  });
});

router.post('/p0/ai/triage-decision', (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }

    const {
      ticket_id,
      pack,
      diagnosis,
      validation,
      correlation,
      prompt_version = 'p0-agent-c-triage-v1',
      model_version = 'unknown',
    } = req.body as {
      ticket_id?: string;
      pack?: EvidencePack;
      diagnosis?: DiagnosisOutput;
      validation?: ValidationOutput;
      correlation?: TrustCorrelationRefs;
      prompt_version?: string;
      model_version?: string;
    };

    if (!ticket_id || !pack || !diagnosis) {
      res.status(400).json({ error: 'ticket_id, pack, and diagnosis are required' });
      return;
    }

    const output = aiAssistService.buildSuggestionDecision({
      tenantId,
      ticketId: ticket_id,
      pack,
      diagnosis,
      ...(validation ? { validation } : {}),
      correlation: correlation || {},
      promptVersion: String(prompt_version),
      modelVersion: String(model_version),
      actor: { type: 'user', ...(req.auth?.sub ? { id: req.auth.sub } : {}) },
    });

    res.status(201).json({
      success: true,
      data: output,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unsupported rollout flag:')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post('/p0/enrichment/context', async (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }
    const { ticket_id, providers, correlation } = req.body as {
      ticket_id?: string;
      providers?: Record<string, { raw?: unknown; adapterVersion?: string }>;
      correlation?: TrustCorrelationRefs;
    };
    if (!ticket_id || !providers || typeof providers !== 'object') {
      res.status(400).json({ error: 'ticket_id and providers are required' });
      return;
    }
    const envelope = await readOnlyEnrichmentService.buildContextEnvelope({
      tenantId,
      ticketId: ticket_id,
      providers: providers as any,
      correlation: correlation || {},
      actor: { type: 'user', ...(req.auth?.sub ? { id: req.auth.sub } : {}) },
    });
    res.status(201).json({
      success: true,
      data: envelope,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unsupported rollout flag:')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.post('/p0/enrichment/mutate/:source', async (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }
    await readOnlyEnrichmentService.rejectMutation({
      source: req.params.source as any,
      tenantId,
      ticketId: String(req.body?.ticket_id || ''),
      correlation: (req.body?.correlation || {}) as TrustCorrelationRefs,
      payload: req.body?.payload,
      actor: { type: 'user', ...(req.auth?.sub ? { id: req.auth.sub } : {}) },
    });
  } catch (error) {
    if (error instanceof ReadOnlyIntegrationMutationError) {
      res.status(403).json({
        error: error.message,
        code: 'READ_ONLY_ENFORCEMENT',
        source: error.source,
        audit_id: error.auditId,
      });
      return;
    }
    next(error);
  }
});

router.post('/p0/visibility', (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }
    const queueItems = Array.isArray(req.body?.queue_items) ? (req.body.queue_items as ManagerQueueSnapshotItem[]) : [];
    const sampleSize = Number(req.body?.sample_size || 10);
    const snapshot = managerOpsVisibilityService.buildSnapshot({
      tenantId,
      queueItems,
      aiDecisions: p0TrustStore.listAIDecisions({ tenantId, limit: 200 }),
      auditRecords: p0TrustStore.listAudits({ tenantId, limit: 200 }),
      sampleSize,
    });
    res.json({
      success: true,
      data: snapshot,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/p0/rollout/policy', (req, res) => {
  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }
  res.json({
    success: true,
    data: {
      tenant_id: tenantId,
      frozen: true,
      launch_policy: p0RolloutControlService.getLaunchPolicySnapshot(),
    },
    timestamp: new Date().toISOString(),
  });
});

router.get('/p0/rollout/flags', (req, res) => {
  const tenantId = req.auth?.tid;
  if (!tenantId) {
    res.status(401).json({ error: 'Tenant context required' });
    return;
  }
  res.json({
    success: true,
    data: {
      supported_flags: p0RolloutControlService.getSupportedFlags(),
      posture: p0RolloutControlService.getTenantPosture(tenantId),
    },
    timestamp: new Date().toISOString(),
  });
});

router.post('/p0/rollout/flags/:flagKey', (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ error: 'enabled boolean is required' });
      return;
    }
    const posture = p0RolloutControlService.setTenantFlag({
      tenantId,
      flagKey: String(req.params.flagKey || ''),
      enabled: Boolean(req.body.enabled),
      ...(req.auth?.sub ? { actorId: req.auth.sub } : {}),
      ...(typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? { reason: String(req.body.reason).trim() }
        : {}),
    });
    res.json({
      success: true,
      data: posture,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/p0/rollout/rollback', (req, res, next) => {
  try {
    const tenantId = req.auth?.tid;
    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context required' });
      return;
    }
    const mode = String(req.body?.mode || '').trim();
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (mode === 'tenant_all_flags') {
      const posture = p0RolloutControlService.rollbackTenantAllFlags({
        tenantId,
        ...(req.auth?.sub ? { actorId: req.auth.sub } : {}),
        ...(reason ? { reason } : {}),
      });
      res.json({ success: true, data: posture, timestamp: new Date().toISOString() });
      return;
    }
    if (mode === 'feature_flag') {
      const flagKey = String(req.body?.flag_key || '').trim();
      if (!flagKey) {
        res.status(400).json({ error: 'flag_key is required for feature_flag rollback' });
        return;
      }
      const posture = p0RolloutControlService.rollbackFeature({
        tenantId,
        flagKey,
        ...(req.auth?.sub ? { actorId: req.auth.sub } : {}),
        ...(reason ? { reason } : {}),
      });
      res.json({ success: true, data: posture, timestamp: new Date().toISOString() });
      return;
    }
    res.status(400).json({ error: 'mode must be tenant_all_flags or feature_flag' });
  } catch (error) {
    next(error);
  }
});

export default router;
