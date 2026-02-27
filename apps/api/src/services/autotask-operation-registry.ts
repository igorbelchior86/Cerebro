export type AutotaskHandlerKind =
  | 'create'
  | 'assign'
  | 'status'
  | 'comment_note'
  | 'time_entry'
  | 'legacy_update';

export interface ResolvedAutotaskOperation {
  canonical_operation:
    | 'tickets.create'
    | 'tickets.update_assign'
    | 'tickets.update_status'
    | 'ticket_notes.create_comment_note'
    | 'time_entries.create'
    | 'legacy_composite_update';
  handler: AutotaskHandlerKind;
  audit_action:
    | 'autotask.command.tickets.create'
    | 'autotask.command.tickets.update_assign'
    | 'autotask.command.tickets.update_status'
    | 'autotask.command.ticket_notes.create_comment_note'
    | 'autotask.command.time_entries.create'
    | 'autotask.command.legacy_update';
}

export interface RejectedAutotaskOperation {
  rejected: true;
  reason:
    | 'command_type_not_implemented'
    | 'operation_excluded_by_permission'
    | 'empty_legacy_update_payload';
}

export interface AllowedAutotaskOperation {
  rejected: false;
  operation: ResolvedAutotaskOperation;
}

const LEGACY_UPDATE_BLOCKED_FIELDS = new Set(['title', 'description', 'priority']);

function hasAnyField(payload: Record<string, unknown>, fields: string[]): boolean {
  return fields.some((field) => payload[field] !== undefined && payload[field] !== null);
}

export function resolveAutotaskOperation(
  commandType: string,
  payload: Record<string, unknown>
): AllowedAutotaskOperation | RejectedAutotaskOperation {
  const command = String(commandType || '').trim().toLowerCase();

  if (command === 'create') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'tickets.create',
        handler: 'create',
        audit_action: 'autotask.command.tickets.create',
      },
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

  if (
    command === 'comment' ||
    command === 'note' ||
    command === 'comment_note' ||
    command === 'create_comment_note'
  ) {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'ticket_notes.create_comment_note',
        handler: 'comment_note',
        audit_action: 'autotask.command.ticket_notes.create_comment_note',
      },
    };
  }

  if (command === 'time_entry') {
    return {
      rejected: false,
      operation: {
        canonical_operation: 'time_entries.create',
        handler: 'time_entry',
        audit_action: 'autotask.command.time_entries.create',
      },
    };
  }

  if (command === 'update') {
    const hasBlockedField = Array.from(LEGACY_UPDATE_BLOCKED_FIELDS).some(
      (field) => payload[field] !== undefined && payload[field] !== null
    );
    if (hasBlockedField) {
      return { rejected: true, reason: 'operation_excluded_by_permission' };
    }

    const hasAllowedMutation = hasAnyField(payload, [
      'status',
      'assignee_resource_id',
      'assignedResourceID',
      'queue_id',
      'queueID',
      'comment_body',
      'note_body',
      'noteText',
    ]);
    if (!hasAllowedMutation) {
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

  return { rejected: true, reason: 'command_type_not_implemented' };
}
