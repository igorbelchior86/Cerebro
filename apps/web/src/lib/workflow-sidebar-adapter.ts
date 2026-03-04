import type { ActiveTicket } from '@/components/ChatSidebar';
import { listWorkflowInbox, type WorkflowInboxTicket } from '@/lib/p0-ui-client';

function mapWorkflowStatusToSidebarStatus(status?: string): ActiveTicket['status'] {
  const normalized = String(status || '').toLowerCase();
  if (/fail|error|dlq/.test(normalized)) return 'failed';
  if (/complete|resolved|closed|done/.test(normalized)) return 'completed';
  if (/progress|assign|working|triage/.test(normalized)) return 'processing';
  return 'pending';
}

function fallbackPriority(status?: string): NonNullable<ActiveTicket['priority']> {
  const normalized = String(status || '').toLowerCase();
  if (/critical|sev1|p1/.test(normalized)) return 'P1';
  if (/high|sev2|p2/.test(normalized)) return 'P2';
  if (/low|p4/.test(normalized)) return 'P4';
  return 'P3';
}

function ticketNumberToIsoDate(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  const match = /^T(\d{4})(\d{2})(\d{2})\.\d{4}$/i.exec(raw);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return undefined;
  }
  return utc.toISOString();
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

  const fromTicketNumber = ticketNumberToIsoDate(row.ticket_number || row.ticket_id);
  if (fromTicketNumber) return fromTicketNumber;
  return undefined;
}

function workflowToSidebarTicket(row: WorkflowInboxTicket): ActiveTicket {
  const displayTicketNumber = String(row.ticket_number || row.ticket_id || '').trim();
  const title = String(row.title || '').trim() || `Ticket ${displayTicketNumber || row.ticket_id}`;
  const description = String(row.description || '').trim() || undefined;
  const createdAt = resolveCreatedAt(row);
  const companyName = String(
    row.company ||
    row.domain_snapshots?.tickets?.company_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.company_name ||
    ''
  ).trim();
  const requesterName = String(
    row.requester ||
    row.domain_snapshots?.tickets?.requester_name ||
    row.domain_snapshots?.tickets?.contact_name ||
    row.domain_snapshots?.tickets?.requester ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.contact_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester ||
    ''
  ).trim();
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
  return {
    id: row.ticket_id,
    ticket_id: displayTicketNumber || row.ticket_id,
    ticket_number: displayTicketNumber || row.ticket_id,
    status: mapWorkflowStatusToSidebarStatus(statusValue),
    ...(statusValue ? { ticket_status_value: statusValue } : {}),
    ...((() => {
      return statusLabel ? { ticket_status_label: statusLabel } : {};
    })()),
    priority: fallbackPriority(statusValue),
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
