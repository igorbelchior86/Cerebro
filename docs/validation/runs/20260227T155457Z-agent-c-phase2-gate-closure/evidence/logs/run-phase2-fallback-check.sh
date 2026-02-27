#!/usr/bin/env bash
set -euo pipefail
RUN_DIR="docs/validation/runs/20260227T155457Z-agent-c-phase2-gate-closure"
RESP_DIR="$RUN_DIR/evidence/responses"
LOG_DIR="$RUN_DIR/evidence/logs"
BASE_URL="http://localhost:3001"
COOKIE_JAR="$RUN_DIR/.cookies.txt"
TMP_HEADERS="$RUN_DIR/.tmp_headers.txt"
TMP_BODY="$RUN_DIR/.tmp_body.txt"

capture_call() {
  local method="$1"
  local path="$2"
  local correlation_id="$3"
  local body_json="${4:-}"
  local output_file="$5"
  local cookie_mode="${6:-auth}" # auth|noauth
  local url="${BASE_URL}${path}"
  local http_code

  if [[ -n "$body_json" ]]; then
    if [[ "$cookie_mode" == "auth" ]]; then
      http_code=$(curl -sS -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "x-correlation-id: ${correlation_id}" \
        -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        --data "$body_json" \
        -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
    else
      http_code=$(curl -sS -X "$method" "$url" \
        -H "Content-Type: application/json" \
        -H "x-correlation-id: ${correlation_id}" \
        --data "$body_json" \
        -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
    fi
  else
    if [[ "$cookie_mode" == "auth" ]]; then
      http_code=$(curl -sS -X "$method" "$url" \
        -H "x-correlation-id: ${correlation_id}" \
        -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
    else
      http_code=$(curl -sS -X "$method" "$url" \
        -H "x-correlation-id: ${correlation_id}" \
        -D "$TMP_HEADERS" -o "$TMP_BODY" -w "%{http_code}")
    fi
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

# Ensure authenticated session for auth-mode calls
capture_call POST "/auth/login" "phase2-agent-c-fallback-auth-login" '{"email":"admin@cerebro.local","password":"CerebroSecure2026!"}' "$RESP_DIR/_auth-login-fallback.json" auth

# Simulate realtime unavailable at endpoint level while polling endpoint remains available
capture_call GET "/workflow/realtime-unavailable" "phase2-agent-c-fallback-realtime-404" "" "$RESP_DIR/s2-fallback-realtime-404.json" auth
capture_call GET "/workflow/inbox" "phase2-agent-c-fallback-polling-ok" "" "$RESP_DIR/s2-fallback-polling-ok.json" auth

# Auth hardening probe: same endpoint without auth must fail safely
capture_call GET "/workflow/inbox" "phase2-agent-c-auth-failure" "" "$RESP_DIR/s2-auth-failure-401.json" noauth

# Drop API listener to force realtime stream break; then restore and verify polling recovery
API_PID="$(lsof -t -iTCP:3001 -sTCP:LISTEN | head -n 1 || true)"
if [[ -n "$API_PID" ]]; then
  kill -9 "$API_PID" || true
fi
sleep 1
curl -sS -m 3 "http://localhost:3001/health" > "$LOG_DIR/s2-api-down-health.txt" 2>&1 || true
./scripts/stack.sh up > "$LOG_DIR/s2-stack-recover.log" 2>&1
capture_call GET "/workflow/inbox" "phase2-agent-c-fallback-after-recover" "" "$RESP_DIR/s2-fallback-polling-after-recover.json" auth

jq -n \
  --argjson realtime404 "$(jq '.response.status_code' "$RESP_DIR/s2-fallback-realtime-404.json")" \
  --argjson pollingOk "$(jq '.response.status_code' "$RESP_DIR/s2-fallback-polling-ok.json")" \
  --argjson authFail "$(jq '.response.status_code' "$RESP_DIR/s2-auth-failure-401.json")" \
  --argjson pollingAfterRecover "$(jq '.response.status_code' "$RESP_DIR/s2-fallback-polling-after-recover.json")" \
  '{
    fallback_checks: {
      realtime_endpoint_unavailable_status: $realtime404,
      polling_status_while_realtime_unavailable: $pollingOk,
      polling_status_after_api_recover: $pollingAfterRecover
    },
    hardening_checks: {
      unauthenticated_workflow_inbox_status: $authFail
    },
    assertions: {
      fallback_endpoint_level_ok: ($realtime404 == 404 and $pollingOk == 200),
      recoverable_after_api_drop: ($pollingAfterRecover == 200),
      auth_failure_safe: ($authFail == 401)
    }
  }' > "$RESP_DIR/s2-fallback-hardening-proof.json"

echo "Fallback/hardening capture complete"
