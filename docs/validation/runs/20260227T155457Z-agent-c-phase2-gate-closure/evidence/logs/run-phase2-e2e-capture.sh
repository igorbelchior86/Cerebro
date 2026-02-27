#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="docs/validation/runs/20260227T155457Z-agent-c-phase2-gate-closure"
RESP_DIR="$RUN_DIR/evidence/responses"
LOG_DIR="$RUN_DIR/evidence/logs"
BASE_URL="http://localhost:3001"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
COOKIE_JAR="$RUN_DIR/.cookies.txt"
TMP_HEADERS="$RUN_DIR/.tmp_headers.txt"
TMP_BODY="$RUN_DIR/.tmp_body.txt"

mkdir -p "$RESP_DIR" "$LOG_DIR"
rm -f "$COOKIE_JAR" "$TMP_HEADERS" "$TMP_BODY"

capture_call() {
  local method="$1"
  local path="$2"
  local correlation_id="$3"
  local body_json="${4:-}"
  local output_file="$5"
  local url="${BASE_URL}${path}"
  local http_code

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

  local x_request_id x_trace_id x_correlation_id content_type
  x_request_id="$(awk 'BEGIN{IGNORECASE=1}/^x-request-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  x_trace_id="$(awk 'BEGIN{IGNORECASE=1}/^x-trace-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  x_correlation_id="$(awk 'BEGIN{IGNORECASE=1}/^x-correlation-id:/{print $2}' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"
  content_type="$(awk 'BEGIN{IGNORECASE=1}/^content-type:/{ $1=""; sub(/^ /, ""); print }' "$TMP_HEADERS" | tr -d '\r' | tail -n 1)"

  jq -n \
    --arg captured_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg method "$method" \
    --arg path "$path" \
    --arg correlation_id "$correlation_id" \
    --arg body_raw "$body_json" \
    --argjson status_code "$http_code" \
    --arg x_request_id "$x_request_id" \
    --arg x_trace_id "$x_trace_id" \
    --arg x_correlation_id "$x_correlation_id" \
    --arg content_type "$content_type" \
    --rawfile response_body "$TMP_BODY" \
    'def parse_or_null(v): if (v|length)==0 then null else (v|fromjson? // null) end;
     {
       captured_at: $captured_at,
       request: {
         method: $method,
         path: $path,
         correlation_id: $correlation_id,
         body: (if ($body_raw|length)==0 then null else ($body_raw|fromjson? // null) end)
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

capture_call GET "/health" "phase2-agent-c-health" "" "$RESP_DIR/_health.json"
capture_call POST "/auth/login" "phase2-agent-c-auth-login" '{"email":"admin@cerebro.local","password":"CerebroSecure2026!"}' "$RESP_DIR/_auth-login.json"
capture_call GET "/auth/me" "phase2-agent-c-auth-me" "" "$RESP_DIR/_auth-me.json"
capture_call GET "/workflow/inbox" "phase2-agent-c-inbox-before" "" "$RESP_DIR/s2-inbox-before.json"

TICKET_ID="$(jq -r '.response.body_json.data[0].ticket_id // empty' "$RESP_DIR/s2-inbox-before.json")"
ASSIGNED_TO="$(jq -r '.response.body_json.data[0].assigned_to // empty' "$RESP_DIR/s2-inbox-before.json")"
if [[ -z "$TICKET_ID" ]]; then
  echo "No ticket available in workflow inbox for Phase 2 E2E." | tee "$LOG_DIR/e2e-error.log"
  exit 12
fi
if [[ -z "$ASSIGNED_TO" ]]; then
  ASSIGNED_TO="42"
fi

ASSIGN_TRACE="phase2-agent-c-${TS}-assign"
ASSIGN_BODY=$(jq -n --arg ticket_id "$TICKET_ID" --arg assignee "$ASSIGNED_TO" --arg idem "phase2-agent-c-assign-idem-${TS}" --arg trace "$ASSIGN_TRACE" '{
  command_type:"update_assign",
  target_integration:"Autotask",
  auto_process:true,
  idempotency_key:$idem,
  payload:{ticket_id:$ticket_id,assignee_resource_id:$assignee},
  correlation:{trace_id:$trace,ticket_id:$ticket_id}
}')

COMMENT_TRACE="phase2-agent-c-${TS}-comment"
COMMENT_BODY=$(jq -n --arg ticket_id "$TICKET_ID" --arg idem "phase2-agent-c-comment-idem-${TS}" --arg trace "$COMMENT_TRACE" --arg body "Phase2 Agent C gate comment ${TS}" '{
  command_type:"create_comment_note",
  target_integration:"Autotask",
  auto_process:true,
  idempotency_key:$idem,
  payload:{ticket_id:$ticket_id,note_body:$body,note_visibility:"internal"},
  correlation:{trace_id:$trace,ticket_id:$ticket_id}
}')

STATUS_TRACE="phase2-agent-c-${TS}-status"
STATUS_BODY=$(jq -n --arg ticket_id "$TICKET_ID" --arg idem "phase2-agent-c-status-idem-${TS}" --arg trace "$STATUS_TRACE" '{
  command_type:"status_update",
  target_integration:"Autotask",
  auto_process:true,
  idempotency_key:$idem,
  payload:{ticket_id:$ticket_id,status:"In Progress"},
  correlation:{trace_id:$trace,ticket_id:$ticket_id}
}')

SYNC_TRACE="phase2-agent-c-${TS}-sync"
SYNC_BODY=$(jq -n --arg ticket_id "$TICKET_ID" --arg trace "$SYNC_TRACE" --arg eid "phase2-agent-c-sync-${TS}" '{
  event_id:$eid,
  event_type:"ticket.updated",
  entity_id:$ticket_id,
  payload:{ticket_id:$ticket_id,status:"In Progress",source:"phase2-agent-c-gate"},
  correlation:{trace_id:$trace,ticket_id:$ticket_id},
  provenance:{source:"autotask_webhook",adapter_version:"phase2-agent-c",sync_cursor:$eid}
}')

SSE_FILE="$LOG_DIR/s2-realtime-stream.log"
: > "$SSE_FILE"
curl -sN -b "$COOKIE_JAR" -c "$COOKIE_JAR" -H "Accept: text/event-stream" "${BASE_URL}/workflow/realtime?ticketId=${TICKET_ID}" > "$SSE_FILE" 2>"$LOG_DIR/s2-realtime-stream.err" &
SSE_PID=$!
sleep 2

capture_call POST "/workflow/commands" "$ASSIGN_TRACE" "$ASSIGN_BODY" "$RESP_DIR/s2-assign-submit.json"
capture_call POST "/workflow/commands" "$COMMENT_TRACE" "$COMMENT_BODY" "$RESP_DIR/s2-comment-submit.json"
capture_call POST "/workflow/commands" "$STATUS_TRACE" "$STATUS_BODY" "$RESP_DIR/s2-status-submit.json"
capture_call POST "/workflow/sync/autotask" "$SYNC_TRACE" "$SYNC_BODY" "$RESP_DIR/s2-sync-evidence.json"
capture_call GET "/workflow/audit/${TICKET_ID}" "phase2-agent-c-${TS}-audit" "" "$RESP_DIR/s2-workflow-audit.json"
capture_call GET "/workflow/inbox" "phase2-agent-c-inbox-after" "" "$RESP_DIR/s2-inbox-after.json"

sleep 2
kill "$SSE_PID" >/dev/null 2>&1 || true
wait "$SSE_PID" >/dev/null 2>&1 || true

assign_http=$(jq '.response.status_code' "$RESP_DIR/s2-assign-submit.json")
comment_http=$(jq '.response.status_code' "$RESP_DIR/s2-comment-submit.json")
status_http=$(jq '.response.status_code' "$RESP_DIR/s2-status-submit.json")
sync_http=$(jq '.response.status_code' "$RESP_DIR/s2-sync-evidence.json")
sse_connection_events=$(rg -c '^event: connection.state' "$SSE_FILE" || true)
sse_ticket_events=$(rg -c '^event: ticket.change' "$SSE_FILE" || true)
sse_heartbeat_events=$(rg -c '^event: heartbeat' "$SSE_FILE" || true)
audit_assign_hits=$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and ((.correlation.trace_id|tostring)|contains("assign")))] | length' "$RESP_DIR/s2-workflow-audit.json")
audit_comment_hits=$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and ((.correlation.trace_id|tostring)|contains("comment")))] | length' "$RESP_DIR/s2-workflow-audit.json")
audit_status_hits=$(jq '[.response.body_json.data[]? | select(.action=="workflow.command.completed" and ((.correlation.trace_id|tostring)|contains("status")))] | length' "$RESP_DIR/s2-workflow-audit.json")
audit_sync_hits=$(jq '[.response.body_json.data[]? | select(.action=="workflow.sync.applied" and ((.correlation.trace_id|tostring)|contains("sync")))] | length' "$RESP_DIR/s2-workflow-audit.json")

jq -n \
  --arg ticket_id "$TICKET_ID" \
  --arg assign_command_id "$(jq -r '.response.body_json.data.command.command_id // empty' "$RESP_DIR/s2-assign-submit.json")" \
  --arg comment_command_id "$(jq -r '.response.body_json.data.command.command_id // empty' "$RESP_DIR/s2-comment-submit.json")" \
  --arg status_command_id "$(jq -r '.response.body_json.data.command.command_id // empty' "$RESP_DIR/s2-status-submit.json")" \
  --argjson assign_http "$assign_http" \
  --argjson comment_http "$comment_http" \
  --argjson status_http "$status_http" \
  --argjson sync_http "$sync_http" \
  --argjson sse_connection_events "$sse_connection_events" \
  --argjson sse_ticket_events "$sse_ticket_events" \
  --argjson sse_heartbeat_events "$sse_heartbeat_events" \
  --argjson audit_assign_hits "$audit_assign_hits" \
  --argjson audit_comment_hits "$audit_comment_hits" \
  --argjson audit_status_hits "$audit_status_hits" \
  --argjson audit_sync_hits "$audit_sync_hits" \
  '{
    ticket_id:$ticket_id,
    commands:{assign:$assign_command_id,comment:$comment_command_id,status:$status_command_id},
    http:{assign:$assign_http,comment:$comment_http,status:$status_http,sync:$sync_http},
    realtime_stream:{connection_events:$sse_connection_events,ticket_change_events:$sse_ticket_events,heartbeat_events:$sse_heartbeat_events},
    audit_correlation:{assign_completed:$audit_assign_hits,comment_completed:$audit_comment_hits,status_completed:$audit_status_hits,sync_applied:$audit_sync_hits},
    assertions:{
      command_http_ok: ($assign_http==202 and $comment_http==202 and $status_http==202),
      sync_http_ok: ($sync_http==200),
      realtime_received_changes: ($sse_connection_events>=1 and $sse_ticket_events>=3),
      audit_flow_present: ($audit_assign_hits>=1 and $audit_comment_hits>=1 and $audit_status_hits>=1 and $audit_sync_hits>=1)
    }
  }' > "$RESP_DIR/s2-phase2-e2e-proof.json"

echo "$TICKET_ID" > "$RUN_DIR/evidence/ticket_id.txt"
echo "E2E capture complete for ticket: $TICKET_ID"
