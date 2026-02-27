import { AutotaskTicketWorkflowGateway } from '../../services/autotask-ticket-workflow-gateway';
import type { WorkflowCommandEnvelope } from '../../services/ticket-workflow-core';

function buildCommand(overrides: Partial<WorkflowCommandEnvelope> = {}): WorkflowCommandEnvelope {
  return {
    command_id: 'cmd-1',
    tenant_id: 'tenant-1',
    target_integration: 'Autotask',
    command_type: 'update_status',
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
  it('executes create ticket operation from frozen matrix command type', async () => {
    const mockClient = {
      createTicket: jest.fn().mockResolvedValue({ id: 1200, ticketNumber: 'T20260227.1200', title: 'Printer down' }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    const result = await gateway.executeCommand(buildCommand({
      command_type: 'create',
      payload: {
        title: 'Printer down',
        description: 'Queue stuck',
        company_id: 10,
      },
    }));

    expect(mockClient.createTicket).toHaveBeenCalledWith(expect.objectContaining({ title: 'Printer down', companyID: 10 }));
    expect(result).toMatchObject({ kind: 'created', external_ticket_id: '1200', external_ticket_number: 'T20260227.1200' });
  });

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
    expect(mockClient.createTicketNote).not.toHaveBeenCalled();
  });

  it('handles explicit comment command using note payload aliases', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 777, ticketNumber: 'T20260226.0099' }),
      updateTicket: jest.fn().mockResolvedValue({}),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 777, ticketNumber: 'T20260226.0099', status: 1 }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'create_comment_note',
      payload: {
        ticket_id: 'T20260226.0099',
        note_body: 'Public update',
        note_visibility: 'public',
      },
    }));

    expect(mockClient.createTicketNote).toHaveBeenCalledWith(
      777,
      expect.objectContaining({ noteText: 'Public update', noteType: 3, publish: 1 }),
    );
  });

  it('rejects comment/note command without body', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 888, ticketNumber: 'T20260226.0100' }),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 888, ticketNumber: 'T20260226.0100', status: 1 }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    await expect(gateway.executeCommand(buildCommand({
      command_type: 'comment_note',
      payload: { ticket_id: 'T20260226.0100' },
    }))).rejects.toThrow('requires comment_body');
  });

  it('rejects legacy update payload that includes out-of-scope fields', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 999, ticketNumber: 'T20260226.0111' }),
      updateTicket: jest.fn().mockResolvedValue({}),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 999, ticketNumber: 'T20260226.0111', status: 1 }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    await expect(gateway.executeCommand(buildCommand({
      command_type: 'update',
      payload: {
        ticket_id: 'T20260226.0111',
        priority: 1,
      },
    }))).rejects.toThrow('frozen matrix');
  });

  it('executes time entry create operation from approved matrix scope', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      createTimeEntry: jest.fn().mockResolvedValue({ id: 2222 }),
    } as any;

    const gateway = new AutotaskTicketWorkflowGateway(async () => mockClient);
    const result = await gateway.executeCommand(buildCommand({
      command_type: 'time_entry',
      payload: {
        ticket_id: 'T20260226.0033',
        resource_id: 42,
        hours_worked: 1.5,
        summary_notes: 'Remote troubleshooting',
      },
    }));

    expect(mockClient.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({ ticketID: 333, resourceID: 42, hoursWorked: 1.5, summaryNotes: 'Remote troubleshooting' })
    );
    expect(result).toMatchObject({ kind: 'time_entry', entry_id: 2222 });
  });
});
