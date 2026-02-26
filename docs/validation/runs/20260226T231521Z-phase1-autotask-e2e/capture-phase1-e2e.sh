#!/usr/bin/env bash
set -euo pipefail

RUN_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3001}"
TS="${TS:-$(date -u +%Y%m%dT%H%M%SZ)}"
CAPTURED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SESSION_ID="phase1-autotask-e2e-${TS}"
JOB_ID="phase1-autotask-job-${TS}"
TICKET_ID="${TICKET_ID:-T20260226.0033}"
IDEMPOTENCY_KEY="phase1-autotask-idem-${TS}"
COMMENT_BODY="Phase1 gate proof ${TS}"

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

# 0) Health sanity
capture_call "GET" "/health" "phase1-${TS}-health" "" "${RUN_DIR}/_health.json"

# 1) Auth
LOGIN_BODY='{"email":"admin@cerebro.local","password":"CerebroSecure2026!"}'
capture_call "POST" "/auth/login" "phase1-${TS}-auth-login" "$LOGIN_BODY" "${RUN_DIR}/_auth-login.json"
capture_call "GET" "/auth/me" "phase1-${TS}-auth-me" "" "${RUN_DIR}/_auth-me.json"
capture_call "GET" "/manager-ops/p0/launch-policy" "phase1-${TS}-launch-policy" "" "${RUN_DIR}/_launch-policy.json"

TENANT_ID="$(jq -r '.response.body_json.user.tenantId // empty' "${RUN_DIR}/_auth-login.json")"
ACTOR_ID="$(jq -r '.response.body_json.user.id // empty' "${RUN_DIR}/_auth-login.json")"

# 2) Submit command (happy path candidate)
SUBMIT_CORR="phase1-${TS}-submit"
SUBMIT_BODY=$(jq -n \
  --arg idem "$IDEMPOTENCY_KEY" \
  --arg ticket_id "$TICKET_ID" \
  --arg comment "$COMMENT_BODY" \
  --arg session "$SESSION_ID" \
  --arg trace "$SUBMIT_CORR" \
  --arg job "$JOB_ID" \
  '{
    command_type: "update",
    target_integration: "Autotask",
    auto_process: false,
    idempotency_key: $idem,
    payload: {
      ticket_id: $ticket_id,
      status: "In Progress",
      comment_body: $comment,
      comment_visibility: "internal"
    },
    audit_metadata: {
      validation_session: $session,
      scenario: "S2",
      gate: "phase1"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job
    }
  }')
capture_call "POST" "/workflow/commands" "$SUBMIT_CORR" "$SUBMIT_BODY" "${RUN_DIR}/s2-command-submit.json"

COMMAND_ID="$(jq -r '.response.body_json.data.command.command_id // empty' "${RUN_DIR}/s2-command-submit.json")"

# 3) Idempotency replay (same payload + same idempotency key)
capture_call "POST" "/workflow/commands" "phase1-${TS}-submit-duplicate" "$SUBMIT_BODY" "${RUN_DIR}/s2-command-submit-duplicate.json"
DUP_COMMAND_ID="$(jq -r '.response.body_json.data.command.command_id // empty' "${RUN_DIR}/s2-command-submit-duplicate.json")"

# 4) Process queue
capture_call "POST" "/workflow/commands/process" "phase1-${TS}-process" '{"limit":10}' "${RUN_DIR}/s2-command-process.json"
# Replay process to prove no second mutation work item was created
capture_call "POST" "/workflow/commands/process" "phase1-${TS}-process-replay" '{"limit":10}' "${RUN_DIR}/s2-command-process-replay.json"

# 5) Command status
capture_call "GET" "/workflow/commands/${COMMAND_ID}" "phase1-${TS}-status" "" "${RUN_DIR}/s2-command-status.json"

# 6) Sync evidence
SYNC_CORR="phase1-${TS}-sync"
SYNC_EVENT_ID="phase1-sync-${TS}"
SYNC_BODY=$(jq -n \
  --arg event_id "$SYNC_EVENT_ID" \
  --arg ticket_id "$TICKET_ID" \
  --arg trace "$SYNC_CORR" \
  --arg job "$JOB_ID" \
  --arg command_id "$COMMAND_ID" \
  '{
    event_id: $event_id,
    event_type: "ticket.updated",
    entity_id: $ticket_id,
    payload: {
      ticket_id: $ticket_id,
      status: "In Progress",
      source: "phase1-live-proof"
    },
    correlation: {
      trace_id: $trace,
      ticket_id: $ticket_id,
      job_id: $job,
      command_id: $command_id
    },
    provenance: {
      source: "autotask_webhook",
      adapter_version: "phase1-validation",
      sync_cursor: $event_id
    }
  }')
capture_call "POST" "/workflow/sync/autotask" "$SYNC_CORR" "$SYNC_BODY" "${RUN_DIR}/s2-sync-evidence.json"

# 7) Reconcile
capture_call "POST" "/workflow/reconcile/${TICKET_ID}" "phase1-${TS}-reconcile" "" "${RUN_DIR}/s2-reconcile-result.json"

# 8) Audit
capture_call "GET" "/workflow/audit/${TICKET_ID}" "phase1-${TS}-audit" "" "${RUN_DIR}/s2-workflow-audit.json"

# 9) Correlation/idempotency proof synthesis
jq -n \
  --arg session_id "$SESSION_ID" \
  --arg timestamp "$TS" \
  --arg tenant_id "$TENANT_ID" \
  --arg ticket_id "$TICKET_ID" \
  --arg actor_id "$ACTOR_ID" \
  --arg command_id "$COMMAND_ID" \
  --arg duplicate_command_id "$DUP_COMMAND_ID" \
  --arg idem_key "$IDEMPOTENCY_KEY" \
  --arg submit_trace "$SUBMIT_CORR" \
  --arg sync_trace "$SYNC_CORR" \
  --arg reconcile_trace "phase1-${TS}-reconcile" \
  --argjson submit_status "$(jq '.response.status_code' "${RUN_DIR}/s2-command-submit.json")" \
  --argjson duplicate_status "$(jq '.response.status_code' "${RUN_DIR}/s2-command-submit-duplicate.json")" \
  --argjson process_status "$(jq '.response.status_code' "${RUN_DIR}/s2-command-process.json")" \
  --argjson status_status "$(jq '.response.status_code' "${RUN_DIR}/s2-command-status.json")" \
  --argjson sync_status "$(jq '.response.status_code' "${RUN_DIR}/s2-sync-evidence.json")" \
  --argjson reconcile_status "$(jq '.response.status_code' "${RUN_DIR}/s2-reconcile-result.json")" \
  --arg command_terminal_status "$(jq -r '.response.body_json.data.command.status // "unknown"' "${RUN_DIR}/s2-command-status.json")" \
  --argjson process_completed "$(jq '.response.body_json.data.completed // 0' "${RUN_DIR}/s2-command-process.json")" \
  --argjson process_replay_completed "$(jq '.response.body_json.data.completed // 0' "${RUN_DIR}/s2-command-process-replay.json")" \
  --argjson reconcile_matched "$(jq '.response.body_json.data.matched // false' "${RUN_DIR}/s2-reconcile-result.json")" \
  --argjson audit_count "$(jq '.response.body_json.count // 0' "${RUN_DIR}/s2-workflow-audit.json")" \
  --argjson accepted_count "$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.accepted" and .correlation.command_id==$cmd)] | length' --arg cmd "$COMMAND_ID" "${RUN_DIR}/s2-workflow-audit.json")" \
  --argjson completed_count "$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and .correlation.command_id==$cmd)] | length' --arg cmd "$COMMAND_ID" "${RUN_DIR}/s2-workflow-audit.json")" \
  '{
    session_id: $session_id,
    timestamp: $timestamp,
    tenant_id: $tenant_id,
    ticket_id: $ticket_id,
    actor_id: $actor_id,
    idempotency_key: $idem_key,
    command_id: $command_id,
    duplicate_command_id: $duplicate_command_id,
    command_ids_equal: ($command_id == $duplicate_command_id),
    traces: {
      submit: $submit_trace,
      sync: $sync_trace,
      reconcile: $reconcile_trace
    },
    http: {
      submit: $submit_status,
      submit_duplicate: $duplicate_status,
      process: $process_status,
      status: $status_status,
      sync: $sync_status,
      reconcile: $reconcile_status
    },
    outcomes: {
      command_terminal_status: $command_terminal_status,
      process_completed: $process_completed,
      process_replay_completed: $process_replay_completed,
      reconcile_matched: $reconcile_matched,
      audit_count: $audit_count,
      audit_command_accepted_events: $accepted_count,
      audit_command_completed_events: $completed_count
    },
    idempotency_assertion: {
      statement: "same command submitted twice resulted in a single external mutation",
      evidence: {
        same_command_id: ($command_id == $duplicate_command_id),
        single_completed_audit_event_for_command_id: ($completed_count == 1),
        replay_process_completed_zero: ($process_replay_completed == 0)
      }
    }
  }' > "${RUN_DIR}/s2-idempotency-replay-proof.json"

jq -n \
  --arg generated_at "$CAPTURED_AT" \
  --arg session_id "$SESSION_ID" \
  --arg run_dir "$RUN_DIR" \
  --arg base_url "$BASE_URL" \
  --arg ticket_id "$TICKET_ID" \
  --arg command_id "$COMMAND_ID" \
  --arg duplicate_command_id "$DUP_COMMAND_ID" \
  --arg engine_baseline "latest engine from Prompt 2 (current workspace HEAD)" \
  --arg api_typecheck_cmd "pnpm --filter @playbook-brain/api typecheck" \
  --arg targeted_tests_cmd "pnpm --filter @playbook-brain/api test -- src/__tests__/services/ticket-workflow-core.test.ts src/__tests__/services/autotask-ticket-workflow-gateway.test.ts src/__tests__/routes/workflow.reconcile-route.test.ts" \
  '{
    generated_at: $generated_at,
    session_id: $session_id,
    run_dir: $run_dir,
    base_url: $base_url,
    ticket_id: $ticket_id,
    command_id: $command_id,
    duplicate_command_id: $duplicate_command_id,
    engine_baseline: $engine_baseline,
    required_checks: {
      api_typecheck_command: $api_typecheck_cmd,
      targeted_engine_tests_command: $targeted_tests_cmd,
      api_typecheck_log: "check-api-typecheck.log",
      targeted_engine_tests_log: "check-targeted-engine-tests.log"
    },
    artifacts: [
      "_health.json",
      "_auth-login.json",
      "_auth-me.json",
      "_launch-policy.json",
      "s2-command-submit.json",
      "s2-command-submit-duplicate.json",
      "s2-command-process.json",
      "s2-command-process-replay.json",
      "s2-command-status.json",
      "s2-sync-evidence.json",
      "s2-reconcile-result.json",
      "s2-workflow-audit.json",
      "s2-idempotency-replay-proof.json"
    ]
  }' > "${RUN_DIR}/manifest.json"

echo "Capture complete at ${RUN_DIR}"
