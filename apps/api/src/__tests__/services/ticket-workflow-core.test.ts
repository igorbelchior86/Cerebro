import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  InMemoryTicketWorkflowRepository,
  TicketWorkflowCoreService,
  WorkflowPolicyError,
  WorkflowReconcileFetchError,
  WorkflowTransientError,
  buildCommandEnvelope,
  type TicketWorkflowGateway,
  type WorkflowEventEnvelope,
} from '../../services/orchestration/ticket-workflow-core.js';

describe('TicketWorkflowCoreService (Agent B P0 workflow core)', () => {
  const tenantId = 'tenant-1';
  const actor = { kind: 'user' as const, id: 'user-1', origin: 'ui' };

  function createService(
    gateway: TicketWorkflowGateway,
    maxAttempts = 3,
    options?: { realtimePublisher?: (payload: any) => void }
  ) {
    const repo = new InMemoryTicketWorkflowRepository();
    const service = new TicketWorkflowCoreService(repo, gateway, {
      maxAttempts,
      ...(options?.realtimePublisher ? { realtimePublisher: options.realtimePublisher } : {}),
    });
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

  it('rejects destructive operations without approval token and audits rejection', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
    };
    const { service } = createService(gateway);
    const cmd = createCommand({
      commandType: 'delete',
      payload: { ticket_id: '5001' },
      idempotencyKey: 'idem-delete-without-token',
      correlation: { trace_id: 'trace-delete-without-token', ticket_id: '5001' },
    });

    await expect(service.submitCommand(cmd)).rejects.toBeInstanceOf(WorkflowPolicyError);
    const audit = await service.listAuditByTicket(tenantId, '5001');
    expect(audit.some((r) => r.action === 'workflow.command.rejected' && r.reason === 'missing_destructive_approval_token')).toBe(true);
    expect(gateway.executeCommand).not.toHaveBeenCalled();
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
      commandType: 'update_assign',
      payload: { ticket_id: 'T20260226.0007', assignee_resource_id: '42', queue_id: 7, queue_name: 'Service Desk' },
      actor,
      idempotencyKey: 'e2e-assign',
      correlation: { trace_id: 'trace-e2e', ticket_id: 'T20260226.0007' },
    });
    await service.submitCommand(assignCmd);
    await service.processPendingCommands();

    const statusCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'status_update',
      payload: {
        ticket_id: 'T20260226.0007',
        status: 'In Progress',
      },
      actor,
      idempotencyKey: 'e2e-status',
      correlation: { trace_id: 'trace-e2e', ticket_id: 'T20260226.0007' },
    });
    await service.submitCommand(statusCmd);
    await service.processPendingCommands();

    const commentCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'create_comment_note',
      payload: {
        ticket_id: 'T20260226.0007',
        comment_body: 'User called again. Escalating.',
        comment_visibility: 'internal',
      },
      actor,
      idempotencyKey: 'e2e-comment',
      correlation: { trace_id: 'trace-e2e', ticket_id: 'T20260226.0007' },
    });
    await service.submitCommand(commentCmd);
    await service.processPendingCommands();

    const inbox = await service.listInbox(tenantId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      ticket_id: 'T20260226.0007',
      ticket_number: 'T20260226.0007',
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

  it('emits realtime ticket change events for command/sync lifecycle', async () => {
    const realtimePublisher = jest.fn();
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockResolvedValue({
        kind: 'assigned',
        assigned_to: '42',
        snapshot: { id: 5001, title: 'Printer down', status: 'Assigned', assigned_to: '42' },
      }),
    };
    const { service } = createService(gateway, 3, { realtimePublisher });

    const cmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'update_assign',
      payload: { ticket_id: '5001', assignee_resource_id: '42' },
      actor,
      idempotencyKey: 'rt-assign',
      correlation: { trace_id: 'trace-rt', ticket_id: '5001' },
    });
    await service.submitCommand(cmd);
    await service.processPendingCommands();

    const event: WorkflowEventEnvelope = {
      event_id: 'evt-rt-1',
      tenant_id: tenantId,
      event_type: 'ticket.comment',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: '5001',
      payload: {
        comment_body: 'Comment from sync',
        comment_visibility: 'public',
      },
      occurred_at: '2026-02-26T12:00:00.000Z',
      correlation: { trace_id: 'trace-rt', ticket_id: '5001' },
      provenance: { source: 'autotask_webhook', fetched_at: '2026-02-26T12:00:01.000Z' },
    };
    await service.processAutotaskSyncEvent(event);

    expect(realtimePublisher).toHaveBeenCalled();
    const calls = realtimePublisher.mock.calls.map((entry) => entry[0]);
    expect(calls.some((payload: any) => payload.change_kind === 'assigned' && payload.ticket_id === '5001')).toBe(true);
    expect(calls.some((payload: any) => payload.change_kind === 'process_result' && payload.process_result?.outcome === 'completed')).toBe(true);
    expect(calls.some((payload: any) => payload.change_kind === 'comment' && payload.sync_event_id === 'evt-rt-1')).toBe(true);
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

  it('captures and preserves ticket created_at for inbox projection', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
    };
    const { service } = createService(gateway);

    await service.processAutotaskSyncEvent({
      event_id: 'evt-created-at-1',
      tenant_id: tenantId,
      event_type: 'ticket.created',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: 'T20210115.0001',
      payload: {
        ticket_number: 'T20210115.0001',
        title: 'Legacy ticket',
        created_at: '2021-01-15T14:22:00.000Z',
      },
      occurred_at: '2026-02-26T12:05:00.000Z',
      correlation: { trace_id: 'trace-created-at', ticket_id: 'T20210115.0001' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T12:05:10.000Z' },
    });

    await service.processAutotaskSyncEvent({
      event_id: 'evt-created-at-1b',
      tenant_id: tenantId,
      event_type: 'ticket.updated',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: 'T20210115.0001',
      payload: {
        ticket_number: 'T20210115.0001',
        createDateTime: '2021-01-15T14:22:00.000Z',
        status: 'Waiting Customer',
      },
      occurred_at: '2026-02-26T12:06:00.000Z',
      correlation: { trace_id: 'trace-created-at', ticket_id: 'T20210115.0001' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T12:06:10.000Z' },
    });

    await service.processAutotaskSyncEvent({
      event_id: 'evt-created-at-2',
      tenant_id: tenantId,
      event_type: 'ticket.updated',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: 'T20210115.0001',
      payload: {
        ticket_number: 'T20210115.0001',
        status: 'In Progress',
      },
      occurred_at: '2026-02-26T12:10:00.000Z',
      correlation: { trace_id: 'trace-created-at', ticket_id: 'T20210115.0001' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T12:10:10.000Z' },
    });

    await service.processAutotaskSyncEvent({
      event_id: 'evt-created-at-fallback',
      tenant_id: tenantId,
      event_type: 'ticket.created',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: 'T20200202.0003',
      payload: {
        ticket_number: 'T20200202.0003',
        title: 'Legacy ticket without explicit created_at',
      },
      occurred_at: '2026-02-26T12:11:00.000Z',
      correlation: { trace_id: 'trace-created-at-2', ticket_id: 'T20200202.0003' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-02-26T12:11:10.000Z' },
    });

    const inbox = await service.listInbox(tenantId);
    const explicitCreated = inbox.find((row) => row.ticket_id === 'T20210115.0001');
    const inferredCreated = inbox.find((row) => row.ticket_id === 'T20200202.0003');

    expect(explicitCreated?.created_at).toBe('2021-01-15T14:22:00.000Z');
    expect(inferredCreated?.created_at).toBeUndefined();
  });

  it('keeps listInbox as read-only even when many rows are sparse', async () => {
    const previousRemoteBatchSize = process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE;
    process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE = '50';
    const fetchTicketSnapshot = jest.fn().mockImplementation(async (_tenantId: string, ticketRef: string) => ({
      company_name: `Org ${ticketRef}`,
      contact_name: `Requester ${ticketRef}`,
    }));
    try {
      const gateway: TicketWorkflowGateway = {
        executeCommand: jest.fn(),
        fetchTicketSnapshot,
      };
      const { service, repo } = createService(gateway);

      for (let i = 1; i <= 30; i += 1) {
        const ticketNumber = `T20260303.${String(i).padStart(4, '0')}`;
        await repo.upsertInboxTicket({
          tenant_id: tenantId,
          ticket_id: ticketNumber,
          ticket_number: ticketNumber,
          title: `Ticket ${i}`,
          description: `Description ${i}`,
          status: 'New',
          comments: [],
          source_of_truth: 'Autotask',
          updated_at: `2026-03-03T20:${String(i).padStart(2, '0')}:00.000Z`,
        });
      }

      const inbox = await service.listInbox(tenantId);
      const unresolved = inbox.filter((row) => !String(row.company || '').trim() || !String(row.requester || '').trim());
      expect(unresolved).toHaveLength(30);
      expect(fetchTicketSnapshot).not.toHaveBeenCalled();
    } finally {
      if (previousRemoteBatchSize === undefined) delete process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE;
      else process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE = previousRemoteBatchSize;
    }
  });

  it('does not trigger remote hydration attempts across repeated listInbox calls', async () => {
    const previousBatchSize = process.env.P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE;
    const previousRemoteBatchSize = process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE;
    process.env.P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE = '2';
    process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE = '2';
    const fetchTicketSnapshot = jest.fn().mockImplementation(async (_tenant: string, ticketRef: string) => {
      if (ticketRef === 'T20260303.0005') {
        return { company_name: 'Org T20260303.0005', contact_name: 'Requester T20260303.0005' };
      }
      return null;
    });
    try {
      const gateway: TicketWorkflowGateway = {
        executeCommand: jest.fn(),
        fetchTicketSnapshot,
      };
      const { service, repo } = createService(gateway);

      for (let i = 1; i <= 5; i += 1) {
        const ticketNumber = `T20260303.${String(i).padStart(4, '0')}`;
        await repo.upsertInboxTicket({
          tenant_id: tenantId,
          ticket_id: ticketNumber,
          ticket_number: ticketNumber,
          title: `Ticket ${i}`,
          description: `Description ${i}`,
          status: 'New',
          comments: [],
          source_of_truth: 'Autotask',
          updated_at: `2026-03-03T21:${String(i).padStart(2, '0')}:00.000Z`,
        });
      }

      await service.listInbox(tenantId);
      await service.listInbox(tenantId);
      await service.listInbox(tenantId);
      const inbox = await service.listInbox(tenantId);

      const target = inbox.find((row) => row.ticket_id === 'T20260303.0005');
      expect(fetchTicketSnapshot).not.toHaveBeenCalled();
      expect(target?.company).toBeUndefined();
      expect(target?.requester).toBeUndefined();
    } finally {
      if (previousBatchSize === undefined) delete process.env.P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE;
      else process.env.P0_WORKFLOW_INBOX_HYDRATION_BATCH_SIZE = previousBatchSize;
      if (previousRemoteBatchSize === undefined) delete process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE;
      else process.env.P0_WORKFLOW_INBOX_HYDRATION_REMOTE_BATCH_SIZE = previousRemoteBatchSize;
    }
  });

  it('does not promote snapshot aliases during listInbox read', async () => {
    const fetchTicketSnapshot = jest.fn().mockResolvedValue({
      company_name: 'Bethel Presbyterian Church',
      contact_name: 'Allen Hauser',
      status_label: 'In Progress',
      assigned_to: '321',
      queue_id: 7,
      queue_name: 'Service Desk',
    });
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot,
    };
    const { service, repo } = createService(gateway);

    await repo.upsertInboxTicket({
      tenant_id: tenantId,
      ticket_id: 'T20260303.0015',
      ticket_number: 'T20260303.0015',
      title: 'Unable to Open PDF Files Due to Adobe Program Error',
      description: 'Initial payload',
      comments: [],
      source_of_truth: 'Autotask',
      updated_at: '2026-03-03T22:00:00.000Z',
      domain_snapshots: {
        tickets: {
          contact_name: 'Allen Hauser',
        },
        'correlates.ticket_metadata': {
          company_name: 'Bethel Presbyterian Church',
          status_label: 'In Progress',
          queue_name: 'Service Desk',
        },
        'correlates.resources': {
          assigned_to: '321',
        },
      },
    });

    const inbox = await service.listInbox(tenantId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      ticket_id: 'T20260303.0015',
    });
    expect(inbox[0]?.company).toBeUndefined();
    expect(inbox[0]?.requester).toBeUndefined();
    expect(inbox[0]?.status).toBeUndefined();
    expect(inbox[0]?.assigned_to).toBeUndefined();
    expect(inbox[0]?.queue_name).toBeUndefined();
    expect(fetchTicketSnapshot).not.toHaveBeenCalled();
  });

  it('does not perform remote hydration during listInbox read', async () => {
    const fetchTicketSnapshot = jest.fn().mockResolvedValue({
      company_name: 'Bethel Presbyterian Church',
      contact_name: 'Allen Hauser',
      status_label: 'Waiting Customer',
      assigned_to: 'Igor Belchior',
      createDateTime: '2026-03-03T12:54:00.000Z',
    });
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot,
    };
    const { service, repo } = createService(gateway);

    await repo.upsertInboxTicket({
      tenant_id: tenantId,
      ticket_id: 'T20260303.0019',
      ticket_number: 'T20260303.0019',
      title: 'User Issue IMAC trying to send email and said cannot send message',
      description: 'Initial payload',
      company: 'Unknown org',
      requester: 'Unknown requester',
      status: '-',
      assigned_to: 'Unassigned',
      created_at: 'not-a-date',
      comments: [],
      source_of_truth: 'Autotask',
      updated_at: '2026-03-03T23:00:00.000Z',
    });

    const inbox = await service.listInbox(tenantId);
    expect(fetchTicketSnapshot).not.toHaveBeenCalled();
    expect(inbox[0]).toMatchObject({
      ticket_id: 'T20260303.0019',
      company: 'Unknown org',
      requester: 'Unknown requester',
      status: '-',
      assigned_to: 'Unassigned',
      created_at: 'not-a-date',
    });
  });

  it('does not promote domain snapshots during listInbox read', async () => {
    const fetchTicketSnapshot = jest.fn().mockResolvedValue({
      company_name: 'Ferguson Supply & Box Company',
      contact_name: 'Jasen Nolff',
      status_label: 'Waiting Customer',
      assigned_to: 'Igor Belchior',
      createDateTime: '2026-03-03T12:54:00.000Z',
    });
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot,
    };
    const { service, repo } = createService(gateway);

    await repo.upsertInboxTicket({
      tenant_id: tenantId,
      ticket_id: 'T20260303.0015',
      ticket_number: 'T20260303.0015',
      title: 'Unable to Open PDF Files Due to Adobe Program Error',
      description: 'Initial payload',
      company: 'Unknown org',
      requester: 'Unknown requester',
      status: '-',
      assigned_to: 'Unassigned',
      created_at: 'invalid',
      comments: [],
      source_of_truth: 'Autotask',
      updated_at: '2026-03-03T23:05:00.000Z',
      domain_snapshots: {
        tickets: {
          company_name: 'Unknown org',
          requester_name: 'Unknown requester',
          status: '-',
          assigned_to: 'Unassigned',
          created_at: 'invalid',
        },
        'correlates.ticket_metadata': {
          company_name: 'Unknown org',
          requester_name: 'Unknown requester',
          status_label: '-',
          created_at: 'invalid',
        },
        'correlates.resources': {
          assigned_to: 'Unassigned',
        },
      },
    });

    const inbox = await service.listInbox(tenantId);
    expect(fetchTicketSnapshot).not.toHaveBeenCalled();
    expect(inbox[0]).toMatchObject({
      ticket_id: 'T20260303.0015',
      company: 'Unknown org',
      requester: 'Unknown requester',
      status: '-',
      assigned_to: 'Unassigned',
      created_at: 'invalid',
    });
  });

  it('prefers meaningful company/requester when deduping alias rows', async () => {
    const { service, repo } = createService({
      executeCommand: jest.fn(),
      fetchTicketSnapshot: jest.fn(),
    });

    await repo.upsertInboxTicket({
      tenant_id: tenantId,
      ticket_id: '9001',
      ticket_number: 'T20260304.0006',
      title: 'Alias ticket row',
      company: 'Unknown org',
      requester: 'Unknown requester',
      status: 'Waiting Customer',
      comments: [],
      source_of_truth: 'Autotask',
      updated_at: '2026-03-04T14:20:00.000Z',
    });

    await repo.upsertInboxTicket({
      tenant_id: tenantId,
      ticket_id: 'T20260304.0006',
      ticket_number: 'T20260304.0006',
      title: 'Alias ticket row',
      company: 'GARMON & CO. INC',
      requester: 'Tammy Lankford',
      status: 'Waiting Customer',
      comments: [],
      source_of_truth: 'Autotask',
      updated_at: '2026-03-04T14:21:00.000Z',
    });

    const inbox = await service.listInbox(tenantId);
    const deduped = inbox.find((row) => row.ticket_number === 'T20260304.0006');
    expect(deduped).toBeTruthy();
    expect(deduped?.company).toBe('GARMON & CO. INC');
    expect(deduped?.requester).toBe('Tammy Lankford');
  });

  it('enriches partial sync payload with canonical snapshot before persisting inbox row', async () => {
    const fetchTicketSnapshot = jest.fn().mockResolvedValue({
      company_name: 'Ferguson Supply & Box Company',
      contact_name: 'Jasen Nolff',
      status_label: 'Waiting Customer',
      assigned_to: 'Igor Belchior',
      createDateTime: '2026-03-03T17:54:00.000Z',
      queue_id: 8,
      queue_name: 'Level I Support',
    });
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot,
    };
    const { service } = createService(gateway);

    const event: WorkflowEventEnvelope = {
      event_id: 'evt-canonical-sync-1',
      tenant_id: tenantId,
      event_type: 'ticket.created',
      source: 'Autotask',
      entity_type: 'ticket',
      entity_id: 'T20260303.0015',
      payload: {
        external_id: '112233',
        ticket_number: 'T20260303.0015',
        title: 'Unable to Open PDF Files Due to Adobe Program Error',
        status: '5',
      },
      occurred_at: '2026-03-03T18:00:00.000Z',
      correlation: { trace_id: 'trace-canonical-sync-1', ticket_id: 'T20260303.0015' },
      provenance: { source: 'autotask_poller', fetched_at: '2026-03-03T18:00:02.000Z' },
    };

    await service.processAutotaskSyncEvent(event);
    const inbox = await service.listInbox(tenantId);
    const row = inbox.find((item) => item.ticket_number === 'T20260303.0015');
    expect(fetchTicketSnapshot).toHaveBeenCalledWith(tenantId, 'T20260303.0015');
    expect(row).toMatchObject({
      ticket_id: 'T20260303.0015',
      company: 'Ferguson Supply & Box Company',
      requester: 'Jasen Nolff',
      status: 'Waiting Customer',
      assigned_to: 'Igor Belchior',
      queue_id: 8,
      queue_name: 'Level I Support',
      created_at: '2026-03-03T17:54:00.000Z',
    });
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

  it('captures operation metadata for new alias commands in retryable and terminal paths', async () => {
    let statusUpdateAttempts = 0;
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn().mockImplementation(async (command) => {
        if (command.command_type === 'status_update') {
          statusUpdateAttempts += 1;
          throw new WorkflowTransientError(`Autotask timeout #${statusUpdateAttempts}`);
        }
        throw new Error('Autotask validation failed: invalid status');
      }),
    };
    const { service, repo } = createService(gateway, 2);
    const retryableCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'status_update',
      payload: { ticket_id: 'AT-ALIAS-1', status: 'In Progress' },
      actor,
      idempotencyKey: 'alias-retryable',
      correlation: { trace_id: 'trace-alias-retryable', ticket_id: 'AT-ALIAS-1' },
    });
    await service.submitCommand(retryableCmd);
    await service.processPendingCommands();
    const retryableState = await service.getCommand(retryableCmd.command_id);
    expect(retryableState?.status).toBe('retry_pending');
    if (retryableState) {
      retryableState.next_retry_at = new Date(Date.now() - 1_000).toISOString();
      await repo.upsertCommandAttempt(retryableState);
    }
    await service.processPendingCommands();
    const retryableFinal = await service.getCommand(retryableCmd.command_id);
    expect(retryableFinal?.status).toBe('dlq');

    const terminalCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'create_comment_note',
      payload: { ticket_id: 'AT-ALIAS-2', comment_body: 'hello' },
      actor,
      idempotencyKey: 'alias-terminal',
      correlation: { trace_id: 'trace-alias-terminal', ticket_id: 'AT-ALIAS-2' },
    });
    await service.submitCommand(terminalCmd);
    await service.processPendingCommands();
    const terminalState = await service.getCommand(terminalCmd.command_id);
    expect(terminalState?.status).toBe('failed');

    const retryableAudit = await service.listAuditByTicket(tenantId, 'AT-ALIAS-1');
    const retryableFailure = retryableAudit.find((record) => record.action === 'workflow.command.failed');
    expect(retryableFailure?.metadata).toMatchObject({
      command_type: 'status_update',
      autotask_operation: 'tickets.update_status',
      autotask_handler: 'status',
    });

    const terminalAudit = await service.listAuditByTicket(tenantId, 'AT-ALIAS-2');
    const terminalFailure = terminalAudit.find((record) => record.action === 'workflow.command.failed');
    expect(terminalFailure?.metadata).toMatchObject({
      command_type: 'create_comment_note',
      autotask_operation: 'ticket_notes.create_comment_note',
      autotask_handler: 'comment_note',
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
    expect(result.classification).toBe('mismatch');
    expect(result.domains.some((domain) => domain.classification === 'mismatch')).toBe(true);

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
    expect(result.classification).toBe('match');
  });

  it('classifies missing_snapshot when local note fingerprint exists but remote note snapshot is absent', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest
        .fn()
        .mockResolvedValueOnce({
          kind: 'created',
          external_ticket_id: '7110',
          snapshot: { status: 'In Progress', assigned_to: '10' },
        })
        .mockResolvedValueOnce({
          kind: 'updated',
          snapshot: { status: 'In Progress', assigned_to: '10' },
        }),
      fetchTicketSnapshot: jest.fn().mockResolvedValue({ status: 'In Progress', assigned_to: '10' }),
    };
    const { service } = createService(gateway);
    const createCmd = createCommand({
      idempotencyKey: 'reconcile-missing-note-create',
      correlation: { trace_id: 'trace-rec-missing', ticket_id: '7110' },
    });
    await service.submitCommand(createCmd);
    await service.processPendingCommands();
    const commentCmd = buildCommandEnvelope({
      tenantId,
      targetIntegration: 'Autotask',
      commandType: 'comment',
      payload: {
        ticket_id: '7110',
        comment_body: 'Added domain note',
        comment_visibility: 'internal',
      },
      actor,
      idempotencyKey: 'reconcile-missing-note-comment',
      correlation: { trace_id: 'trace-rec-missing', ticket_id: '7110' },
    });
    await service.submitCommand(commentCmd);
    await service.processPendingCommands();

    const result = await service.reconcileTicket(tenantId, '7110', { trace_id: 'trace-rec-missing', ticket_id: '7110' });
    expect(result.matched).toBe(false);
    expect(result.classification).toBe('missing_snapshot');
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
    expect(result.classification).toBe('skipped');
    const audit = await service.listAuditByTicket(tenantId, '9999');
    expect(audit.some((r) => r.action === 'workflow.reconciliation.skipped_fetch_unavailable')).toBe(true);
  });

  it('audits reconcile fetch failure classification when Autotask snapshot fetch is rate-limited', async () => {
    const gateway: TicketWorkflowGateway = {
      executeCommand: jest.fn(),
      fetchTicketSnapshot: jest.fn().mockRejectedValue(new Error('Autotask API error: 429 ')),
    };
    const { service } = createService(gateway);

    const attempts: Array<'retry_pending' | 'dlq'> = [];
    for (let i = 0; i < 3; i += 1) {
      try {
        await service.reconcileTicket(tenantId, 'VAL-H-S2-001', { trace_id: 'trace-rate-limit', ticket_id: 'VAL-H-S2-001' });
      } catch (error) {
        expect(error).toBeInstanceOf(WorkflowReconcileFetchError);
        attempts.push((error as WorkflowReconcileFetchError).info.operation.disposition);
      }
    }
    expect(attempts[0]).toBe('retry_pending');
    expect(attempts[2]).toBe('dlq');

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
