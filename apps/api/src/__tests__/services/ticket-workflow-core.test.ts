import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  InMemoryTicketWorkflowRepository,
  TicketWorkflowCoreService,
  WorkflowPolicyError,
  WorkflowTransientError,
  buildCommandEnvelope,
  type TicketWorkflowGateway,
  type WorkflowEventEnvelope,
} from '../../services/ticket-workflow-core.js';

describe('TicketWorkflowCoreService (Agent B P0 workflow core)', () => {
  const tenantId = 'tenant-1';
  const actor = { kind: 'user' as const, id: 'user-1', origin: 'ui' };

  function createService(gateway: TicketWorkflowGateway, maxAttempts = 3) {
    const repo = new InMemoryTicketWorkflowRepository();
    const service = new TicketWorkflowCoreService(repo, gateway, { maxAttempts });
    return { repo, service };
  }

  function createCommand(overrides?: Partial<Parameters<typeof buildCommandEnvelope>[0]>) {
    return buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'create',
      payload: { title: 'Printer down', description: 'Queue stuck', company_id: 10 },
      actor,
      idempotencyKey: 'idem-1',
      correlation: { trace_id: 'trace-1' },
      ...overrides,
    });
  }

  it('rejects non-Autotask mutation commands (policy guardrail) and audits rejection', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
    };
    const { service } = createService(gateway);
    const cmd = createCommand({
      targetIntegration: 'Ninja',
      idempotencyKey: 'idem-policy',
      correlation: { trace_id: 'trace-policy', ticket_id: 'T-POLICY-1' },
    });

    await expect(service.submitCommand(cmd)).rejects.toBeInstanceOf(WorkflowPolicyError);

    const audit = await service.listAuditByTicket(tenantId, 'T-POLICY-1');
    expect(audit.some((r) => r.action === 'workflow.command.rejected' && r.result === 'rejected')).toBe(true);
    expect(gateway.executeCommand).not.toHaveBeenCalled();
  });

  it('enforces idempotency for command submission', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockResolvedValue({ kind: 'created', external_ticket_id: '123', external_ticket_number: 'T20260226.0001' }),
    };
    const { service } = createService(gateway);
    const cmd = createCommand({ idempotencyKey: 'idem-dupe' });

    const first = await service.submitCommand(cmd);
    const second = await service.submitCommand({ ...cmd, command_id: 'different' as any });

    expect(second.command.command_id).toBe(first.command.command_id);
    expect(second.command.idempotency_key).toBe('idem-dupe');
  });

  it('executes happy path create -> assign -> status -> comment and projects inbox state', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest
        .fn()
        .mockResolvedValueOnce({
          kind: 'created',
          external_ticket_id: '5001',
          external_ticket_number: 'T20260226.0007',
          snapshot: { id: 5001, title: 'Printer down', description: 'Queue stuck', status: 'New' },
        })
        .mockResolvedValueOnce({
          kind: 'assigned',
          assigned_to: '42',
          snapshot: { id: 5001, title: 'Printer down', status: 'Assigned', assigned_to: '42' },
        })
        .mockResolvedValueOnce({
          kind: 'status',
          status: 'In Progress',
          snapshot: { id: 5001, title: 'Printer down', description: 'Queue stuck', status: 'In Progress', assigned_to: '42' },
        })
        .mockResolvedValueOnce({
          kind: 'updated',
          snapshot: { id: 5001, title: 'Printer down (urgent)', description: 'Queue stuck - floor 3', status: 'In Progress' },
        }),
    };
    const { service } = createService(gateway);

    const createCmd = createCommand({
      idempotencyKey: 'e2e-create',
      correlation: { trace_id: 'trace-e2e' },
    });
    await service.submitCommand(createCmd);
    await service.processPendingCommands();

    const assignCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'assign',
      payload: { ticket_id: '5001', assignee_resource_id: '42', queue_id: 7, queue_name: 'Service Desk' },
      actor,
      idempotencyKey: 'e2e-assign',
      correlation: { trace_id: 'trace-e2e', ticket_id: '5001' },
    });
    await service.submitCommand(assignCmd);
    await service.processPendingCommands();

    const statusCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'status',
      payload: {
        ticket_id: '5001',
        status: 'In Progress',
      },
      actor,
      idempotencyKey: 'e2e-status',
      correlation: { trace_id: 'trace-e2e', ticket_id: '5001' },
    });
    await service.submitCommand(statusCmd);
    await service.processPendingCommands();

    const commentCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'comment',
      payload: {
        ticket_id: '5001',
        title: 'Printer down (urgent)',
        description: 'Queue stuck - floor 3',
        comment_body: 'User called again. Escalating.',
        comment_visibility: 'internal',
      },
      actor,
      idempotencyKey: 'e2e-comment',
      correlation: { trace_id: 'trace-e2e', ticket_id: '5001' },
    });
    await service.submitCommand(commentCmd);
    await service.processPendingCommands();

    const inbox = await service.listInbox(tenantId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      ticket_id: '5001',
      title: 'Printer down (urgent)',
      status: 'In Progress',
      assigned_to: '42',
      queue_id: 7,
      queue_name: 'Service Desk',
    });
    expect(inbox[0]?.comments).toHaveLength(1);
    expect(inbox[0]?.comments[0]?.visibility).toBe('internal');
  });

  it('records audit/provenance for command execution and sync ingestion', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockResolvedValue({ kind: 'created', external_ticket_id: '9001' }),
    };
    const { service } = createService(gateway);
    const cmd = createCommand({
      idempotencyKey: 'audit-1',
      correlation: { trace_id: 'trace-audit', ticket_id: '9001', job_id: 'job-1' },
    });
    await service.submitCommand(cmd);
    await service.processPendingCommands();

    const event: WorkflowEventEnvelope = {
      event_id: 'evt-1',
      tenant_id: tenantId,
      event_type: 'ticket.updated',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: '9001',
      payload: { status: 'Assigned' },
      occurred_at: '2026-02-26T12:00:00.000Z',
      correlation: { trace_id: 'trace-audit', ticket_id: '9001', job_id: 'job-sync-1' },
      provenance: { source: 'autotask_webhook', fetched_at: '2026-02-26T12:00:01.000Z', adapter_version: 'p0-test' },
    };
    await service.processAutotaskSyncEvent(event);

    const audit = await service.listAuditByTicket(tenantId, '9001');
    expect(audit.some((r) => r.action === 'workflow.command.accepted' && r.correlation.trace_id === 'trace-audit')).toBe(true);
    expect(audit.some((r) => r.action === 'workflow.command.completed' && r.correlation.command_id)).toBe(true);
    const syncAudit = audit.find((r) => r.action === 'workflow.sync.applied');
    expect(syncAudit?.metadata).toMatchObject({
      event_type: 'ticket.updated',
      provenance: expect.objectContaining({ source: 'autotask_webhook', adapter_version: 'p0-test' }),
    });
  });

  it('handles webhook/poll sync duplicates and out-of-order events safely', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
    };
    const { service } = createService(gateway);

    const newer: WorkflowEventEnvelope = {
      event_id: 'evt-new',
      tenant_id: tenantId,
      event_type: 'ticket.updated',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: '5001',
      payload: { title: 'Printer down', status: 'In Progress' },
      occurred_at: '2026-02-26T12:05:00.000Z',
      correlation: { trace_id: 'trace-sync', ticket_id: '5001' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T12:05:10.000Z' },
    };
    const dup = { ...newer };
    const older = {
      ...newer,
      event_id: 'evt-old',
      occurred_at: '2026-02-26T12:04:00.000Z',
      payload: { title: 'Printer down', status: 'Assigned' },
    };

    const first = await service.processAutotaskSyncEvent(newer);
    const duplicate = await service.processAutotaskSyncEvent(dup);
    const outOfOrder = await service.processAutotaskSyncEvent(older);

    expect(first).toMatchObject({ duplicate: false, applied: true });
    expect(duplicate).toMatchObject({ duplicate: true, applied: false });
    expect(outOfOrder).toMatchObject({ duplicate: false, applied: false });
    const inbox = await service.listInbox(tenantId);
    expect(inbox[0]?.status).toBe('In Progress');
  });

  it('retries transient failures and sends to DLQ after max attempts', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest
        .fn()
        .mockRejectedValue(new WorkflowTransientError('Autotask timeout')),
    };
    const { service, repo } = createService(gateway, 2);
    const cmd = createCommand({ idempotencyKey: 'retry-dlq' });
    await service.submitCommand(cmd);

    const firstSweep = await service.processPendingCommands();
    expect(firstSweep.retried).toBe(1);

    // Force retry-ready by polling the specific command and resubmitting its next_retry_at window indirectly:
    // in-memory repo uses timestamps; run second sweep after nudging internal command to be due by resubmitting isn't possible.
    // Instead, fetch command and override next_retry_at through another accepted sweep path is not exposed.
    // Wait a tiny amount and run multiple sweeps; backoff minimum is 5s, so this test manually patches via service internals is avoided.
    const commandAfterFirst = await service.getCommand(cmd.command_id);
    expect(commandAfterFirst?.status).toBe('retry_pending');
    if (commandAfterFirst) {
      commandAfterFirst.next_retry_at = new Date(Date.now() - 1_000).toISOString();
      await repo.upsertCommandAttempt(commandAfterFirst);
    }

    const secondSweep = await service.processPendingCommands();
    expect(secondSweep.dlq).toBe(1);
    const finalCommand = await service.getCommand(cmd.command_id);
    expect(finalCommand?.status).toBe('dlq');
  });

  it('marks terminal errors as failed without retrying', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockRejectedValue(new Error('Autotask validation failed: invalid queue')),
    };
    const { service } = createService(gateway, 3);
    const cmd = createCommand({
      idempotencyKey: 'terminal-fail',
      correlation: { trace_id: 'trace-terminal', ticket_id: 'AT-TERM-1' },
    });
    await service.submitCommand(cmd);

    const sweep = await service.processPendingCommands();
    expect(sweep.failed).toBe(1);
    expect(sweep.retried).toBe(0);
    expect(sweep.dlq).toBe(0);

    const finalCommand = await service.getCommand(cmd.command_id);
    expect(finalCommand?.status).toBe('failed');

    const audit = await service.listAuditByTicket(tenantId, 'AT-TERM-1');
    const failed = audit.find((record) => record.action === 'workflow.command.failed');
    expect(failed?.metadata).toMatchObject({
      failure_class: 'terminal',
      status: 'failed',
    });
  });

  it('surfaces reconciliation divergence when remote snapshot mismatches local inbox state', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockResolvedValue({
        kind: 'created',
        external_ticket_id: '7001',
        snapshot: { status: 'New', assigned_to: '10' },
      }),
      fetchTicketSnapshot: jest.fn().mockResolvedValue({ status: 'Complete', assigned_to: '10' }),
    };
    const { service } = createService(gateway);
    const createCmd = createCommand({
      idempotencyKey: 'reconcile-create',
      correlation: { trace_id: 'trace-rec', ticket_id: '7001' },
    });
    await service.submitCommand(createCmd);
    await service.processPendingCommands();

    const statusCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'status',
      payload: { ticket_id: '7001', status: 'In Progress' },
      actor,
      idempotencyKey: 'reconcile-status',
      correlation: { trace_id: 'trace-rec', ticket_id: '7001' },
    });
    await service.submitCommand(statusCmd);
    await service.processPendingCommands();

    const result = await service.reconcileTicket(tenantId, '7001', { trace_id: 'trace-rec', ticket_id: '7001' });
    expect(result.matched).toBe(false);

    const issues = await service.listReconciliationIssues(tenantId, '7001');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.reason).toBe('autotask_snapshot_mismatch');
    const audit = await service.listAuditByTicket(tenantId, '7001');
    expect(audit.some((r) => r.action === 'workflow.reconciliation.mismatch')).toBe(true);
  });

  it('treats status code vs status label as equivalent during reconcile', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockResolvedValue({
        kind: 'created',
        external_ticket_id: '7002',
        snapshot: { status: 'In Progress', assigned_to: '10' },
      }),
      fetchTicketSnapshot: jest.fn().mockResolvedValue({ status: '8', status_label: 'In Progress', assigned_to: '10' }),
    };
    const { service } = createService(gateway);
    const createCmd = createCommand({
      idempotencyKey: 'reconcile-equivalent',
      correlation: { trace_id: 'trace-rec-equivalent', ticket_id: '7002' },
    });
    await service.submitCommand(createCmd);
    await service.processPendingCommands();

    const result = await service.reconcileTicket(tenantId, '7002', { trace_id: 'trace-rec-equivalent', ticket_id: '7002' });
    expect(result.matched).toBe(true);
  });

  it('persists workflow runtime state across repository reload when file backing is enabled', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cerebro-workflow-repo-'));
    const filePath = join(dir, 'workflow-runtime.json');
    try {
      const gateway: TicketWorkflowGateway = {
        executeCommand: jest.fn().mockResolvedValue({ kind: 'created', external_ticket_id: '8101' }),
      };
      const repo1 = new InMemoryTicketWorkflowRepository({ persistenceFilePath: filePath });
      const service1 = new TicketWorkflowCoreService(repo1, gateway, { maxAttempts: 2 });

      const cmd = createCommand({
        idempotencyKey: 'persist-1',
        correlation: { trace_id: 'trace-persist', ticket_id: '8101' },
      });
      await service1.submitCommand(cmd);
      await service1.processPendingCommands();
      await service1.processAutotaskSyncEvent({
        event_id: 'evt-persist-1',
        tenant_id: tenantId,
        event_type: 'ticket.updated',
        source: 'Autotask',
        entity_type: 'ticket',
        entity_id: '8101',
        payload: { status: 'Assigned' },
        occurred_at: '2026-02-26T13:00:00.000Z',
        correlation: { trace_id: 'trace-persist', ticket_id: '8101' },
        provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T13:00:01.000Z' },
      });

      const repo2 = new InMemoryTicketWorkflowRepository({ persistenceFilePath: filePath });
      const service2 = new TicketWorkflowCoreService(repo2, gateway, { maxAttempts: 2 });
      const inbox = await service2.listInbox(tenantId);
      const restoredCommand = await service2.getCommand(cmd.command_id);
      const duplicate = await service2.processAutotaskSyncEvent({
        event_id: 'evt-persist-1',
        tenant_id: tenantId,
        event_type: 'ticket.updated',
        source: 'Autotask',
        entity_type: 'ticket',
        entity_id: '8101',
        payload: { status: 'Assigned' },
        occurred_at: '2026-02-26T13:00:00.000Z',
        correlation: { trace_id: 'trace-persist', ticket_id: '8101' },
        provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T13:00:01.000Z' },
      });

      expect(restoredCommand?.status).toBe('completed');
      expect(inbox[0]?.ticket_id).toBe('8101');
      expect(duplicate).toMatchObject({ duplicate: true, applied: false });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('audits degraded reconciliation when gateway snapshot fetch is unavailable', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
    };
    const { service } = createService(gateway);

    const result = await service.reconcileTicket(tenantId, '9999', { trace_id: 'trace-skip', ticket_id: '9999' });
    expect(result.matched).toBe(true);
    const audit = await service.listAuditByTicket(tenantId, '9999');
    expect(audit.some((r) => r.action === 'workflow.reconciliation.skipped_fetch_unavailable')).toBe(true);
  });

  it('audits reconcile fetch failure classification when Autotask snapshot fetch is rate-limited', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot: jest.fn().mockRejectedValue(new Error('Autotask API error: 429 ')),
    };
    const { service } = createService(gateway);

    await expect(
      service.reconcileTicket(tenantId, 'VAL-H-S2-001', { trace_id: 'trace-rate-limit', ticket_id: 'VAL-H-S2-001' }),
    ).rejects.toThrow('429');

    const audit = await service.listAuditByTicket(tenantId, 'VAL-H-S2-001');
    const fetchFailed = audit.find((r) => r.action === 'workflow.reconciliation.fetch_failed');
    expect(fetchFailed).toBeTruthy();
    expect(fetchFailed?.reason).toBe('autotask_snapshot_fetch_rate_limited');
    expect(fetchFailed?.metadata).toMatchObject({
      retryable: true,
      degraded_mode: true,
      classification: expect.objectContaining({
        code: 'RATE_LIMIT',
        disposition: 'retry',
      }),
    });
  });
});
