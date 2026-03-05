// Shared types for the ChatSidebar feature module.

export interface ActiveTicket {
    id: string;
    ticket_id: string;
    ticket_number?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    ticket_status_value?: string | number;
    ticket_status_label?: string;
    priority?: 'P1' | 'P2' | 'P3' | 'P4';
    priority_label?: string;
    issue_type?: string | number;
    issue_type_label?: string;
    sub_issue_type?: string | number;
    sub_issue_type_label?: string;
    sla?: string | number;
    sla_label?: string;
    title?: string;
    description?: string;
    company_id?: number | string;
    contact_id?: number | string;
    company?: string;
    requester?: string;
    contact_email?: string;
    org?: string;
    site?: string;
    age?: string;
    meta?: string;
    created_at?: string;
    manual_suppressed?: boolean | null;
    suppressed?: boolean | null;
    suppression_reason?: string | null;
    suppression_reason_label?: string | null;
    suppression_confidence?: number | null;
    queue?: string;
    queue_name?: string;
    queue_id?: number | string;
    assigned_resource_id?: number | string;
    assigned_resource_name?: string;
    assigned_resource_email?: string;
    core_state?: 'resolving' | 'ready' | 'degraded';
    network_env_body_state?: 'resolving' | 'ready' | 'degraded';
    hypothesis_checklist_state?: 'resolving' | 'ready' | 'degraded';
    pipeline_status?: 'queued' | 'processing' | 'retry_scheduled' | 'degraded' | 'dlq' | 'ready';
    isDraft?: boolean;
}

export interface ChatSidebarProps {
    tickets: ActiveTicket[];
    currentTicketId?: string;
    onSelectTicket?: (ticketId: string) => void;
    onCreateTicket?: (context?: { returnTicketId?: string }) => void;
    isLoading?: boolean;
    draftTicket?: ActiveTicket;
    onDraftStatusChange?: (status: { id: number; name: string }) => void;
}

export interface AutotaskQueueCatalogItem {
    id: number;
    label: string;
    isActive?: boolean;
}

export interface QueueOption {
    id: string;
    label: string;
    queueId?: number;
}
