import { AutotaskClient } from '../clients/autotask.js';
import type {
  TicketWorkflowGateway,
  WorkflowCommandEnvelope,
  WorkflowExecutionResult,
} from './ticket-workflow-core.js';

export class AutotaskTicketWorkflowGateway implements TicketWorkflowGateway {
  constructor(private readonly clientFactory: (tenantId: string) => Promise<AutotaskClient | null>) {}

  async executeCommand(command: WorkflowCommandEnvelope): Promise<WorkflowExecutionResult> {
    const client = await this.clientFactory(command.tenant_id);
    if (!client) {
      throw new Error('Autotask integration is not configured for this tenant');
    }

    const payload = command.payload as any;
    if (command.command_type === 'create') {
      const created = await client.createTicket({
        title: payload.title,
        description: payload.description,
        companyID: payload.company_id ?? payload.companyID,
        contactID: payload.contact_id ?? payload.contactID,
        queueID: payload.queue_id ?? payload.queueID,
        priority: payload.priority,
        status: payload.status,
      });
      return {
        kind: 'created',
        external_ticket_id: String((created as any)?.id ?? ''),
        external_ticket_number: String((created as any)?.ticketNumber ?? ''),
        snapshot: this.mapTicketSnapshot(created),
      };
    }

    if (command.command_type === 'assign') {
      const ticketId = this.requireTicketId(payload, command);
      await client.updateTicket(ticketId, {
        assignedResourceID: payload.assignee_resource_id ?? payload.assignedResourceID,
        queueID: payload.queue_id ?? payload.queueID,
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return {
        kind: 'assigned',
        assigned_to: String(payload.assignee_resource_id ?? payload.assignedResourceID ?? ''),
        ...(snapshot ? { snapshot } : {}),
      };
    }

    if (command.command_type === 'status') {
      const ticketId = this.requireTicketId(payload, command);
      await client.updateTicket(ticketId, {
        status: payload.status,
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return {
        kind: 'status',
        status: String(payload.status ?? ''),
        ...(snapshot ? { snapshot } : {}),
      };
    }

    if (command.command_type === 'update') {
      const ticketId = this.requireTicketId(payload, command);
      const patch: Record<string, unknown> = {};
      if (payload.title !== undefined) patch.title = payload.title;
      if (payload.description !== undefined) patch.description = payload.description;
      if (payload.priority !== undefined) patch.priority = payload.priority;
      if (payload.queue_id !== undefined || payload.queueID !== undefined) patch.queueID = payload.queue_id ?? payload.queueID;
      if (payload.status !== undefined) patch.status = payload.status;

      if (Object.keys(patch).length > 0) {
        await client.updateTicket(ticketId, patch);
      }

      const commentBody = String(payload.comment_body || '').trim();
      if (commentBody) {
        await client.createTicketNote(ticketId, {
          noteText: commentBody,
          noteType: String(payload.comment_visibility || '').toLowerCase() === 'internal' ? 'Internal' : 'Note',
          publish: String(payload.comment_visibility || '').toLowerCase() !== 'internal',
        });
      }

      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (command.command_type === 'time_entry') {
      const ticketId = this.requireTicketId(payload, command);
      const entry = await client.createTimeEntry({
        ticketID: ticketId,
        resourceID: payload.resource_id ?? payload.resourceID,
        hoursWorked: payload.hours_worked ?? payload.hoursWorked,
        summaryNotes: payload.summary_notes ?? payload.summaryNotes,
      });
      return {
        kind: 'time_entry',
        entry_id: (entry as any)?.id ?? undefined,
      };
    }

    throw new Error(`Unsupported Autotask command_type: ${command.command_type}`);
  }

  async fetchTicketSnapshot(tenantId: string, ticketId: string): Promise<Record<string, unknown> | null> {
    const client = await this.clientFactory(tenantId);
    if (!client) return null;

    if (/^\d+$/.test(ticketId)) {
      const ticket = await client.getTicket(Number(ticketId));
      return this.mapTicketSnapshot(ticket);
    }
    const ticket = await client.getTicketByTicketNumber(ticketId);
    return this.mapTicketSnapshot(ticket);
  }

  private requireTicketId(payload: Record<string, unknown>, command: WorkflowCommandEnvelope): string | number {
    const raw = payload.ticket_id ?? payload.ticketId ?? command.correlation.ticket_id;
    const ticketId = String(raw ?? '').trim();
    if (!ticketId) {
      throw new Error(`Command ${command.command_id} requires ticket_id`);
    }
    return /^\d+$/.test(ticketId) ? Number(ticketId) : ticketId;
  }

  private async safeFetchTicketSnapshot(client: AutotaskClient, ticketId: string | number): Promise<Record<string, unknown> | null> {
    try {
      if (typeof ticketId === 'number') {
        const ticket = await client.getTicket(ticketId);
        return this.mapTicketSnapshot(ticket);
      }
      const ticket = /^\d+$/.test(ticketId)
        ? await client.getTicket(Number(ticketId))
        : await client.getTicketByTicketNumber(ticketId);
      return this.mapTicketSnapshot(ticket);
    } catch {
      return null;
    }
  }

  private mapTicketSnapshot(ticket: any): Record<string, unknown> {
    return {
      id: ticket?.id,
      ticket_number: ticket?.ticketNumber,
      title: ticket?.title ?? ticket?.summary,
      description: ticket?.description,
      status: ticket?.status,
      assigned_to: ticket?.assignedResourceID,
      queue_id: ticket?.queueID,
      company_id: ticket?.companyID,
    };
  }
}

