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

function workflowToSidebarTicket(row: WorkflowInboxTicket): ActiveTicket {
  const title = String(row.title || '').trim() || `Ticket ${row.ticket_id}`;
  const description = String(row.description || '').trim() || undefined;
  const createdAt = row.updated_at || row.last_event_occurred_at || row.last_sync_at;
  return {
    id: row.ticket_id,
    ticket_id: row.ticket_id,
    ticket_number: row.ticket_id,
    status: mapWorkflowStatusToSidebarStatus(row.status),
    priority: fallbackPriority(row.status),
    title,
    ...(description ? { description } : {}),
    company: 'Unknown org',
    requester: 'Unknown requester',
    org: 'Unknown org',
    site: 'Unknown site',
    meta: row.status ? `Workflow ${row.status}` : 'Workflow inbox',
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(row.queue_name ? { queue_name: row.queue_name, queue: row.queue_name } : {}),
    ...(typeof row.queue_id === 'number' ? { queue_id: row.queue_id } : {}),
    ...(row.assigned_to ? { assigned_resource_name: row.assigned_to, assigned_resource_id: row.assigned_to } : {}),
  };
}

export async function loadTriPaneSidebarTickets(): Promise<ActiveTicket[]> {
  const workflowRows = await listWorkflowInbox();
  return workflowRows.map(workflowToSidebarTicket);
}
