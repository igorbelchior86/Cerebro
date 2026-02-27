import { AutotaskClient } from '../clients/autotask.js';
import type {
  TicketWorkflowGateway,
  WorkflowCommandEnvelope,
  WorkflowExecutionResult,
} from './ticket-workflow-core.js';
import { resolveAutotaskOperation } from './autotask-operation-registry.js';

export class AutotaskTicketWorkflowGateway implements TicketWorkflowGateway {
  constructor(private readonly clientFactory: (tenantId: string) => Promise<AutotaskClient | null>) {}
  private statusLabelCache = new Map<AutotaskClient, Map<string, string>>();

  private async resolveWriteTicketId(client: AutotaskClient, ticketRef: string | number): Promise<string | number> {
    if (typeof ticketRef === 'number') return ticketRef;
    const raw = String(ticketRef || '').trim();
    if (/^\d+$/.test(raw)) return Number(raw);
    const ticket = await client.getTicketByTicketNumber(raw);
    const id = Number((ticket as any)?.id);
    return Number.isFinite(id) ? id : raw;
  }

  private async normalizeStatusForWrite(
    client: AutotaskClient,
    statusValue: unknown
  ): Promise<unknown> {
    const raw = String(statusValue ?? '').trim();
    if (!raw || /^\d+$/.test(raw)) return statusValue;
    try {
      const options = await client.getTicketStatusOptions();
      const match = options.find((option) => option.label.trim().toLowerCase() === raw.toLowerCase());
      if (match) return match.id;
    } catch {
      // Keep original status if metadata lookup fails.
    }
    return statusValue;
  }

  async executeCommand(command: WorkflowCommandEnvelope): Promise<WorkflowExecutionResult> {
    const client = await this.clientFactory(command.tenant_id);
    if (!client) {
      throw new Error('Autotask integration is not configured for this tenant');
    }

    const payload = command.payload as any;
    const operation = resolveAutotaskOperation(command.command_type, payload || {});
    if (operation.rejected) {
      throw new Error(`Unsupported Autotask command_type by frozen matrix: ${command.command_type} (${operation.reason})`);
    }

    if (operation.operation.handler === 'create') {
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

    if (operation.operation.handler === 'assign') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
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

    if (operation.operation.handler === 'status') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      await client.updateTicket(ticketId, {
        status: await this.normalizeStatusForWrite(client, payload.status),
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return {
        kind: 'status',
        status: String(payload.status ?? ''),
        ...(snapshot ? { snapshot } : {}),
      };
    }

    if (operation.operation.handler === 'legacy_update') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const patch: Record<string, unknown> = {};
      if (payload.assignee_resource_id !== undefined || payload.assignedResourceID !== undefined) {
        patch.assignedResourceID = payload.assignee_resource_id ?? payload.assignedResourceID;
      }
      if (payload.queue_id !== undefined || payload.queueID !== undefined) patch.queueID = payload.queue_id ?? payload.queueID;
      if (payload.status !== undefined) patch.status = await this.normalizeStatusForWrite(client, payload.status);

      if (Object.keys(patch).length > 0) {
        await client.updateTicket(ticketId, patch);
      }

      const commentBody = String(payload.comment_body || '').trim();
      if (commentBody) {
        const internal = String(payload.comment_visibility || '').toLowerCase() === 'internal';
        await client.createTicketNote(ticketId, {
          noteText: commentBody,
          // 3 = "Task Notes" (ticket note type), publish controls visibility scope.
          noteType: Number.isFinite(Number(payload.note_type_id)) ? Number(payload.note_type_id) : 3,
          // 1 = All Autotask Users, 2 = Internal Project Team.
          publish: internal ? 2 : 1,
        });
      }

      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'comment_note') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const commentBody = String(payload.comment_body ?? payload.note_body ?? payload.noteText ?? '').trim();
      if (!commentBody) {
        throw new Error(`Command ${command.command_id} requires comment_body for ${command.command_type}`);
      }
      const internal = String(payload.comment_visibility || payload.note_visibility || '').toLowerCase() === 'internal';
      await client.createTicketNote(ticketId, {
        noteText: commentBody,
        // 3 = "Task Notes" (ticket note type), publish controls visibility scope.
        noteType: Number.isFinite(Number(payload.note_type_id)) ? Number(payload.note_type_id) : 3,
        // 1 = All Autotask Users, 2 = Internal Project Team.
        publish: internal ? 2 : 1,
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'time_entry') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
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
      return this.enrichTicketSnapshot(client, ticket);
    }
    const ticket = await client.getTicketByTicketNumber(ticketId);
    return this.enrichTicketSnapshot(client, ticket);
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
        return this.enrichTicketSnapshot(client, ticket);
      }
      const ticket = /^\d+$/.test(ticketId)
        ? await client.getTicket(Number(ticketId))
        : await client.getTicketByTicketNumber(ticketId);
      return this.enrichTicketSnapshot(client, ticket);
    } catch {
      return null;
    }
  }

  private async getStatusLabelMap(client: AutotaskClient): Promise<Map<string, string>> {
    const cached = this.statusLabelCache.get(client);
    if (cached) return cached;
    const map = new Map<string, string>();
    try {
      const options = await client.getTicketStatusOptions();
      for (const option of options) {
        map.set(String(option.id), option.label);
      }
    } catch {
      // Keep empty map when metadata fetch is unavailable.
    }
    this.statusLabelCache.set(client, map);
    return map;
  }

  private async enrichTicketSnapshot(client: AutotaskClient, ticket: any): Promise<Record<string, unknown>> {
    const snapshot = this.mapTicketSnapshot(ticket);
    const status = String(ticket?.status ?? '').trim();
    if (!status) return snapshot;
    const labels = await this.getStatusLabelMap(client);
    const label = labels.get(status);
    if (label) snapshot.status_label = label;
    const ticketId = Number(ticket?.id);
    if (Number.isFinite(ticketId)) {
      try {
        const notes = await client.getTicketNotes(ticketId);
        const latest = Array.isArray(notes) && notes.length > 0 ? notes[notes.length - 1] : null;
        const latestText = String((latest as any)?.noteText || '').trim();
        if (latestText) {
          snapshot.latest_note_text = latestText;
          snapshot.latest_note_fingerprint = this.fingerprintText(latestText);
        }
        const createdAt = String((latest as any)?.createDate || '').trim();
        if (createdAt) snapshot.latest_note_created_at = createdAt;
      } catch {
        // Notes enrichment is best-effort only.
      }
    }
    return snapshot;
  }

  private fingerprintText(input: unknown): string {
    const normalized = String(input ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 2_000);
    if (!normalized) return '';
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a32:${(hash >>> 0).toString(16)}`;
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
