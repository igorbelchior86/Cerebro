// ─────────────────────────────────────────────────────────────
// Main API Server
// ─────────────────────────────────────────────────────────────

import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import autotaskRoutes from './routes/integrations/autotask.js';
import ninjaoneRoutes from './routes/integrations/ninjaone.js';
import itglueRoutes from './routes/integrations/itglue.js';
import triageRoutes from './routes/workflow/triage.js';
import prepareContextRoutes from './routes/workflow/prepare-context.js';
import diagnoseRoutes from './routes/ai/diagnose.js';
import playbookRoutes from './routes/ai/playbook.js';
import integrationsRoutes from './routes/integrations/integrations.js';
import chatRoutes from './routes/workflow/chat.js';
import emailIngestionRoutes from './routes/ingestion/email-ingestion.js';
import authRoutes from './routes/identity/auth.js';
import platformAdminRoutes from './routes/platform/admin.js';
import workflowRoutes from './routes/workflow/workflow.js';
import managerOpsRoutes from './routes/ops/manager-ops.js';
import { requireAuth } from './middleware/auth.js';
import { autoSeedAdmin } from './db/seed-admin.js';
import { triageOrchestrator } from './services/orchestration/triage-orchestrator.js';
import { autotaskPollingService } from './services/adapters/autotask-polling.js';
import { bootstrapWorkspaceRuntimeSettings } from './services/read-models/runtime-settings.js';
import { createObservabilityMiddleware, requestContextMiddleware } from './platform/index.js';
import { observabilityRuntime, operationalLogger } from './lib/operational-logger.js';

// Load environment variables — look for .env at monorepo root (../../../ relative to dist/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../', '.env') });

const app: Express = express();

// Middleware
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.use(cookieParser());
app.use(requestContextMiddleware);
app.use(createObservabilityMiddleware(observabilityRuntime));


// ─── CORS Configuration ──────────────────────────────────────
// Allow the Next.js frontend + credentials (cookies)
const ALLOWED_ORIGINS = [
  process.env.APP_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-bootstrap-token, x-request-id, x-trace-id, x-ticket-id, x-job-id, x-command-id',
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// ─── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ─── API Version ─────────────────────────────────────────────
app.get('/version', (req, res) => {
  res.json({
    version: '0.1.0',
    phase: 'Phase 2: PrepareContext + Evidence Pack',
  });
});

// ─── Auth Routes (public — no requireAuth) ───────────────────
app.use('/auth', authRoutes);
app.use('/platform/admin', platformAdminRoutes);

// ─── API Routes (protected) ──────────────────────────────────
app.use('/autotask', requireAuth, autotaskRoutes);
app.use('/ninjaone', requireAuth, ninjaoneRoutes);
app.use('/itglue', requireAuth, itglueRoutes);
app.use('/triage', requireAuth, triageRoutes);
app.use('/prepare-context', requireAuth, prepareContextRoutes);
app.use('/diagnose', requireAuth, diagnoseRoutes);
app.use('/playbook', requireAuth, playbookRoutes);
app.use('/integrations', requireAuth, integrationsRoutes);
app.use('/chat', requireAuth, chatRoutes);
app.use('/workflow', requireAuth, workflowRoutes);
app.use('/manager-ops', requireAuth, managerOpsRoutes);

// UI still uses these endpoints as a local inbox/session list API.
// Email ingestion polling is disabled, but read/query routes remain mounted.
app.use('/email-ingestion', emailIngestionRoutes);

// ─── Error Handling ──────────────────────────────────────────
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  operationalLogger.error('api.unhandled_error', err, {
    module: 'api.bootstrap',
    route_path: req.path,
    method: req.method,
  });
  res.status(500).json({
    error: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  });
});

// ─── 404 Handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// ─── Start Server ────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);

app.listen(PORT, '0.0.0.0', async () => {
  operationalLogger.info('api.server_started', {
    module: 'api.bootstrap',
    port: PORT,
    base_url: `http://localhost:${PORT}`,
    health_url: `http://localhost:${PORT}/health`,
    auth_mode: 'jwt_cookie_totp',
    llm_provider: process.env.LLM_PROVIDER || 'gemini',
    gemini_key_present: Boolean(process.env.GEMINI_API_KEY),
    groq_key_present: Boolean(process.env.GROQ_API_KEY),
  });
  await autoSeedAdmin();
  await bootstrapWorkspaceRuntimeSettings();

  // Start Triage Retry Listener (retries pending/stale sessions)
  triageOrchestrator.startRetryListener();

  // Start Autotask Polling Service
  autotaskPollingService.start();

  operationalLogger.info('api.server_ready', { module: 'api.bootstrap', port: PORT });
});

export default app;
