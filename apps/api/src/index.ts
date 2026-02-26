// ─────────────────────────────────────────────────────────────
// Main API Server
// ─────────────────────────────────────────────────────────────

import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import autotaskRoutes from './routes/autotask.js';
import ninjaoneRoutes from './routes/ninjaone.js';
import itglueRoutes from './routes/itglue.js';
import triageRoutes from './routes/triage.js';
import prepareContextRoutes from './routes/prepare-context.js';
import diagnoseRoutes from './routes/diagnose.js';
import playbookRoutes from './routes/playbook.js';
import integrationsRoutes from './routes/integrations.js';
import chatRoutes from './routes/chat.js';
import emailIngestionRoutes from './routes/email-ingestion.js';
import authRoutes from './routes/auth.js';
import workflowRoutes from './routes/workflow.js';
import managerOpsRoutes from './routes/manager-ops.js';
import { requireAuth } from './middleware/auth.js';
import { autoSeedAdmin } from './db/seed-admin.js';
import { triageOrchestrator } from './services/triage-orchestrator.js';
import { autotaskPollingService } from './services/autotask-polling.js';
import { bootstrapWorkspaceRuntimeSettings } from './services/runtime-settings.js';
import { createObservabilityMiddleware, createObservabilityRuntime, requestContextMiddleware } from './platform/index.js';

// Load environment variables — look for .env at monorepo root (../../../ relative to dist/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../', '.env') });

const app: Express = express();

const observabilityRuntime = createObservabilityRuntime();

// Middleware
app.use(express.json());
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
  console.error('[ERROR]', err.message);
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
  console.log(`\n[API] ✓ Server running at http://localhost:${PORT}`);
  console.log(`[API] ✓ Health check: http://localhost:${PORT}/health`);
  console.log(`[API] ✓ Auth: JWT + httpOnly cookie + TOTP MFA`);
  console.log(
    `[API] ✓ LLM env loaded (provider=${process.env.LLM_PROVIDER || 'gemini'}, geminiKey=${process.env.GEMINI_API_KEY ? 'yes' : 'no'}, groqKey=${process.env.GROQ_API_KEY ? 'yes' : 'no'})`
  );
  await autoSeedAdmin();
  await bootstrapWorkspaceRuntimeSettings();

  // Start Triage Retry Listener (retries pending/stale sessions)
  triageOrchestrator.startRetryListener();

  // Start Autotask Polling Service
  autotaskPollingService.start();

  console.log(`[API] ✓ Ready\n`);
});

export default app;
