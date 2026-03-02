export type AutotaskHandlerKind =
  | 'create'
  | 'assign'
  | 'status'
  | 'update_priority'
  | 'delete_ticket'
  | 'comment_note'
  | 'update_ticket_note'
  | 'checklist_list'
  | 'checklist_create'
  | 'checklist_update'
  | 'checklist_delete'
  | 'time_entry_create'
  | 'time_entry_update'
  | 'time_entry_delete'
  | 'contacts_query'
  | 'contact_create'
  | 'contact_update'
  | 'companies_query'
  | 'company_create'
  | 'company_update'
  | 'legacy_update';

export interface ResolvedAutotaskOperation {
  canonical_operation: string;
  handler: AutotaskHandlerKind;
  audit_action: string;
}

export interface RejectedAutotaskOperation {
  rejected: true;
  reason:
    | 'command_type_not_implemented'
    | 'invalid_payload'
    | 'empty_legacy_update_payload'
    | 'missing_destructive_approval_token';
}

export interface AllowedAutotaskOperation {
  rejected: false;
  operation: ResolvedAutotaskOperation;
}

function isPresent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function hasAnyField(payload: Record<string, unknown>, fields: string[]): boolean {
  return fields.some((field) => isPresent(payload[field]));
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isPositive(value: unknown): boolean {
  const parsed = asNumber(value);
  return parsed !== null && parsed > 0;
}

function requireDestructiveToken(payload: Record<string, unknown>): boolean {
  return isPresent(payload.destructive_approval_token);
}

function resolveLegacyUpdate(payload: Record<string, unknown>): AllowedAutotaskOperation | RejectedAutotaskOperation {
  const hasSupportedMutation = hasAnyField(payload, [
    'status',
    'assignee_resource_id',
    'assignedResourceID',
    'queue_id',
    'queueID',
    'comment_body',
    'note_body',
    'noteText',
  ]);
  if (!hasSupportedMutation) {
    return { rejected: true, reason: 'empty_legacy_update_payload' };
  }
  return {
    rejected: false,
    operation: {
      canonical_operation: 'legacy_composite_update',
      handler: 'legacy_update',
      audit_action: 'autotask.command.legacy_update',
    },
  };
}

export function resolveAutotaskOperation(
  commandType: string,
  payload: Record<string, unknown>
): AllowedAutotaskOperation | RejectedAutotaskOperation {
  const command = String(commandType || '').trim().toLowerCase();

  if (command === 'create' || command === 'ticket_create') {
    return {
      rejected: false,
      operation: { canonical_operation: 'tickets.create', handler: 'create', audit_action: 'autotask.command.tickets.create' },
    };
  }

  if (command === 'assign' || command === 'update_assign') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'tickets.update_assign',
        handler: 'assign',
        audit_action: 'autotask.command.tickets.update_assign',
      },
    };
  }

  if (command === 'status' || command === 'status_update' || command === 'update_status') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'tickets.update_status',
        handler: 'status',
        audit_action: 'autotask.command.tickets.update_status',
      },
    };
  }

  if (command === 'update_priority' || command === 'ticket_update_priority') {
    if (!isPositive(payload.priority ?? payload.priorityID)) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'tickets.update_priority',
        handler: 'update_priority',
        audit_action: 'autotask.command.tickets.update_priority',
      },
    };
  }

  if (command === 'delete' || command === 'ticket_delete') {
    if (!requireDestructiveToken(payload)) return { rejected: true, reason: 'missing_destructive_approval_token' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'tickets.delete',
        handler: 'delete_ticket',
        audit_action: 'autotask.command.tickets.delete',
      },
    };
  }

  if (command === 'comment' || command === 'note' || command === 'comment_note' || command === 'create_comment_note') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_notes.create_comment_note',
        handler: 'comment_note',
        audit_action: 'autotask.command.ticket_notes.create_comment_note',
      },
    };
  }

  if (command === 'update_note' || command === 'ticket_note_update') {
    if (!isPositive(payload.note_id ?? payload.id)) return { rejected: true, reason: 'invalid_payload' };
    if (!hasAnyField(payload, ['description', 'noteText', 'body', 'title', 'publish', 'note_type', 'noteType'])) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_notes.update',
        handler: 'update_ticket_note',
        audit_action: 'autotask.command.ticket_notes.update',
      },
    };
  }

  if (command === 'checklist_list_by_ticket' || command === 'ticket_checklist_list') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_checklist_items.list_by_ticket',
        handler: 'checklist_list',
        audit_action: 'autotask.read.checklist_items.list_by_ticket',
      },
    };
  }

  if (command === 'checklist_create' || command === 'ticket_checklist_create') {
    if (!isPresent(payload.title ?? payload.name)) return { rejected: true, reason: 'invalid_payload' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_checklist_items.create',
        handler: 'checklist_create',
        audit_action: 'autotask.command.ticket_checklist_items.create',
      },
    };
  }

  if (command === 'checklist_update' || command === 'ticket_checklist_update') {
    if (!isPositive(payload.checklist_item_id ?? payload.checklistItemID)) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    if (!hasAnyField(payload, ['title', 'name', 'is_completed', 'isComplete'])) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_checklist_items.update',
        handler: 'checklist_update',
        audit_action: 'autotask.command.ticket_checklist_items.update',
      },
    };
  }

  if (command === 'checklist_delete' || command === 'ticket_checklist_delete') {
    if (!isPositive(payload.checklist_item_id ?? payload.checklistItemId ?? payload.checklistItemID)) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    if (!requireDestructiveToken(payload)) return { rejected: true, reason: 'missing_destructive_approval_token' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_checklist_items.delete',
        handler: 'checklist_delete',
        audit_action: 'autotask.command.ticket_checklist_items.delete',
      },
    };
  }

  if (command === 'time_entry') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'time_entries.create',
        handler: 'time_entry_create',
        audit_action: 'autotask.command.time_entries.create',
      },
    };
  }

  if (command === 'time_entry_update') {
    if (!isPositive(payload.time_entry_id ?? payload.id)) return { rejected: true, reason: 'invalid_payload' };
    if (!hasAnyField(payload, ['hours_worked', 'hoursWorked', 'summary_notes', 'summaryNotes'])) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'time_entries.update',
        handler: 'time_entry_update',
        audit_action: 'autotask.command.time_entries.update',
      },
    };
  }

  if (command === 'time_entry_delete') {
    if (!isPositive(payload.time_entry_id ?? payload.id)) return { rejected: true, reason: 'invalid_payload' };
    if (!requireDestructiveToken(payload)) return { rejected: true, reason: 'missing_destructive_approval_token' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'time_entries.delete',
        handler: 'time_entry_delete',
        audit_action: 'autotask.command.time_entries.delete',
      },
    };
  }

  if (command === 'contacts_query_search' || command === 'contact_query_search') {
    if (!isPresent(payload.search ?? payload.filter)) return { rejected: true, reason: 'invalid_payload' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'contacts.query_search',
        handler: 'contacts_query',
        audit_action: 'autotask.read.contacts.query_search',
      },
    };
  }

  if (command === 'contact_create') {
    if (!isPositive(payload.company_id ?? payload.companyID)) return { rejected: true, reason: 'invalid_payload' };
    if (!isPresent(payload.first_name ?? payload.firstName) || !isPresent(payload.last_name ?? payload.lastName)) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'contacts.create',
        handler: 'contact_create',
        audit_action: 'autotask.command.contacts.create',
      },
    };
  }

  if (command === 'contact_update') {
    if (!isPositive(payload.contact_id ?? payload.id)) return { rejected: true, reason: 'invalid_payload' };
    if (!hasAnyField(payload, ['first_name', 'firstName', 'last_name', 'lastName', 'email_address', 'emailAddress'])) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'contacts.update',
        handler: 'contact_update',
        audit_action: 'autotask.command.contacts.update',
      },
    };
  }

  if (command === 'companies_query_search' || command === 'company_query_search') {
    if (!isPresent(payload.search ?? payload.filter)) return { rejected: true, reason: 'invalid_payload' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'companies.query_search',
        handler: 'companies_query',
        audit_action: 'autotask.read.companies.query_search',
      },
    };
  }

  if (command === 'company_create') {
    if (!isPresent(payload.company_name ?? payload.companyName)) return { rejected: true, reason: 'invalid_payload' };
    return {
      rejected: false,
      operation: {
        canonical_operation: 'companies.create',
        handler: 'company_create',
        audit_action: 'autotask.command.companies.create',
      },
    };
  }

  if (command === 'company_update') {
    if (!isPositive(payload.company_id ?? payload.id)) return { rejected: true, reason: 'invalid_payload' };
    if (!hasAnyField(payload, ['company_name', 'companyName', 'is_active', 'isActive', 'web_address', 'webAddress'])) {
      return { rejected: true, reason: 'invalid_payload' };
    }
    return {
      rejected: false,
      operation: {
        canonical_operation: 'companies.update',
        handler: 'company_update',
        audit_action: 'autotask.command.companies.update',
      },
    };
  }

  if (command === 'update') {
    return resolveLegacyUpdate(payload);
  }

  return { rejected: true, reason: 'command_type_not_implemented' };
}
