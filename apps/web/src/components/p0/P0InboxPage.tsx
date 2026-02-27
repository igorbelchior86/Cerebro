'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePollingResource } from '@/hooks/usePollingResource';
import {
  WorkflowInboxTicket,
  listWorkflowInbox,
  mapHttpErrorToFrontendState,
  processWorkflowCommands,
  relativeMinutesFromNow,
} from '@/lib/p0-ui-client';
import { Badge, EmptyState, ErrorBanner, InlineButton, MetaText, P0PageShell, Panel } from './P0UiPrimitives';

function ticketTitle(ticket: WorkflowInboxTicket) {
  return (ticket.title || '').trim() || `Ticket ${ticket.ticket_id}`;
}

function ticketSubtitle(ticket: WorkflowInboxTicket) {
  const parts = [ticket.queue_name || 'Unassigned', ticket.status || 'Unknown status'];
  if (ticket.assigned_to) parts.push(`Assignee ${ticket.assigned_to}`);
  return parts.join(' • ');
}

export default function P0InboxPage() {
  const inbox = usePollingResource(listWorkflowInbox, {
    intervalMs: 10000,
    realtime: { path: '/workflow/realtime' },
  });
  const [commandStatus, setCommandStatus] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandState, setCommandState] = useState<'idle' | 'pending' | 'retrying' | 'failed' | 'succeeded'>('idle');
  const [processingCommands, setProcessingCommands] = useState(false);

  const tickets = useMemo(() => inbox.data || [], [inbox.data]);
  const counts = useMemo(() => {
    return tickets.reduce(
      (acc, ticket) => {
        const status = (ticket.status || 'unknown').toLowerCase();
        if (status.includes('complete')) acc.completed += 1;
        else if (status.includes('progress') || status.includes('assign')) acc.active += 1;
        else acc.pending += 1;
        return acc;
      },
      { total: tickets.length, active: 0, pending: 0, completed: 0 }
    );
  }, [tickets]);

  const runCommandWorker = async () => {
    setProcessingCommands(true);
    setCommandState('pending');
    setCommandError(null);
    setCommandStatus(null);
    try {
      const result = await processWorkflowCommands(20);
      setCommandStatus(`Worker processed pending commands (${JSON.stringify(result)})`);
      setCommandState('succeeded');
      await inbox.refresh();
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Failed to process commands');
      setCommandError(`${mapped.summary}: ${mapped.detail}`);
      setCommandState(mapped.retryable ? 'retrying' : 'failed');
    } finally {
      setProcessingCommands(false);
    }
  };

  const isAuthIssue = inbox.error?.includes('Authentication') || inbox.error?.includes('Session') || inbox.error?.includes('Tenant');

  return (
    <P0PageShell
      title="Internal Validation Harness · P0 Workflow Inbox"
      subtitle="Temporary validation surface. Canonical UX is the tri-pane Cerebro shell; this page remains for internal P0 route checks."
      actions={(
        <>
          <InlineButton onClick={() => void inbox.refresh()} disabled={inbox.loading || inbox.refreshing}>
            {inbox.refreshing ? 'Refreshing…' : 'Refresh'}
          </InlineButton>
          <InlineButton kind="primary" onClick={() => void runCommandWorker()} disabled={processingCommands}>
            {processingCommands ? 'Processing…' : 'Process Autotask Commands'}
          </InlineButton>
        </>
      )}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Launch Policy" subtitle="P0 integration write posture (must remain explicit in UI).">
          <div className="flex flex-wrap gap-2">
            <Badge tone="info">Autotask = TWO-WAY</Badge>
            <Badge tone="warn">IT Glue = READ-ONLY</Badge>
            <Badge tone="warn">Ninja = READ-ONLY</Badge>
            <Badge tone="warn">SentinelOne = READ-ONLY</Badge>
            <Badge tone="warn">Check Point = READ-ONLY</Badge>
          </div>
        </Panel>
        <Panel title="Queue Snapshot" subtitle="Live inbox projection (P0 polling).">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric label="Total" value={String(counts.total)} />
            <Metric label="Active" value={String(counts.active)} />
            <Metric label="Pending" value={String(counts.pending)} />
            <Metric label="Completed" value={String(counts.completed)} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={inbox.realtime.connected ? 'good' : inbox.realtime.degraded ? 'warn' : 'neutral'}>
              Realtime {inbox.realtime.connected ? 'connected' : inbox.realtime.degraded ? 'degraded' : 'connecting'}
            </Badge>
            {inbox.realtime.degraded ? <Badge tone="warn">Polling fallback active</Badge> : null}
          </div>
          <div className="mt-3"><MetaText>{inbox.lastUpdatedAt ? `Updated ${new Date(inbox.lastUpdatedAt).toLocaleTimeString()}` : 'Waiting for first fetch…'}</MetaText></div>
          {inbox.realtime.reason ? <MetaText>{inbox.realtime.reason}</MetaText> : null}
        </Panel>
        <Panel title="Operations Notes" subtitle="P0 UI wiring constraints and degraded behavior.">
          <ul className="space-y-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <li>Core inbox remains available even if manager-ops trust-layer endpoints fail.</li>
            <li>Read-only integrations expose evidence/visibility only (no write controls).</li>
            <li>Manager Ops and trust-layer endpoints may be admin-only (403 handled in detail pages).</li>
          </ul>
        </Panel>
      </div>

      {inbox.error ? (
        <ErrorBanner
          message={`Inbox load failed: ${inbox.error}`}
          hint={isAuthIssue ? 'Login/admin session may be required for protected API routes.' : 'Backend may be unavailable; retry preserves no local state.'}
        />
      ) : null}

      {commandError ? (
        <ErrorBanner
          message={`Command worker ${commandState === 'retrying' ? 'retrying' : 'failed'}: ${commandError}`}
          {...(commandState === 'retrying' ? { hint: 'Manual retry is available and safe for retryable failures.' } : {})}
        />
      ) : null}
      {commandStatus ? (
        <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'rgba(91,127,255,0.22)', background: 'rgba(91,127,255,0.07)', color: '#c8d6ff' }}>
          {commandStatus}
        </div>
      ) : null}

      <Panel title="Inbox Tickets" subtitle="Open a ticket to view workflow audit, reconciliation, AI decision visibility, and read-only enrichment evidence status.">
        {inbox.loading && tickets.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading inbox…</div>
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets in workflow inbox" detail="The P0 workflow runtime returned an empty projection. Polling remains active." />
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const ageMins = relativeMinutesFromNow(ticket.updated_at || ticket.last_event_occurred_at || ticket.last_sync_at);
              return (
                <Link
                  key={`${ticket.tenant_id}:${ticket.ticket_id}`}
                  href={`/workflow/p0/${encodeURIComponent(ticket.ticket_id)}`}
                  className="block rounded-xl border p-3 transition hover:opacity-95"
                  style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {ticketTitle(ticket)}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{ticketSubtitle(ticket)}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone="info">Ticket {ticket.ticket_id}</Badge>
                        <Badge>{ticket.source_of_truth}</Badge>
                        {ticket.comments.length > 0 ? <Badge>{ticket.comments.length} comments</Badge> : null}
                        {ticket.last_command_id ? <Badge tone="good">command linked</Badge> : null}
                        {ticket.last_event_id ? <Badge tone="neutral">sync event</Badge> : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {typeof ageMins === 'number' ? `${ageMins}m ago` : 'age unknown'}
                      </div>
                      <div className="mt-2">
                        <Badge tone={ticket.status?.toLowerCase().includes('fail') ? 'bad' : 'neutral'}>{ticket.status || 'Unknown'}</Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </P0PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
