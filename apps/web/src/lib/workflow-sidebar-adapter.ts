import type { ActiveTicket } from '@/components/ChatSidebar';
import { listWorkflowInbox, type WorkflowInboxTicket } from '@/lib/p0-ui-client';

function mapWorkflowStatusToSidebarStatus(status?: string): ActiveTicket['status'] {
  const normalized = String(status || '').toLowerCase();
  if (/fail|error|dlq/.test(normalized)) return 'failed';
  if (/complete|resolved|closed|done/.test(normalized)) return 'completed';
  if (/progress|assign|working|triage/.test(normalized)) return 'processing';
  return 'pending';
}

function normalizePriority(value: unknown): ActiveTicket['priority'] | undefined {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'P1' || normalized === 'P2' || normalized === 'P3' || normalized === 'P4') {
    return normalized;
  }
  return undefined;
}

function normalizeMeaningful(value: unknown, placeholders: string[]): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase();
  if (placeholders.includes(normalized)) return '';
  return raw;
}

function normalizeIsoTimestamp(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString();
}

function resolveCreatedAt(row: WorkflowInboxTicket): string | undefined {
  const direct = normalizeIsoTimestamp(row.created_at);
  if (direct) return direct;

  const fromMetadata = normalizeIsoTimestamp(
    row.domain_snapshots?.tickets?.created_at ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.created_at
  );
  if (fromMetadata) return fromMetadata;

  return undefined;
}

function workflowToSidebarTicket(row: WorkflowInboxTicket): ActiveTicket {
  const displayTicketNumber = String(row.ticket_number || row.ticket_id || '').trim();
  const title = String(row.title || '').trim() || `Ticket ${displayTicketNumber || row.ticket_id}`;
  const description = String(row.description || '').trim() || undefined;
  const createdAt = resolveCreatedAt(row);
  const companyName = normalizeMeaningful(
    row.company ||
    row.domain_snapshots?.tickets?.company_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.company_name ||
    '',
    ['unknown org', 'unknown organization', 'unknown company', 'organization', 'company']
  );
  const requesterName = normalizeMeaningful(
    row.requester ||
    row.domain_snapshots?.tickets?.requester_name ||
    row.domain_snapshots?.tickets?.contact_name ||
    row.domain_snapshots?.tickets?.requester ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.contact_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester ||
    '',
    ['unknown requester', 'unknown user', 'requester', 'user', 'contact']
  );
  const statusLabel = String(
    row.domain_snapshots?.tickets?.status_label ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.status_label ||
    ''
  ).trim();
  const statusValue = String(
    statusLabel ||
    row.status ||
    row.domain_snapshots?.tickets?.status ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.status ||
    ''
  ).trim();
  const assignedRaw = String(
    row.assigned_to ||
    row.domain_snapshots?.tickets?.assigned_to ||
    row.domain_snapshots?.['correlates.resources']?.assigned_to ||
    ''
  ).trim();
  const queueName = String(
    row.queue_name ||
    row.domain_snapshots?.tickets?.queue_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.queue_name ||
    ''
  ).trim();
  const queueIdRaw = row.queue_id ??
    row.domain_snapshots?.tickets?.queue_id ??
    row.domain_snapshots?.['correlates.ticket_metadata']?.queue_id;
  const queueId = Number(queueIdRaw);
  const assignedNumeric = Number.parseInt(assignedRaw, 10);
  const priority = normalizePriority(row.domain_snapshots?.tickets?.priority);
  return {
    id: row.ticket_id,
    ticket_id: displayTicketNumber || row.ticket_id,
    ticket_number: displayTicketNumber || row.ticket_id,
    status: mapWorkflowStatusToSidebarStatus(statusValue),
    ...(statusValue ? { ticket_status_value: statusValue } : {}),
    ...((() => {
      return statusLabel ? { ticket_status_label: statusLabel } : {};
    })()),
    ...(priority ? { priority } : {}),
    title,
    ...(description ? { description } : {}),
    ...(companyName ? { company: companyName, org: companyName } : {}),
    ...(requesterName ? { requester: requesterName } : {}),
    meta: statusValue ? `Workflow ${statusValue}` : 'Workflow inbox',
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(queueName ? { queue_name: queueName, queue: queueName } : {}),
    ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
    ...(assignedRaw
      ? (Number.isFinite(assignedNumeric)
        ? { assigned_resource_id: assignedNumeric }
        : { assigned_resource_name: assignedRaw })
      : {}),
  };
}

export async function loadTriPaneSidebarTickets(): Promise<ActiveTicket[]> {
  const workflowRows = await listWorkflowInbox();
  return workflowRows.map(workflowToSidebarTicket);
}
