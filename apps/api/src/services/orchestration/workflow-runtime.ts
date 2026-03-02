import { queryOne } from '../../db/index.js';
import { AutotaskClient } from '../../clients/autotask.js';
import { AutotaskTicketWorkflowGateway } from './autotask-ticket-workflow-gateway.js';
import { InMemoryTicketWorkflowRepository, TicketWorkflowCoreService } from './ticket-workflow-core.js';
import { WorkflowRealtimeHub } from './workflow-realtime.js';

interface AutotaskCreds {
  apiIntegrationCode: string;
  username: string;
  secret: string;
  zoneUrl?: string;
}

async function getTenantAutotaskClient(tenantId: string): Promise<AutotaskClient | null> {
  try {
    const row = await queryOne<{ credentials: AutotaskCreds }>(
      `SELECT credentials
       FROM integration_credentials
       WHERE tenant_id = $1 AND service = 'autotask'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId]
    );
    const creds = row?.credentials;
    if (creds?.apiIntegrationCode && creds?.username && creds?.secret) {
      return new AutotaskClient({
        apiIntegrationCode: creds.apiIntegrationCode,
        username: creds.username,
        secret: creds.secret,
        ...(creds.zoneUrl ? { zoneUrl: creds.zoneUrl } : {}),
      });
    }
  } catch {
    // fall through to env creds
  }

  // Never fall back to global env credentials for tenant-scoped workflow paths.
  // This prevents accidental cross-tenant credential bleed.
  if (tenantId) return null;

  const code = String(process.env.AUTOTASK_API_INTEGRATION_CODE || '').trim();
  const username = String(process.env.AUTOTASK_USERNAME || '').trim();
  const secret = String(process.env.AUTOTASK_SECRET || '').trim();
  const zoneUrl = String(process.env.AUTOTASK_ZONE_URL || '').trim();
  if (!code || !username || !secret) return null;
  return new AutotaskClient({
    apiIntegrationCode: code,
    username,
    secret,
    ...(zoneUrl ? { zoneUrl } : {}),
  });
}

const workflowRepo = new InMemoryTicketWorkflowRepository({
  persistenceFilePath: process.env.P0_WORKFLOW_RUNTIME_FILE || `${process.cwd()}/.run/p0-workflow-runtime.json`,
});
const workflowGateway = new AutotaskTicketWorkflowGateway(getTenantAutotaskClient);
const workflowRealtimeHub = new WorkflowRealtimeHub();
const workflowService = new TicketWorkflowCoreService(workflowRepo, workflowGateway, {
  maxAttempts: 3,
  realtimePublisher: (payload) => {
    workflowRealtimeHub.publishTicketChange(payload);
  },
});

export { workflowRepo, workflowGateway, workflowService, workflowRealtimeHub, getTenantAutotaskClient };
