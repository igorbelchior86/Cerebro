#!/usr/bin/env node
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const out = {
    dryRun: false,
    baseUrl: 'http://localhost:3001',
    token: process.env.CEREBRO_VALIDATION_BEARER || '',
    outDir: '',
    queueItemsFile: '',
    help: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--base-url') out.baseUrl = String(argv[++i] || '');
    else if (arg === '--token') out.token = String(argv[++i] || '');
    else if (arg === '--out-dir') out.outDir = String(argv[++i] || '');
    else if (arg === '--queue-items-file') out.queueItemsFile = String(argv[++i] || '');
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function usage() {
  return `P0 validation evidence capture\n\n` +
    `Usage:\n` +
    `  node scripts/p0-validation-evidence-capture.mjs [options]\n\n` +
    `Options:\n` +
    `  --dry-run                 Generate simulated evidence files (no network/auth)\n` +
    `  --base-url <url>          API base URL (default: http://localhost:3001)\n` +
    `  --token <bearer>          Bearer token for protected endpoints (or env CEREBRO_VALIDATION_BEARER)\n` +
    `  --queue-items-file <f>    JSON file with array payload for /manager-ops/p0/visibility\n` +
    `  --out-dir <dir>           Output directory (default: docs/validation/runs/<timestamp>)\n` +
    `  --help                    Show this help\n`;
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function loadQueueItems(filePath) {
  if (!filePath) return null;
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`queue items file must contain a JSON array: ${filePath}`);
  }
  return parsed;
}

async function httpJson({ baseUrl, token, method, path, body }) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: json };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    return;
  }

  const ts = new Date().toISOString().replace(/[:]/g, '-');
  const outDir = resolve(args.outDir || `docs/validation/runs/${ts}`);
  await ensureDir(outDir);

  const manifest = {
    tool: 'p0-validation-evidence-capture',
    version: 1,
    captured_at: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'live',
    base_url: args.baseUrl,
    files: [],
    warnings: [],
  };

  if (args.dryRun) {
    const dryFiles = {
      'health.json': { status: 'ok', timestamp: new Date().toISOString() },
      'workflow-inbox.json': { success: true, data: [], count: 0, timestamp: new Date().toISOString() },
      'workflow-reconciliation-issues.json': { success: true, data: [], count: 0, timestamp: new Date().toISOString() },
      'manager-ops-ai-decisions.json': { success: true, data: [], timestamp: new Date().toISOString() },
      'manager-ops-audit.json': { success: true, data: [], timestamp: new Date().toISOString() },
      'manager-ops-visibility.json': {
        success: true,
        data: {
          tenant_id: 'dry-run-tenant',
          generated_at: new Date().toISOString(),
          queue_sla: { total_tickets: 2, by_queue: [{ queue: 'Service Desk', total: 2, healthy: 1, at_risk: 1, breached: 0, unknown: 0 }] },
          ai_audit: { total_decisions: 2, pending_hitl: 1, avg_confidence: 0.71, by_decision_type: { triage: 2 } },
          automation_audit: { total_records: 1, rejected_actions: 1, read_only_rejections: 1, recent: [] },
          qa_sampling: { sample_size: 2, tickets: [{ ticket_id: 'T-1', reason: 'HITL pending', confidence: 0.61, hitl_status: 'pending', sla_status: 'at_risk' }] },
          integrity_checks: { ok: true, issues: [] },
        },
        timestamp: new Date().toISOString(),
      },
    };

    for (const [name, payload] of Object.entries(dryFiles)) {
      const p = resolve(outDir, name);
      await writeJson(p, payload);
      manifest.files.push({ file: name, source: 'dry-run', status: 200 });
    }

    manifest.warnings.push('Dry-run mode creates simulated snapshots only; no authenticated API calls were executed.');
    await writeJson(resolve(outDir, 'manifest.json'), manifest);
    console.log(`Dry-run evidence bundle created at ${outDir}`);
    return;
  }

  if (!args.token) {
    throw new Error('Bearer token required in live mode (use --token or CEREBRO_VALIDATION_BEARER).');
  }

  const queueItems = await loadQueueItems(args.queueItemsFile).catch((err) => {
    manifest.warnings.push(`queue_items load failed: ${err.message}`);
    return null;
  });

  const endpoints = [
    { method: 'GET', path: '/health', file: 'health.json' },
    { method: 'GET', path: '/workflow/inbox', file: 'workflow-inbox.json' },
    { method: 'GET', path: '/workflow/reconciliation-issues', file: 'workflow-reconciliation-issues.json' },
    { method: 'GET', path: '/manager-ops/p0/ai-decisions', file: 'manager-ops-ai-decisions.json' },
    { method: 'GET', path: '/manager-ops/p0/audit', file: 'manager-ops-audit.json' },
  ];

  for (const ep of endpoints) {
    const result = await httpJson({ baseUrl: args.baseUrl, token: args.token, method: ep.method, path: ep.path });
    await writeJson(resolve(outDir, ep.file), result.body);
    manifest.files.push({ file: ep.file, source: ep.path, status: result.status });
    if (!result.ok) {
      manifest.warnings.push(`${ep.path} returned ${result.status}`);
    }
  }

  if (queueItems) {
    const result = await httpJson({
      baseUrl: args.baseUrl,
      token: args.token,
      method: 'POST',
      path: '/manager-ops/p0/visibility',
      body: { queue_items: queueItems, sample_size: 10 },
    });
    await writeJson(resolve(outDir, 'manager-ops-visibility.json'), result.body);
    manifest.files.push({ file: 'manager-ops-visibility.json', source: '/manager-ops/p0/visibility', status: result.status });
    if (!result.ok) {
      manifest.warnings.push(`/manager-ops/p0/visibility returned ${result.status}`);
    }
  } else {
    manifest.warnings.push('No queue items provided; skipped /manager-ops/p0/visibility snapshot.');
  }

  await writeJson(resolve(outDir, 'manifest.json'), manifest);
  console.log(`Evidence bundle created at ${outDir}`);
}

main().catch((error) => {
  console.error(`[p0-validation-evidence-capture] ${error.message}`);
  process.exitCode = 1;
});
