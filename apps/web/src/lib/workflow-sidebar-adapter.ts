import type { ActiveTicket } from '@/components/ChatSidebar';
import { listWorkflowInbox, type WorkflowInboxTicket } from '@/lib/p0-ui-client';

function mapPipelineStatusToSidebarStatus(row: WorkflowInboxTicket): ActiveTicket['status'] | null {
  const pipeline = row.pipeline_status;
  if (pipeline === 'ready') return 'completed';
  if (pipeline === 'dlq' || pipeline === 'degraded') return 'failed';
  if (pipeline === 'processing') return 'processing';
  if (pipeline === 'retry_scheduled' || pipeline === 'queued') return 'pending';

  const blocks = row.block_consistency ? Object.values(row.block_consistency) : [];
  if (blocks.length === 3 && blocks.every((entry) => entry === 'ready')) return 'completed';
  if (blocks.some((entry) => entry === 'degraded')) return 'failed';
  if (blocks.some((entry) => entry === 'ready' || entry === 'resolving')) return 'processing';
  return null;
}

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
    row.domain_snapshots?.tickets?.company ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.company_name ||
    '',
    ['unknown org', 'unknown organization', 'unknown company', 'organization', 'company']
  );
  const requesterName = normalizeMeaningful(
    row.requester ||
    row.domain_snapshots?.tickets?.contact_name ||
    row.domain_snapshots?.tickets?.requester_name ||
    row.domain_snapshots?.tickets?.requester ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.contact_name ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.requester_name ||
    '',
    ['unknown requester', 'unknown user', 'requester', 'user', 'contact']
  );
  const contactEmail = String(
    row.domain_snapshots?.tickets?.contact_email ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.contact_email ||
    ''
  ).trim() || undefined;
  const statusLabel = String(
    row.domain_snapshots?.tickets?.status_label ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.status_label ||
    ''
  ).trim();
  const rawStatusValue = String(
    row.status ||
    row.domain_snapshots?.tickets?.status ||
    row.domain_snapshots?.['correlates.ticket_metadata']?.status ||
    ''
  ).trim();
  const statusValue = statusLabel || (/^\d+$/.test(rawStatusValue) ? '' : rawStatusValue);
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

  // Canonical label fields surfaced from domain_snapshots.tickets (populated during ingest).
  // Values from domain_snapshots are typed as unknown; cast to string | number to satisfy ActiveTicket.
  const priorityLabel = String(row.domain_snapshots?.tickets?.priority_label || '').trim() || undefined;
  const rawIssueType = row.domain_snapshots?.tickets?.issue_type;
  const issueType: string | number | undefined =
    typeof rawIssueType === 'string' || typeof rawIssueType === 'number' ? rawIssueType : undefined;
  const issueTypeLabel = String(row.domain_snapshots?.tickets?.issue_type_label || '').trim() || undefined;
  const rawSubIssueType = row.domain_snapshots?.tickets?.sub_issue_type;
  const subIssueType: string | number | undefined =
    typeof rawSubIssueType === 'string' || typeof rawSubIssueType === 'number' ? rawSubIssueType : undefined;
  const subIssueTypeLabel = String(row.domain_snapshots?.tickets?.sub_issue_type_label || '').trim() || undefined;
  const rawSla = row.domain_snapshots?.tickets?.sla;
  const sla: string | number | undefined =
    typeof rawSla === 'string' || typeof rawSla === 'number' ? rawSla : undefined;
  const slaLabel = String(row.domain_snapshots?.tickets?.sla_label || '').trim() || undefined;
  const rawCompanyId = row.domain_snapshots?.tickets?.company_id;
  const companyId: number | string | undefined =
    typeof rawCompanyId === 'string' || typeof rawCompanyId === 'number' ? rawCompanyId : undefined;
  const rawContactId = row.domain_snapshots?.tickets?.contact_id;
  const contactId: number | string | undefined =
    typeof rawContactId === 'string' || typeof rawContactId === 'number' ? rawContactId : undefined;
  const coreState = row.block_consistency?.core_state;
  const networkEnvBodyState = row.block_consistency?.network_env_body_state;
  const hypothesisChecklistState = row.block_consistency?.hypothesis_checklist_state;
  const pipelineDrivenStatus = mapPipelineStatusToSidebarStatus(row);

  return {
    id: row.ticket_id,
    ticket_id: displayTicketNumber || row.ticket_id,
    ticket_number: displayTicketNumber || row.ticket_id,
    status: pipelineDrivenStatus ?? mapWorkflowStatusToSidebarStatus(statusValue),
    ...(statusValue ? { ticket_status_value: statusValue } : {}),
    ...((() => {
      return statusLabel ? { ticket_status_label: statusLabel } : {};
    })()),
    ...(priority ? { priority } : {}),
    ...(priorityLabel ? { priority_label: priorityLabel } : {}),
    ...(issueType !== undefined ? { issue_type: issueType } : {}),
    ...(issueTypeLabel ? { issue_type_label: issueTypeLabel } : {}),
    ...(subIssueType !== undefined ? { sub_issue_type: subIssueType } : {}),
    ...(subIssueTypeLabel ? { sub_issue_type_label: subIssueTypeLabel } : {}),
    ...(sla !== undefined ? { sla } : {}),
    ...(slaLabel ? { sla_label: slaLabel } : {}),
    title,
    ...(description ? { description } : {}),
    ...(companyId !== undefined ? { company_id: companyId } : {}),
    ...(contactId !== undefined ? { contact_id: contactId } : {}),
    ...(companyName ? { company: companyName, org: companyName } : {}),
    ...(requesterName ? { requester: requesterName } : {}),
    ...(contactEmail ? { contact_email: contactEmail } : {}),
    meta: statusValue ? `Workflow ${statusValue}` : 'Workflow inbox',
    ...(createdAt ? { created_at: createdAt } : {}),
    ...(queueName ? { queue_name: queueName, queue: queueName } : {}),
    ...(Number.isFinite(queueId) ? { queue_id: queueId } : {}),
    ...(coreState ? { core_state: coreState } : {}),
    ...(networkEnvBodyState ? { network_env_body_state: networkEnvBodyState } : {}),
    ...(hypothesisChecklistState ? { hypothesis_checklist_state: hypothesisChecklistState } : {}),
    ...(row.pipeline_status ? { pipeline_status: row.pipeline_status } : {}),
    ...(assignedRaw
      ? (Number.isFinite(assignedNumeric)
        ? { assigned_resource_id: assignedNumeric }
        : { assigned_resource_name: assignedRaw })
      : {}),
  };
}

export async function loadTriPaneSidebarTickets(options?: { forceFresh?: boolean }): Promise<ActiveTicket[]> {
  const workflowRows = await listWorkflowInbox(Boolean(options?.forceFresh));
  return workflowRows.map(workflowToSidebarTicket);
}
