import { AutotaskTicketWorkflowGateway } from '../../services/orchestration/autotask-ticket-workflow-gateway';
import type { AutotaskClient } from '../../clients/autotask.js';
import type { WorkflowCommandEnvelope } from '../../services/orchestration/ticket-workflow-core';

function asAutotaskClient(client: Record<string, unknown>): AutotaskClient {
  return client as unknown as AutotaskClient;
}

function buildGateway(mockClient: Record<string, unknown>) {
  return new AutotaskTicketWorkflowGateway(async () => asAutotaskClient(mockClient));
}

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
      getResource: jest.fn().mockResolvedValue({ id: 42, defaultServiceDeskRoleID: 9 }),
    };

    const gateway = buildGateway(mockClient);
    const result = await gateway.executeCommand(buildCommand({
      command_type: 'create',
      payload: {
        title: 'Printer down',
        description: 'Queue stuck',
        company_id: 10,
        assignee_resource_id: 42,
      },
    }));

    expect(mockClient.getResource).toHaveBeenCalledWith(42);
    expect(mockClient.createTicket).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Printer down',
      companyID: 10,
      assignedResourceID: 42,
      assignedResourceRoleID: 9,
    }));
    expect(result).toMatchObject({ kind: 'created', external_ticket_id: '1200', external_ticket_number: 'T20260227.1200' });
  });

  it('adds assignedResourceRoleID on assign command when only resource id is provided', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      getResource: jest.fn().mockResolvedValue({ id: 77, defaultServiceDeskRoleID: 12 }),
      updateTicket: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033', status: 1 }),
    };

    const gateway = buildGateway(mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'assign',
      payload: { ticket_id: 'T20260226.0033', assignee_resource_id: 77 },
    }));

    expect(mockClient.getResource).toHaveBeenCalledWith(77);
    expect(mockClient.updateTicket).toHaveBeenCalledWith(333, expect.objectContaining({
      assignedResourceID: 77,
      assignedResourceRoleID: 12,
    }));
  });

  it('resolves ticket number to numeric id and maps status label before update', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      getTicketStatusOptions: jest.fn().mockResolvedValue([{ id: 1, label: 'New' }, { id: 5, label: 'In Progress' }]),
      updateTicket: jest.fn().mockResolvedValue({}),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033', status: 5 }),
    };

    const gateway = buildGateway(mockClient);
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
    };

    const gateway = buildGateway(mockClient);
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

  it('normalizes markdown-rich comment body before writing ticket note', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 778, ticketNumber: 'T20260226.0101' }),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 778, ticketNumber: 'T20260226.0101', status: 1 }),
    };

    const gateway = buildGateway(mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'create_comment_note',
      payload: {
        ticket_id: 'T20260226.0101',
        note_body: '### Resolution\n1. **Open** [Portal](https://portal.example.com)\n2. Restart `Agent`',
        note_visibility: 'public',
      },
    }));

    expect(mockClient.createTicketNote).toHaveBeenCalledWith(
      778,
      expect.objectContaining({
        noteText: 'RESOLUTION\n1. Open Portal (https://portal.example.com)\n2. Restart Agent',
      }),
    );
  });

  it('rejects comment/note command without body', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 888, ticketNumber: 'T20260226.0100' }),
      createTicketNote: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 888, ticketNumber: 'T20260226.0100', status: 1 }),
    };

    const gateway = buildGateway(mockClient);
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
    };

    const gateway = buildGateway(mockClient);
    await expect(gateway.executeCommand(buildCommand({
      command_type: 'ticket_delete',
      payload: {
        ticket_id: 'T20260226.0111',
        destructive_approval_token: '',
      },
    }))).rejects.toThrow('missing_destructive_approval_token');
  });

  it('executes time entry create operation from approved matrix scope', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      createTimeEntry: jest.fn().mockResolvedValue({ id: 2222 }),
    };

    const gateway = buildGateway(mockClient);
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

  it('normalizes markdown-rich summary notes before writing time entry', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 334, ticketNumber: 'T20260226.0034' }),
      createTimeEntry: jest.fn().mockResolvedValue({ id: 2223 }),
    };

    const gateway = buildGateway(mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'time_entry',
      payload: {
        ticket_id: 'T20260226.0034',
        resource_id: 42,
        hours_worked: 0.5,
        summary_notes: '- Checked DNS\n- **Flush** cache\nSee [KB](https://kb.example.com)',
      },
    }));

    expect(mockClient.createTimeEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketID: 334,
        summaryNotes: '- Checked DNS\n- Flush cache\nSee KB (https://kb.example.com)',
      })
    );
  });

  it('returns PSA-confirmed time entry mirror fields for UI syncing', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 335, ticketNumber: 'T20260226.0035' }),
      createTimeEntry: jest.fn().mockResolvedValue({
        id: 2224,
        hoursWorked: 0.2,
        minutesWorked: 12,
        hoursToBill: 0.25,
        createDate: '2026-03-04T19:20:00.000Z',
      }),
    };

    const gateway = buildGateway(mockClient);
    const result = await gateway.executeCommand(buildCommand({
      command_type: 'time_entry',
      payload: {
        ticket_id: 'T20260226.0035',
        resource_id: 42,
        hours_worked: 0.2,
        summary_notes: 'Follow-up call',
      },
    }));

    expect(result).toMatchObject({
      kind: 'time_entry',
      entry_id: 2224,
      worked_hours: 0.2,
      worked_minutes: 12,
      billable_hours: 0.25,
      snapshot: {
        resource_id: 42,
        worked_hours_saved: 0.2,
        worked_minutes_saved: 12,
        billable_hours_saved: 0.25,
        summary_notes: 'Follow-up call',
        created_at: '2026-03-04T19:20:00.000Z',
      },
    });
  });

  it('executes update_priority operation from previously excluded scope', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033' }),
      updateTicketPriority: jest.fn().mockResolvedValue({}),
      getTicket: jest.fn().mockResolvedValue({ id: 333, ticketNumber: 'T20260226.0033', status: 5 }),
    };

    const gateway = buildGateway(mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'update_priority',
      payload: { ticket_id: 'T20260226.0033', priority: 3 },
    }));

    expect(mockClient.updateTicketPriority).toHaveBeenCalledWith(333, 3);
  });

  it('requires destructive approval token for ticket delete', async () => {
    const mockClient = {
      getTicketByTicketNumber: jest.fn().mockResolvedValue({ id: 444, ticketNumber: 'T20260226.0444' }),
      deleteTicket: jest.fn().mockResolvedValue({}),
    };

    const gateway = buildGateway(mockClient);
    await gateway.executeCommand(buildCommand({
      command_type: 'ticket_delete',
      payload: { ticket_id: 'T20260226.0444', destructive_approval_token: 'allow-1' },
    }));

    expect(mockClient.deleteTicket).toHaveBeenCalledWith(444);
  });
});
