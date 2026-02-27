#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
TS="${TS:-$(date -u +%Y%m%dT%H%M%SZ)}"
CAPTURED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUN_DIR="${RUN_DIR:-docs/validation/runs/${TS}-agent-d-phase1-gate}"
SESSION_ID="phase1-agent-d-gate-${TS}"
JOB_ID="phase1-agent-d-job-${TS}"
TICKET_ID="${TICKET_ID:-T20260226.0033}"

STATUS_IDEMPOTENCY_KEY="phase1-agent-d-status-idem-${TS}"
COMMENT_IDEMPOTENCY_KEY="phase1-agent-d-comment-idem-${TS}"
STATUS_VALUE="In Progress"
COMMENT_BODY="Phase1 Agent D gate comment proof ${TS}"

mkdir -p "$RUN_DIR"
COOKIE_JAR="${RUN_DIR}/.cookies.txt"
TMP_HEADERS="${RUN_DIR}/.tmp_headers.txt"
TMP_BODY="${RUN_DIR}/.tmp_body.txt"

rm -f "$COOKIE_JAR" "$TMP_HEADERS" "$TMP_BODY"

capture_call() {
  local method="$1"
  local path="$2"
  local correlation_id="$3"
  local body_json="$4"
  local output_file="$5"

  local url="${BASE_URL}${path}"
  local http_code=""

  if [[ -n "$body_json" ]]; then
    http_code=$(curl -sS -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "x-correlation-id: ${correlation_id}" \
      -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      --data "$body_json" \
      -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
  else
    http_code=$(curl -sS -X "$method" "$url" \
      -H "x-correlation-id: ${correlation_id}" \
      -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
      -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
  fi

  local x_request_id
  local x_trace_id
  local x_correlation_id
  local content_type
  x_request_id="$(awk 'BEGIN{IGNORECASE=1}/^x-request-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  x_trace_id="$(awk 'BEGIN{IGNORECASE=1}/^x-trace-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  x_correlation_id="$(awk 'BEGIN{IGNORECASE=1}/^x-correlation-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  content_type="$(awk 'BEGIN{IGNORECASE=1}/^content-type:/{ $1=""; sub(/^ /, ""); print }' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"

  jq -n \
    --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg method "$method" \
    --arg path "$path" \
    --arg correlation_id "$correlation_id" \
    --arg job_id "$JOB_ID" \
    --arg body_raw "$body_json" \
    --argjson status_code "$http_code" \
    --arg x_request_id "$x_request_id" \
    --arg x_trace_id "$x_trace_id" \
    --arg x_correlation_id "$x_correlation_id" \
    --arg content_type "$content_type" \
    --rawfile response_body "$TMP_BODY" \
    'def parse_or_null(v): if (v|length) == 0 then null else (v|fromjson) end;
     {
       captured_at: $captured_at,
       request: {
         method: $method,
         path: $path,
         correlation_id: $correlation_id,
         job_id: $job_id,
         body: (if ($body_raw|length) == 0 then null else ($body_raw|fromjson) end)
       },
       response: {
         status_code: $status_code,
         headers: {
           x_request_id: $x_request_id,
           x_trace_id: $x_trace_id,
           x_correlation_id: $x_correlation_id,
           content_type: $content_type
         },
         body_json: parse_or_null($response_body),
         body_text: $response_body
       }
     }' > "$output_file"
}

capture_call "GET" "/health" "phase1-agent-d-${TS}-health" "" "${RUN_DIR}/_health.json"

LOGIN_BODY='{"email":"admin@cerebro.local","password":"CerebroSecure2026!"}'
capture_call "POST" "/auth/login" "phase1-agent-d-${TS}-auth-login" "$LOGIN_BODY" "${RUN_DIR}/_auth-login.json"
capture_call "GET" "/auth/me" "phase1-agent-d-${TS}-auth-me" "" "${RUN_DIR}/_auth-me.json"
capture_call "GET" "/manager-ops/p0/launch-policy" "phase1-agent-d-${TS}-launch-policy" "" "${RUN_DIR}/_launch-policy.json"

TENANT_ID="$(jq -r '.response.body_json.user.tenantId // empty' "${RUN_DIR}/_auth-login.json")"
ACTOR_ID="$(jq -r '.response.body_json.user.id // empty' "${RUN_DIR}/_auth-login.json")"

STATUS_SUBMIT_CORR="phase1-agent-d-${TS}-status-submit"
STATUS_BODY=$(jq -n \
  --arg idem "$STATUS_IDEMPOTENCY_KEY" \
  --arg ticket_id "$TICKET_ID" \
  --arg status "$STATUS_VALUE" \
  --arg session "$SESSION_ID" \
  --arg trace "$STATUS_SUBMIT_CORR" \
  --arg job "$JOB_ID" \
  '{
    command_type: "status_update",
    target_integration: "Autotask",
    auto_process: false,
    idempotency_key: $idem,
    payload: {
      ticket_id: $ticket_id,
      status: $status
    },
    audit_metadata: {
      validation_session: $session,
      scenario: "S2",
      gate: "phase1",
      operation_class: "tickets.update_status"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job
    }
  }')

capture_call "POST" "/workflow/commands" "$STATUS_SUBMIT_CORR" "$STATUS_BODY" "${RUN_DIR}/s2-status-command-submit.json"
STATUS_COMMAND_ID="$(jq -r '.response.body_json.data.command.command_id // empty' "${RUN_DIR}/s2-status-command-submit.json")"

capture_call "POST" "/workflow/commands" "phase1-agent-d-${TS}-status-submit-duplicate" "$STATUS_BODY" "${RUN_DIR}/s2-status-command-submit-duplicate.json"
STATUS_DUP_COMMAND_ID="$(jq -r '.response.body_json.data.command.command_id // empty' "${RUN_DIR}/s2-status-command-submit-duplicate.json")"

COMMENT_SUBMIT_CORR="phase1-agent-d-${TS}-comment-submit"
COMMENT_BODY_JSON=$(jq -n \
  --arg idem "$COMMENT_IDEMPOTENCY_KEY" \
  --arg ticket_id "$TICKET_ID" \
  --arg note_body "$COMMENT_BODY" \
  --arg session "$SESSION_ID" \
  --arg trace "$COMMENT_SUBMIT_CORR" \
  --arg job "$JOB_ID" \
  '{
    command_type: "create_comment_note",
    target_integration: "Autotask",
    auto_process: false,
    idempotency_key: $idem,
    payload: {
      ticket_id: $ticket_id,
      note_body: $note_body,
      note_visibility: "internal"
    },
    audit_metadata: {
      validation_session: $session,
      scenario: "S2",
      gate: "phase1",
      operation_class: "ticket_notes.create_comment_note"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job
    }
  }')

capture_call "POST" "/workflow/commands" "$COMMENT_SUBMIT_CORR" "$COMMENT_BODY_JSON" "${RUN_DIR}/s2-comment-command-submit.json"
COMMENT_COMMAND_ID="$(jq -r '.response.body_json.data.command.command_id // empty' "${RUN_DIR}/s2-comment-command-submit.json")"

BLOCKED_BODY=$(jq -n \
  --arg ticket_id "$TICKET_ID" \
  --arg session "$SESSION_ID" \
  --arg trace "phase1-agent-d-${TS}-blocked-submit" \
  --arg job "$JOB_ID" \
  --arg blocked_idem "phase1-agent-d-blocked-idem-${TS}" \
  '{
    command_type: "update",
    target_integration: "Autotask",
    auto_process: false,
    idempotency_key: $blocked_idem,
    payload: {
      ticket_id: $ticket_id,
      priority: 1
    },
    audit_metadata: {
      validation_session: $session,
      scenario: "S2",
      gate: "phase1",
      operation_class: "tickets.update_priority"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job
    }
  }')
capture_call "POST" "/workflow/commands" "phase1-agent-d-${TS}-blocked-submit" "$BLOCKED_BODY" "${RUN_DIR}/s2-priority-blocked-submit.json"

LAUNCH_POLICY_REJECTION_BODY=$(jq -n \
  --arg ticket_id "$TICKET_ID" \
  --arg session "$SESSION_ID" \
  --arg trace "phase1-agent-d-${TS}-readonly-submit" \
  --arg job "$JOB_ID" \
  --arg idem "phase1-agent-d-readonly-idem-${TS}" \
  '{
    command_type: "update",
    target_integration: "ITGlue",
    auto_process: false,
    idempotency_key: $idem,
    payload: {
      ticket_id: $ticket_id,
      status: "In Progress"
    },
    audit_metadata: {
      validation_session: $session,
      scenario: "S2",
      gate: "phase1",
      launch_policy_probe: "readonly_integration_write_rejection"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job
    }
  }')
capture_call "POST" "/workflow/commands" "phase1-agent-d-${TS}-readonly-submit" "$LAUNCH_POLICY_REJECTION_BODY" "${RUN_DIR}/s2-launch-policy-readonly-rejection.json"

capture_call "POST" "/workflow/commands/process" "phase1-agent-d-${TS}-process" '{"limit":20}' "${RUN_DIR}/s2-command-process.json"
capture_call "POST" "/workflow/commands/process" "phase1-agent-d-${TS}-process-replay" '{"limit":20}' "${RUN_DIR}/s2-command-process-replay.json"

capture_call "GET" "/workflow/commands/${STATUS_COMMAND_ID}" "phase1-agent-d-${TS}-status-status" "" "${RUN_DIR}/s2-status-command-status.json"
capture_call "GET" "/workflow/commands/${COMMENT_COMMAND_ID}" "phase1-agent-d-${TS}-comment-status" "" "${RUN_DIR}/s2-comment-command-status.json"

SYNC_CORR="phase1-agent-d-${TS}-sync"
SYNC_EVENT_ID="phase1-agent-d-sync-${TS}"
SYNC_BODY=$(jq -n \
  --arg event_id "$SYNC_EVENT_ID" \
  --arg ticket_id "$TICKET_ID" \
  --arg trace "$SYNC_CORR" \
  --arg job "$JOB_ID" \
  --arg command_id "$STATUS_COMMAND_ID" \
  '{
    event_id: $event_id,
    event_type: "ticket.updated",
    entity_id: $ticket_id,
    payload: {
      ticket_id: $ticket_id,
      status: "In Progress",
      source: "phase1-agent-d-live-proof"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job,
      command_id: $command_id
    },
    provenance: {
      source: "autotask_webhook",
      adapter_version: "phase1-agent-d-validation",
      sync_cursor: $event_id
    }
  }')
capture_call "POST" "/workflow/sync/autotask" "$SYNC_CORR" "$SYNC_BODY" "${RUN_DIR}/s2-sync-evidence.json"

RECONCILE_TRACE="phase1-agent-d-${TS}-reconcile"
capture_call "POST" "/workflow/reconcile/${TICKET_ID}" "$RECONCILE_TRACE" "" "${RUN_DIR}/s2-reconcile-result.json"
capture_call "GET" "/workflow/audit/${TICKET_ID}" "phase1-agent-d-${TS}-audit" "" "${RUN_DIR}/s2-workflow-audit.json"

jq -n \
  --arg session_id "$SESSION_ID" \
  --arg timestamp "$TS" \
  --arg tenant_id "$TENANT_ID" \
  --arg ticket_id "$TICKET_ID" \
  --arg actor_id "$ACTOR_ID" \
  --arg status_command_id "$STATUS_COMMAND_ID" \
  --arg status_duplicate_command_id "$STATUS_DUP_COMMAND_ID" \
  --arg comment_command_id "$COMMENT_COMMAND_ID" \
  --arg status_idempotency_key "$STATUS_IDEMPOTENCY_KEY" \
  --arg comment_idempotency_key "$COMMENT_IDEMPOTENCY_KEY" \
  --arg status_trace "$STATUS_SUBMIT_CORR" \
  --arg comment_trace "$COMMENT_SUBMIT_CORR" \
  --arg sync_trace "$SYNC_CORR" \
  --arg reconcile_trace "$RECONCILE_TRACE" \
  --arg launch_policy_trace "phase1-agent-d-${TS}-readonly-submit" \
  --argjson sync_status "$(jq '.response.status_code' "${RUN_DIR}/s2-sync-evidence.json")" \
  --argjson reconcile_status "$(jq '.response.status_code' "${RUN_DIR}/s2-reconcile-result.json")" \
  --argjson launch_policy_rejection_status "$(jq '.response.status_code' "${RUN_DIR}/s2-launch-policy-readonly-rejection.json")" \
  --argjson blocked_status "$(jq '.response.status_code' "${RUN_DIR}/s2-priority-blocked-submit.json")" \
  --argjson process_replay_completed "$(jq '.response.body_json.data.completed // 0' "${RUN_DIR}/s2-command-process-replay.json")" \
  --argjson status_completed_count "$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and .correlation.command_id==$cmd)] | length' --arg cmd "$STATUS_COMMAND_ID" "${RUN_DIR}/s2-workflow-audit.json")" \
  --argjson comment_completed_count "$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and .correlation.command_id==$cmd)] | length' --arg cmd "$COMMENT_COMMAND_ID" "${RUN_DIR}/s2-workflow-audit.json")" \
  --argjson sync_trace_count "$(jq '[.response.body_json.data[]? | select(.correlation.trace_id==$trace)] | length' --arg trace "$SYNC_CORR" "${RUN_DIR}/s2-workflow-audit.json")" \
  --argjson reconcile_trace_count "$(jq '[.response.body_json.data[]? | select(.correlation.trace_id==$trace)] | length' --arg trace "$RECONCILE_TRACE" "${RUN_DIR}/s2-workflow-audit.json")" \
  '{
    session_id: $session_id,
    timestamp: $timestamp,
    tenant_id: $tenant_id,
    ticket_id: $ticket_id,
    actor_id: $actor_id,
    traces: {
      status_submit: $status_trace,
      comment_submit: $comment_trace,
      sync: $sync_trace,
      reconcile: $reconcile_trace,
      launch_policy_probe: $launch_policy_trace
    },
    operation_classes: {
      tickets_update_status: {
        idempotency_key: $status_idempotency_key,
        command_id: $status_command_id,
        duplicate_command_id: $status_duplicate_command_id,
        command_ids_equal: ($status_command_id == $status_duplicate_command_id),
        audit_completed_events: $status_completed_count
      },
      ticket_notes_create_comment_note: {
        idempotency_key: $comment_idempotency_key,
        command_id: $comment_command_id,
        audit_completed_events: $comment_completed_count
      },
      tickets_update_priority_exclusion: {
        blocked_http_status: $blocked_status,
        blocked_as_expected: ($blocked_status == 403)
      }
    },
    assertions: {
      idempotency_replay_safe_for_status_update: (($status_command_id == $status_duplicate_command_id) and ($status_completed_count == 1) and ($process_replay_completed == 0)),
      multi_operation_write_coverage_present: (($status_completed_count >= 1) and ($comment_completed_count >= 1)),
      explicit_exclusion_enforced: ($blocked_status == 403),
      sync_reconcile_audit_correlation_present: (($sync_status == 200) and ($reconcile_status == 200) and ($sync_trace_count >= 1) and ($reconcile_trace_count >= 1)),
      launch_policy_non_regression: ($launch_policy_rejection_status == 403)
    }
  }' > "${RUN_DIR}/s2-phase1-gate-proof.json"

jq -n \
  --arg generated_at "$CAPTURED_AT" \
  --arg session_id "$SESSION_ID" \
  --arg run_dir "$RUN_DIR" \
  --arg base_url "$BASE_URL" \
  --arg ticket_id "$TICKET_ID" \
  --arg status_command_id "$STATUS_COMMAND_ID" \
  --arg comment_command_id "$COMMENT_COMMAND_ID" \
  --arg status_duplicate_command_id "$STATUS_DUP_COMMAND_ID" \
  '{
    generated_at: $generated_at,
    session_id: $session_id,
    run_dir: $run_dir,
    base_url: $base_url,
    ticket_id: $ticket_id,
    status_command_id: $status_command_id,
    comment_command_id: $comment_command_id,
    status_duplicate_command_id: $status_duplicate_command_id,
    artifacts: [
      "_health.json",
      "_auth-login.json",
      "_auth-me.json",
      "_launch-policy.json",
      "s2-status-command-submit.json",
      "s2-status-command-submit-duplicate.json",
      "s2-comment-command-submit.json",
      "s2-priority-blocked-submit.json",
      "s2-launch-policy-readonly-rejection.json",
      "s2-command-process.json",
      "s2-command-process-replay.json",
      "s2-status-command-status.json",
      "s2-comment-command-status.json",
      "s2-sync-evidence.json",
      "s2-reconcile-result.json",
      "s2-workflow-audit.json",
      "s2-phase1-gate-proof.json"
    ]
  }' > "${RUN_DIR}/manifest.json"

echo "Capture complete: ${RUN_DIR}"
