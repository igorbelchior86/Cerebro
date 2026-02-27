'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { P0AuditRecord } from '@playbook-brain/types';
import { usePollingResource } from '@/hooks/usePollingResource';
import {
  ManagerOpsAIDecision,
  WorkflowInboxTicket,
  WorkflowAuditRecord,
  WorkflowReconciliationIssue,
  listManagerOpsAiDecisions,
  listManagerOpsAudit,
  listWorkflowAudit,
  listWorkflowInbox,
  listWorkflowReconciliationIssues,
  mapHttpErrorToFrontendState,
  reconcileWorkflowTicket,
} from '@/lib/p0-ui-client';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import { Badge, EmptyState, ErrorBanner, InlineButton, MetaText, P0PageShell, Panel } from './P0UiPrimitives';

const ENRICHMENT_SOURCES = [
  { key: 'itglue', label: 'IT Glue' },
  { key: 'ninjaone', label: 'Ninja' },
  { key: 'sentinelone', label: 'SentinelOne' },
  { key: 'check_point', label: 'Check Point' },
] as const;

export default function P0WorkflowTicketPage({ ticketId }: { ticketId: string }) {
  const inbox = usePollingResource(listWorkflowInbox, {
    intervalMs: 10000,
    realtime: { path: '/workflow/realtime' },
  });
  const workflowAudit = usePollingResource(() => listWorkflowAudit(ticketId), { intervalMs: 15000 });
  const reconciliation = usePollingResource(() => listWorkflowReconciliationIssues(ticketId), { intervalMs: 20000 });
  const aiDecisions = usePollingResource(() => listManagerOpsAiDecisions(200), { intervalMs: 15000 });
  const trustAudit = usePollingResource(() => listManagerOpsAudit(300), { intervalMs: 15000 });
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileState, setReconcileState] = useState<'idle' | 'pending' | 'retrying' | 'failed' | 'succeeded'>('idle');
  const [reconcileResult, setReconcileResult] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const ticket = useMemo(() => (inbox.data || []).find((row) => row.ticket_id === ticketId) || null, [inbox.data, ticketId]);

  const aiForTicket = useMemo(
    () => (aiDecisions.data || []).filter((d) => d.ticket_id === ticketId),
    [aiDecisions.data, ticketId]
  );

  const trustAuditForTicket = useMemo(
    () => filterTrustAuditByTicket(trustAudit.data || [], ticketId),
    [trustAudit.data, ticketId]
  );

  const latestAi = aiForTicket[0] || null;
  const enrichmentCards = useMemo(() => buildEnrichmentStatusCards(trustAuditForTicket), [trustAuditForTicket]);
  const readOnlyRejections = useMemo(
    () => trustAuditForTicket.filter((row) => row.result === 'rejected' && row.reason === 'read_only_enforcement'),
    [trustAuditForTicket]
  );
  const partialFailures = useMemo(
    () => trustAuditForTicket.filter((row) => row.action.startsWith('enrichment.read.') && row.result === 'failure'),
    [trustAuditForTicket]
  );

  const triggerReconcile = async () => {
    setReconcileBusy(true);
    setReconcileState('pending');
    setReconcileError(null);
    setReconcileResult(null);
    try {
      const result = await reconcileWorkflowTicket(ticketId);
      setReconcileResult(JSON.stringify(result));
      setReconcileState('succeeded');
      await Promise.all([workflowAudit.refresh(), reconciliation.refresh(), inbox.refresh()]);
    } catch (err) {
      const mapped = mapHttpErrorToFrontendState(err, 'Reconcile failed');
      setReconcileError(`${mapped.summary}: ${mapped.detail}`);
      setReconcileState(mapped.retryable ? 'retrying' : 'failed');
    } finally {
      setReconcileBusy(false);
    }
  };

  return (
    <P0PageShell
      title={`Internal Validation Harness · P0 Ticket Context · ${ticketId}`}
      subtitle="Temporary P0 route-level validation surface. Canonical technician workflow/context UX now lives in the existing tri-pane Cerebro shell."
      actions={(
        <>
          <Link
            href="/workflow/p0"
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition"
            style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.03)' }}
          >
            Back to Inbox
          </Link>
          <InlineButton onClick={() => void inbox.refresh()} disabled={inbox.refreshing}>Refresh Inbox</InlineButton>
          <InlineButton onClick={() => void triggerReconcile()} disabled={reconcileBusy} kind="primary">
            {reconcileBusy ? 'Reconciling…' : 'Reconcile Ticket'}
          </InlineButton>
        </>
      )}
    >
      {(reconcileState !== 'idle' || reconcileError || reconcileResult) ? (
        reconcileError ? (
          <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'rgba(248,113,113,0.30)', background: 'rgba(248,113,113,0.08)', color: '#fecaca' }}>
            <div className="flex items-center justify-between gap-2">
              <span>Reconcile {reconcileState === 'retrying' ? 'retrying' : 'failed'}: {reconcileError}</span>
              {reconcileState === 'retrying' || reconcileState === 'failed' ? (
                <InlineButton onClick={() => void triggerReconcile()} disabled={reconcileBusy}>
                  Retry now
                </InlineButton>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: 'rgba(33,197,142,0.25)', background: 'rgba(33,197,142,0.08)', color: '#bbf7d0' }}>
            Reconcile completed: {reconcileResult}
          </div>
        )
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <Panel title="Workflow Ticket Snapshot" subtitle="Projected inbox state from `/workflow/inbox` (Autotask source-of-truth sync).">
            {inbox.loading && !ticket ? (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading ticket from inbox…</div>
            ) : !ticket ? (
              <EmptyState title="Ticket not found in workflow inbox" detail="The route is valid, but the current `/workflow/inbox` projection does not include this ticket ID." />
            ) : (
              <WorkflowTicketSnapshot ticket={ticket} />
            )}
          </Panel>

          <Panel title="Workflow Audit Trail" subtitle="Per-ticket command/sync/reconciliation events from `/workflow/audit/:ticketId`.">
            {workflowAudit.error ? <ErrorBanner message={`Workflow audit unavailable: ${workflowAudit.error}`} /> : null}
            {workflowAudit.loading && !(workflowAudit.data || []).length ? (
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading workflow audit…</div>
            ) : (workflowAudit.data || []).length === 0 ? (
              <EmptyState title="No workflow audit rows" detail="This ticket may exist only in the inbox projection so far, or audit records were not generated yet." />
            ) : (
              <AuditList rows={workflowAudit.data || []} compact={false} />
            )}
          </Panel>

          <Panel title="Reconciliation Issues" subtitle="Divergence visibility from `/workflow/reconciliation-issues`.">
            {reconciliation.error ? <ErrorBanner message={`Reconciliation issues unavailable: ${reconciliation.error}`} /> : null}
            {(reconciliation.data || []).length === 0 ? (
              <EmptyState title="No reconciliation issues" detail="No divergence was recorded for this ticket in the current workflow runtime state." />
            ) : (
              <ReconciliationIssueList rows={reconciliation.data || []} />
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Technician Context Panel (P0)" subtitle="AI triage/handoff + read-only enrichment visibility. No write controls for read-only integrations.">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="info">Autotask commands allowed (TWO-WAY)</Badge>
              <Badge tone="warn">IT Glue/Ninja/SentinelOne/Check Point = READ-ONLY</Badge>
              <Badge>{latestAi ? `AI decisions: ${aiForTicket.length}` : 'AI decision: none yet'}</Badge>
            </div>

            {partialFailures.length > 0 ? (
              <ErrorBanner
                message="Partial enrichment failures detected (degraded mode)"
                hint="Core ticket handling remains available. Review trust-layer audit rows for retryability / provider-specific errors."
              />
            ) : null}

            {trustAudit.error && isAdminAccessError(trustAudit.error) ? (
              <ErrorBanner message={`Manager trust-layer access required: ${trustAudit.error}`} hint="`/manager-ops/p0/*` routes are admin-only in the current backend baseline." />
            ) : null}

            <div className="space-y-2">
              {enrichmentCards.map((card) => (
                <div key={card.key} className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{card.label}</div>
                    <Badge tone={card.tone}>{card.statusLabel}</Badge>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{card.detail}</div>
                  {card.lastSeen ? <div className="mt-1"><MetaText>Last audit: {new Date(card.lastSeen).toLocaleString()}</MetaText></div> : null}
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>AI Triage + Handoff</h3>
              {!latestAi ? (
                <EmptyState title="No persisted AI decision for this ticket" detail="The trust store currently has no `/manager-ops/p0/ai-decisions` entry for this ticket. UI stays in manual/operator mode." />
              ) : (
                <AiDecisionPanel decision={latestAi} />
              )}
            </div>

            {readOnlyRejections.length > 0 ? (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Read-Only Enforcement Audit (Mutation Rejections)
                </h3>
                <AuditList rows={readOnlyRejections} compact={true} />
              </div>
            ) : null}
          </Panel>

          <Panel title="Trust-Layer Audit (Ticket Filter)" subtitle="Filtered `/manager-ops/p0/audit` rows correlated by ticket ID.">
            {trustAudit.error && !isAdminAccessError(trustAudit.error) ? (
              <ErrorBanner message={`Trust audit unavailable: ${trustAudit.error}`} />
            ) : null}
            {(trustAuditForTicket || []).length === 0 ? (
              <EmptyState title="No trust-layer audit rows for ticket" detail="AI/enrichment actions may not have been executed for this ticket yet, or admin access is unavailable." />
            ) : (
              <AuditList rows={trustAuditForTicket} compact={true} />
            )}
          </Panel>
        </div>
      </div>
    </P0PageShell>
  );
}

function WorkflowTicketSnapshot({ ticket }: { ticket: WorkflowInboxTicket }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{ticket.title || `Ticket ${ticket.ticket_id}`}</div>
        <div className="mt-1" style={{ color: 'var(--text-secondary)' }}>{ticket.description || 'No description projected in workflow inbox yet.'}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge tone="info">ticket_id {ticket.ticket_id}</Badge>
        <Badge>{ticket.source_of_truth}</Badge>
        <Badge>{ticket.status || 'Unknown status'}</Badge>
        {ticket.queue_name ? <Badge>{ticket.queue_name}</Badge> : null}
        {ticket.assigned_to ? <Badge tone="good">assigned_to {ticket.assigned_to}</Badge> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <KeyVal label="Updated" value={ticket.updated_at} />
        <KeyVal label="Last sync" value={ticket.last_sync_at} />
        <KeyVal label="Last event" value={ticket.last_event_id} />
        <KeyVal label="Last command" value={ticket.last_command_id} />
      </div>
      <div>
        <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Comments ({ticket.comments.length})</div>
        {ticket.comments.length === 0 ? (
          <EmptyState title="No comments in projection" detail="Comments appear here when command/sync events append internal/public notes to the workflow inbox state." />
        ) : (
          <div className="space-y-2">
            {ticket.comments.slice(0, 10).map((comment, index) => (
              <div key={`${comment.created_at}-${index}`} className="rounded-lg border p-2" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone={comment.visibility === 'internal' ? 'warn' : 'info'}>{comment.visibility}</Badge>
                  <MetaText>{new Date(comment.created_at).toLocaleString()}</MetaText>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>{comment.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AiDecisionPanel({ decision }: { decision: ManagerOpsAIDecision }) {
  const recommendedActions = decision.suggestion.recommended_actions || [];
  const doNotDo = decision.suggestion.do_not_do || [];
  const handoffNotes = decision.suggestion.handoff_notes || [];
  const policyReasons = decision.policy_gate.reasons || [];
  const summaryMarkdown = [
    `# AI Triage Summary`,
    `- Decision type: ${decision.decision_type}`,
    `- Confidence: ${(decision.confidence * 100).toFixed(0)}%`,
    `- HITL: ${decision.hitl_status}`,
    `- Policy gate: ${decision.policy_gate.outcome}`,
    '',
    '## Suggested next step',
    decision.suggestion.summary,
    '',
    '## Recommended actions',
    ...(recommendedActions.map((action) => `- [${action.risk}] ${action.action}`)),
    '',
    '## Do not do',
    ...((doNotDo.length ? doNotDo : ['none']).map((x) => `- ${x}`)),
    '',
    '## Handoff notes',
    ...((handoffNotes.length ? handoffNotes : ['none']).map((x) => `- ${x}`)),
    '',
    '## Policy reasons',
    ...((policyReasons.length ? policyReasons : ['none']).map((x) => `- ${x}`)),
  ].join('\n');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge tone={decision.hitl_status === 'pending' ? 'warn' : 'good'}>{decision.hitl_status}</Badge>
        <Badge tone="info">{Math.round(decision.confidence * 100)}% confidence</Badge>
        <Badge>{decision.prompt_version}</Badge>
        <Badge>{decision.model_version}</Badge>
      </div>
      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
        <MarkdownRenderer content={summaryMarkdown} />
      </div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
        <div>Rationale: {decision.rationale}</div>
        <div className="mt-1">Signals used: {formatSignals(decision.signals_used)}</div>
      </div>
    </div>
  );
}

function AuditList({ rows, compact }: { rows: Array<WorkflowAuditRecord | P0AuditRecord>; compact: boolean }) {
  return (
    <div className="space-y-2">
      {rows.slice(0, compact ? 8 : 20).map((row) => (
        <div key={row.audit_id} className="rounded-lg border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.result === 'success' ? 'good' : row.result === 'rejected' ? 'warn' : 'bad'}>{row.result}</Badge>
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{row.action}</span>
            {'reason' in row && row.reason ? <Badge tone="warn">{row.reason}</Badge> : null}
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            target={formatAuditTarget(row)}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{new Date(row.timestamp).toLocaleString()}</span>
            {'correlation' in row && row.correlation?.trace_id ? <span>trace={row.correlation.trace_id}</span> : null}
            {'actor' in row && (row.actor as any)?.id ? <span>actor={(row.actor as any).id}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReconciliationIssueList({ rows }: { rows: WorkflowReconciliationIssue[] }) {
  return (
    <div className="space-y-2">
      {rows.slice(0, 10).map((row) => (
        <div key={row.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.severity === 'error' ? 'bad' : row.severity === 'warning' ? 'warn' : 'info'}>{row.severity}</Badge>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.reason}</span>
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(row.detected_at).toLocaleString()} · provenance {row.provenance.source}
          </div>
          <details className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <summary className="cursor-pointer">Local vs remote snapshots</summary>
            <pre className="mt-2 overflow-auto rounded border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(0,0,0,0.25)' }}>
{JSON.stringify({ local: row.local_snapshot, remote: row.remote_snapshot }, null, 2)}
            </pre>
          </details>
        </div>
      ))}
    </div>
  );
}

function KeyVal({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(255,255,255,0.015)' }}>
      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{value || 'n/a'}</div>
    </div>
  );
}

function filterTrustAuditByTicket(rows: P0AuditRecord[], ticketId: string): P0AuditRecord[] {
  return rows.filter((row) => {
    if (row.correlation?.ticket_id === ticketId) return true;
    if (row.target?.id === ticketId) return true;
    const metadataTicket = typeof row.metadata?.ticket_id === 'string' ? row.metadata.ticket_id : undefined;
    return metadataTicket === ticketId;
  });
}

function buildEnrichmentStatusCards(rows: P0AuditRecord[]) {
  const latestBySource = new Map<string, P0AuditRecord>();
  for (const row of rows) {
    const match = row.action.match(/^enrichment\.read\.(.+)$/);
    if (!match) continue;
    const source = String(match[1] || 'unknown');
    const existing = latestBySource.get(source);
    if (!existing || existing.timestamp < row.timestamp) latestBySource.set(source, row);
  }

  return ENRICHMENT_SOURCES.map((source) => {
    const row = latestBySource.get(source.key);
    if (!row) {
      return {
        key: source.key,
        label: source.label,
        statusLabel: 'not loaded',
        tone: 'neutral' as const,
        detail: 'No enrichment audit recorded for this source on this ticket yet.',
        lastSeen: undefined as string | undefined,
      };
    }

    if (row.result === 'success') {
      const count = typeof row.metadata?.evidence_count === 'number' ? row.metadata.evidence_count : undefined;
      return {
        key: source.key,
        label: source.label,
        statusLabel: 'read-only evidence ok',
        tone: 'good' as const,
        detail: count !== undefined ? `Audit indicates read-only enrichment succeeded (evidence_count=${count}).` : 'Read-only enrichment audit succeeded.',
        lastSeen: row.timestamp,
      };
    }

    return {
      key: source.key,
      label: source.label,
      statusLabel: row.result === 'failure' ? 'partial failure' : row.result,
      tone: row.result === 'failure' ? ('warn' as const) : ('bad' as const),
      detail: String(row.metadata?.error || row.reason || 'Read-only enrichment did not complete successfully.'),
      lastSeen: row.timestamp,
    };
  });
}

function isAdminAccessError(message: string) {
  return /insufficient permissions|forbidden|403/i.test(message);
}

function formatSignals(signals: ManagerOpsAIDecision['signals_used']) {
  if (!Array.isArray(signals) || signals.length === 0) return 'none';
  return signals
    .map((s) => (typeof s === 'string' ? s : `${s.source}:${s.ref}`))
    .join(', ');
}

function formatAuditTarget(row: WorkflowAuditRecord | P0AuditRecord) {
  if ('entity_type' in row.target) {
    return `${row.target.entity_type}${row.target.entity_id ? `:${row.target.entity_id}` : ''}`;
  }
  return `${row.target.type}${row.target.id ? `:${row.target.id}` : ''}`;
}
