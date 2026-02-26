import { AutotaskTicketWorkflowGateway } from '../../services/autotask-ticket-workflow-gateway';
import type { WorkflowCommandEnvelope } from '../../services/ticket-workflow-core';

function buildCommand(overrides: Partial<WorkflowCommandEnvelope> = {}): WorkflowCommandEnvelope {
  return {
    command_id: 'cmd-1',
    tenant_id: 'tenant-1',
    target_integration: 'Autotask',
    command_type: 'update',
    payload: {
      ticket_id: 'T20260226.0033',
      status: 'In Progress',
      comment_body: 'note',
      comment_visibility: 'internal',
    },
    actor: { kind: 'user', id: 'user-1', origin: 'api' },
    idempotency_key: 'idem-1',
    audit_metadata: {},
    correlation: { trace_id: 'trace-1', ticket_id: 'T20260226.0033', command_id: 'cmd-1' },
    requested_at: '2026-02-26T00:00:00.000Z',
    ...overrides,
  };
}

describe('AutotaskTicketWorkflowGateway', () => {
  it('resolves ticket number to numeric id and maps status label before update', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      getTicketStatusOptions: jest.fn().mockResolvedValue([{ id: 1, label: 'New' }, { id: 5, label: 'In Progress' }]),
      updateTicket: jest.fn().mockResolvedValue({}),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033', status: 5 }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    await gateway.executeCommand(buildCommand());

    expect(mockClient.updateTicket).toHaveBeenCalledWith(333, expect.objectContaining({ status: 5 }));
    expect(mockClient.createTicketNote).toHaveBeenCalledWith(
      333,
      expect.objectContaining({ noteType: 3, publish: 2, noteText: 'note' })
    );
  });
});
