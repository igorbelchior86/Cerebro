import { AutotaskClient } from '../../clients/autotask.js';
import type {
  TicketWorkflowGateway,
  WorkflowCommandEnvelope,
  WorkflowExecutionResult,
} from './ticket-workflow-core.js';
import { resolveAutotaskOperation } from '../adapters/autotask-operation-registry.js';
import { normalizeTextForAutotask } from '../adapters/autotask-text-normalizer.js';

export class AutotaskTicketWorkflowGateway implements TicketWorkflowGateway {
  constructor(private readonly clientFactory: (tenantId: string) => Promise<AutotaskClient | null>) { }
  private statusLabelCache = new Map<AutotaskClient, Map<string, string>>();

  private readTicketNumber(ticket: any): string {
    return String(
      ticket?.ticketNumber ??
      ticket?.ticketnumber ??
      ticket?.ticket_number ??
      ''
    ).trim();
  }

  private readRequesterName(ticket: any): string {
    return String(
      ticket?.contactName ??
      ticket?.requesterName ??
      ticket?.requester ??
      ''
    ).trim();
  }

  private parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return parsed > 0 ? Math.trunc(parsed) : null;
  }

  private async resolveAssignedResourceRoleId(
    client: AutotaskClient,
    assignedResourceId: unknown,
    explicitRoleId: unknown
  ): Promise<number | null> {
    const providedRoleId = this.parsePositiveInt(explicitRoleId);
    if (providedRoleId !== null) return providedRoleId;

    const resourceId = this.parsePositiveInt(assignedResourceId);
    if (resourceId === null) return null;

    try {
      const resource = await client.getResource(resourceId);
      return this.parsePositiveInt((resource as any)?.defaultServiceDeskRoleID);
    } catch {
      return null;
    }
  }

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
      const match = options.find((option: any) => option.label.trim().toLowerCase() === raw.toLowerCase());
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
      const assignedResourceId = payload.assignee_resource_id ?? payload.assignedResourceID;
      const assignedResourceRoleId = await this.resolveAssignedResourceRoleId(
        client,
        assignedResourceId,
        payload.assigned_resource_role_id ?? payload.assignedResourceRoleID
      );
      const created = await client.createTicket({
        title: payload.title,
        description: payload.description,
        companyID: payload.company_id ?? payload.companyID,
        contactID: payload.contact_id ?? payload.contactID,
        queueID: payload.queue_id ?? payload.queueID,
        assignedResourceID: assignedResourceId,
        ...(assignedResourceRoleId !== null ? { assignedResourceRoleID: assignedResourceRoleId } : {}),
        secondaryResourceID: payload.secondary_resource_id ?? payload.secondaryResourceID,
        priority: payload.priority,
        issueType: payload.issue_type ?? payload.issueType,
        subIssueType: payload.sub_issue_type ?? payload.subIssueType,
        serviceLevelAgreementID: payload.sla ?? payload.serviceLevelAgreementID,
        status: payload.status,
      });
      return {
        kind: 'created',
        external_ticket_id: String((created as any)?.id ?? ''),
        external_ticket_number: this.readTicketNumber(created),
        snapshot: this.mapTicketSnapshot(created),
      };
    }

    if (operation.operation.handler === 'assign') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const assignedResourceId = payload.assignee_resource_id ?? payload.assignedResourceID;
      const assignedResourceRoleId = await this.resolveAssignedResourceRoleId(
        client,
        assignedResourceId,
        payload.assigned_resource_role_id ?? payload.assignedResourceRoleID
      );
      await client.updateTicket(ticketId, {
        assignedResourceID: assignedResourceId,
        ...(assignedResourceRoleId !== null ? { assignedResourceRoleID: assignedResourceRoleId } : {}),
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
      const assignedResourceId = payload.assignee_resource_id ?? payload.assignedResourceID;
      if (payload.assignee_resource_id !== undefined || payload.assignedResourceID !== undefined) {
        patch.assignedResourceID = assignedResourceId;
        const assignedResourceRoleId = await this.resolveAssignedResourceRoleId(
          client,
          assignedResourceId,
          payload.assigned_resource_role_id ?? payload.assignedResourceRoleID
        );
        if (assignedResourceRoleId !== null) {
          patch.assignedResourceRoleID = assignedResourceRoleId;
        }
      }
      if (payload.queue_id !== undefined || payload.queueID !== undefined) patch.queueID = payload.queue_id ?? payload.queueID;
      if (payload.status !== undefined) patch.status = await this.normalizeStatusForWrite(client, payload.status);

      if (Object.keys(patch).length > 0) {
        await client.updateTicket(ticketId, patch);
      }

      const commentBody = normalizeTextForAutotask(payload.comment_body).plain_text;
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
      const commentBody = normalizeTextForAutotask(payload.comment_body ?? payload.note_body ?? payload.noteText).plain_text;
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

    if (operation.operation.handler === 'update_ticket_note') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const noteId = Number(payload.note_id ?? payload.id);
      const normalizedDescription = payload.description !== undefined
        ? normalizeTextForAutotask(payload.description).plain_text
        : undefined;
      const normalizedNoteText = payload.noteText !== undefined
        ? normalizeTextForAutotask(payload.noteText).plain_text
        : undefined;
      const normalizedBody = payload.body !== undefined
        ? normalizeTextForAutotask(payload.body).plain_text
        : undefined;
      await client.updateTicketNote(ticketId, noteId, {
        ...(normalizedDescription !== undefined ? { description: normalizedDescription } : {}),
        ...(normalizedNoteText !== undefined ? { noteText: normalizedNoteText } : {}),
        ...(normalizedBody !== undefined ? { description: normalizedBody } : {}),
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.publish !== undefined ? { publish: payload.publish } : {}),
        ...(payload.note_type !== undefined ? { noteType: payload.note_type } : {}),
        ...(payload.noteType !== undefined ? { noteType: payload.noteType } : {}),
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'checklist_list') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const items = await client.getTicketChecklistItems(ticketId);
      return { kind: 'updated', snapshot: { checklist_items: items } };
    }

    if (operation.operation.handler === 'checklist_create') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      await client.createTicketChecklistItem(ticketId, {
        title: payload.title ?? payload.name,
        ...(payload.is_completed !== undefined ? { isCompleted: payload.is_completed } : {}),
        ...(payload.isComplete !== undefined ? { isCompleted: payload.isComplete } : {}),
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'checklist_update') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      await client.updateTicketChecklistItem(ticketId, {
        checklistItemID: payload.checklist_item_id ?? payload.checklistItemID,
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.name !== undefined ? { title: payload.name } : {}),
        ...(payload.is_completed !== undefined ? { isCompleted: payload.is_completed } : {}),
        ...(payload.isComplete !== undefined ? { isCompleted: payload.isComplete } : {}),
      });
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'checklist_delete') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const checklistItemId = Number(payload.checklist_item_id ?? payload.checklistItemId ?? payload.checklistItemID);
      await client.deleteTicketChecklistItem(ticketId, checklistItemId);
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'time_entry_create') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      const summaryNotes = normalizeTextForAutotask(payload.summary_notes ?? payload.summaryNotes).plain_text;
      const entry = await client.createTimeEntry({
        ticketID: ticketId,
        resourceID: payload.resource_id ?? payload.resourceID,
        hoursWorked: payload.hours_worked ?? payload.hoursWorked,
        summaryNotes,
      });
      return {
        kind: 'time_entry',
        entry_id: (entry as any)?.id ?? undefined,
      };
    }

    if (operation.operation.handler === 'time_entry_update') {
      const normalizedSummaryNotesSnake = payload.summary_notes !== undefined
        ? normalizeTextForAutotask(payload.summary_notes).plain_text
        : undefined;
      const normalizedSummaryNotesCamel = payload.summaryNotes !== undefined
        ? normalizeTextForAutotask(payload.summaryNotes).plain_text
        : undefined;
      const entry = await client.updateTimeEntry(
        Number(payload.time_entry_id ?? payload.id),
        {
          ...(payload.hours_worked !== undefined ? { hoursWorked: payload.hours_worked } : {}),
          ...(payload.hoursWorked !== undefined ? { hoursWorked: payload.hoursWorked } : {}),
          ...(normalizedSummaryNotesSnake !== undefined ? { summaryNotes: normalizedSummaryNotesSnake } : {}),
          ...(normalizedSummaryNotesCamel !== undefined ? { summaryNotes: normalizedSummaryNotesCamel } : {}),
        }
      );
      return { kind: 'time_entry', entry_id: (entry as any)?.id ?? Number(payload.time_entry_id ?? payload.id) };
    }

    if (operation.operation.handler === 'time_entry_delete') {
      await client.deleteTimeEntry(Number(payload.time_entry_id ?? payload.id));
      return { kind: 'updated' };
    }

    if (operation.operation.handler === 'update_priority') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      await client.updateTicketPriority(ticketId, Number(payload.priority ?? payload.priorityID));
      const snapshot = await this.safeFetchTicketSnapshot(client, ticketId);
      return { kind: 'updated', ...(snapshot ? { snapshot } : {}) };
    }

    if (operation.operation.handler === 'delete_ticket') {
      const ticketId = await this.resolveWriteTicketId(client, this.requireTicketId(payload, command));
      await client.deleteTicket(ticketId);
      return { kind: 'updated' };
    }

    if (operation.operation.handler === 'contacts_query') {
      const rows = await client.searchContacts(
        JSON.stringify(payload.search ?? payload.filter),
        Number(payload.page_size ?? payload.pageSize ?? payload.MaxRecords ?? 25)
      );
      return { kind: 'updated', snapshot: { contacts: rows } };
    }

    if (operation.operation.handler === 'contact_create') {
      const created = await client.createContact({
        companyID: payload.company_id ?? payload.companyID,
        firstName: payload.first_name ?? payload.firstName,
        lastName: payload.last_name ?? payload.lastName,
        ...(payload.email_address !== undefined ? { emailAddress: payload.email_address } : {}),
        ...(payload.emailAddress !== undefined ? { emailAddress: payload.emailAddress } : {}),
      });
      return { kind: 'updated', snapshot: { contact: created } };
    }

    if (operation.operation.handler === 'contact_update') {
      const updated = await client.updateContact(
        Number(payload.contact_id ?? payload.id),
        {
          ...(payload.first_name !== undefined ? { firstName: payload.first_name } : {}),
          ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
          ...(payload.last_name !== undefined ? { lastName: payload.last_name } : {}),
          ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
          ...(payload.email_address !== undefined ? { emailAddress: payload.email_address } : {}),
          ...(payload.emailAddress !== undefined ? { emailAddress: payload.emailAddress } : {}),
        }
      );
      return { kind: 'updated', snapshot: { contact: updated } };
    }

    if (operation.operation.handler === 'companies_query') {
      const rows = await client.searchCompanies(
        JSON.stringify(payload.search ?? payload.filter),
        Number(payload.page_size ?? payload.pageSize ?? payload.MaxRecords ?? 25)
      );
      return { kind: 'updated', snapshot: { companies: rows } };
    }

    if (operation.operation.handler === 'company_create') {
      const created = await client.createCompany({
        companyName: payload.company_name ?? payload.companyName,
        ...(payload.is_active !== undefined ? { isActive: payload.is_active } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.web_address !== undefined ? { webAddress: payload.web_address } : {}),
        ...(payload.webAddress !== undefined ? { webAddress: payload.webAddress } : {}),
      });
      return { kind: 'updated', snapshot: { company: created } };
    }

    if (operation.operation.handler === 'company_update') {
      const updated = await client.updateCompany(
        Number(payload.company_id ?? payload.id),
        {
          ...(payload.company_name !== undefined ? { companyName: payload.company_name } : {}),
          ...(payload.companyName !== undefined ? { companyName: payload.companyName } : {}),
          ...(payload.is_active !== undefined ? { isActive: payload.is_active } : {}),
          ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
          ...(payload.web_address !== undefined ? { webAddress: payload.web_address } : {}),
          ...(payload.webAddress !== undefined ? { webAddress: payload.webAddress } : {}),
        }
      );
      return { kind: 'updated', snapshot: { company: updated } };
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
    const companyId = Number(ticket?.companyID ?? ticket?.companyId);
    if (!String((snapshot as any).company_name || (snapshot as any).company || '').trim() && Number.isFinite(companyId)) {
      try {
        const company = await client.getCompany(companyId);
        const companyName = String((company as any)?.companyName || (company as any)?.name || '').trim();
        if (companyName) {
          (snapshot as any).company_name = companyName;
          (snapshot as any).company = companyName;
        }
      } catch {
        // Company enrichment is best-effort only.
      }
    }
    const contactId = Number(ticket?.contactID ?? ticket?.contactId);
    if (!String((snapshot as any).contact_name || '').trim() && Number.isFinite(contactId)) {
      try {
        const contact = await client.getContact(contactId);
        const firstName = String((contact as any)?.firstName || '').trim();
        const lastName = String((contact as any)?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const contactName = fullName || String((contact as any)?.name || '').trim();
        const email = String((contact as any)?.emailAddress || (contact as any)?.email || '').trim();
        if (contactName) {
          (snapshot as any).contact_name = contactName;
          (snapshot as any).requester = contactName;
        }
        if (email) {
          (snapshot as any).contact_email = email;
        }
      } catch {
        // Contact enrichment is best-effort only.
      }
    }
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
    const ticketNumber = this.readTicketNumber(ticket);
    const requesterName = this.readRequesterName(ticket);
    const companyName = String(ticket?.companyName ?? ticket?.company ?? '').trim();
    const createdAt = String(ticket?.createDate ?? ticket?.created_at ?? '').trim();
    return {
      id: ticket?.id,
      ticket_number: ticketNumber || undefined,
      ...(createdAt ? { created_at: createdAt } : {}),
      title: ticket?.title ?? ticket?.summary,
      description: ticket?.description,
      status: ticket?.status,
      assigned_to: ticket?.assignedResourceID,
      queue_id: ticket?.queueID,
      company_id: ticket?.companyID,
      contact_id: ticket?.contactID,
      ...(companyName ? { company_name: companyName, company: companyName } : {}),
      ...(requesterName ? { contact_name: requesterName, requester: requesterName } : {}),
    };
  }
}
