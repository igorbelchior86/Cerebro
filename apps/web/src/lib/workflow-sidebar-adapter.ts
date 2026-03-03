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

  return normalizeIsoTimestamp(row.updated_at || row.last_event_occurred_at || row.last_sync_at);
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
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester_name ||
    ''
  ).trim();
  const assignedRaw = String(row.assigned_to || '').trim();
  const assignedNumeric = Number.parseInt(assignedRaw, 10);
  return {
    id: row.ticket_id,
    ticket_id: displayTicketNumber || row.ticket_id,
    ticket_number: displayTicketNumber || row.ticket_id,
    status: mapWorkflowStatusToSidebarStatus(row.status),
    ...(row.status ? { ticket_status_value: row.status } : {}),
    ...((() => {
      const label = String(row.domain_snapshots?.['correlates.ticket_metadata']?.status_label || '').trim();
      return label ? { ticket_status_label: label } : {};
    })()),
    priority: fallbackPriority(row.status),
    title,
    ...(description ? { description } : {}),
    ...(companyName ? { company: companyName, org: companyName } : {}),
    ...(requesterName ? { requester: requesterName } : {}),
    meta: row.status ? `Workflow ${row.status}` : 'Workflow inbox',
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(row.queue_name ? { queue_name: row.queue_name, queue: row.queue_name } : {}),
    ...(typeof row.queue_id === 'number' ? { queue_id: row.queue_id } : {}),
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
