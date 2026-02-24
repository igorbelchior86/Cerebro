#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/.run/logs"
API_SESSION="cerebro_api"
WEB_SESSION="cerebro_web"

mkdir -p "$LOG_DIR"

if command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
else
  echo "ERROR: docker-compose/docker compose not found"
  exit 1
fi

usage() {
  cat <<USAGE
Usage: ./scripts/stack.sh [up|down|restart|status|logs]

Commands:
  up       Start full stack in background (default)
  down     Stop web/api background processes
  restart  down + up
  status   Show listeners and health
  logs     Tail web/api logs
USAGE
}

sync_env() {
  cd "$PROJECT_ROOT"
  if [ -f ".env" ]; then
    cp .env apps/api/.env || true
    cp .env apps/web/.env || true
  fi
}

install_if_needed() {
  cd "$PROJECT_ROOT"
  if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
  fi
}

start_db() {
  cd "$PROJECT_ROOT"
  echo "Starting postgres/redis..."
  "${COMPOSE_CMD[@]}" up -d postgres redis >/dev/null
}

stop_sessions() {
  screen -S "$API_SESSION" -X quit >/dev/null 2>&1 || true
  screen -S "$WEB_SESSION" -X quit >/dev/null 2>&1 || true
}

kill_ports() {
  for port in 3000 3001; do
    pid="$(lsof -t -iTCP:$port -sTCP:LISTEN || true)"
    if [ -n "$pid" ]; then
      kill -9 $pid || true
    fi
  done
}

curl_health() {
  local url="$1"
  curl -sf --connect-timeout 1 --max-time 2 "$url" >/dev/null 2>&1
}

wait_ready() {
  echo "Waiting services..."
  for i in {1..60}; do
    ok_api=0
    ok_web=0
    curl_health http://localhost:3001/health && ok_api=1
    curl_health http://localhost:3000 && ok_web=1
    if [ "$ok_api" -eq 1 ] && [ "$ok_web" -eq 1 ]; then
      echo "READY: web=http://localhost:3000 api=http://localhost:3001"
      return 0
    fi
    sleep 1
  done
  echo "WARNING: timeout waiting services"
  return 1
}

cmd_up() {
  sync_env
  install_if_needed
  start_db
  stop_sessions
  kill_ports

  : > "$LOG_DIR/api.log"
  : > "$LOG_DIR/web.log"

  echo "Starting API (detached)..."
  screen -dmS "$API_SESSION" bash -lc "cd '$PROJECT_ROOT/apps/api' && npx --yes nodemon -w src -e ts,tsx --exec 'tsx src/index.ts' >> '$LOG_DIR/api.log' 2>&1"

  echo "Starting WEB (detached)..."
  screen -dmS "$WEB_SESSION" bash -lc "cd '$PROJECT_ROOT/apps/web' && npx next dev -p 3000 >> '$LOG_DIR/web.log' 2>&1"

  wait_ready || true
  cmd_status
  echo "Logs: ./scripts/stack.sh logs"
}

cmd_down() {
  stop_sessions
  kill_ports
  echo "Stack stopped."
}

cmd_status() {
  api_pid="$(lsof -t -iTCP:3001 -sTCP:LISTEN || true)"
  web_pid="$(lsof -t -iTCP:3000 -sTCP:LISTEN || true)"

  if [ -n "$api_pid" ]; then
    echo "api listener: running (pid $api_pid)"
  else
    echo "api listener: stopped"
  fi

  if [ -n "$web_pid" ]; then
    echo "web listener: running (pid $web_pid)"
  else
    echo "web listener: stopped"
  fi

  if curl_health http://localhost:3001/health; then
    echo "api health: ok"
  else
    echo "api health: down"
  fi

  if curl_health http://localhost:3000; then
    echo "web health: ok"
  else
    echo "web health: down"
  fi
}

cmd_logs() {
  tail -f "$LOG_DIR/web.log" "$LOG_DIR/api.log"
}

cmd_restart() {
  cmd_down
  cmd_up
}

ACTION="${1:-up}"
case "$ACTION" in
  up) cmd_up ;;
  down) cmd_down ;;
  restart) cmd_restart ;;
  status) cmd_status ;;
  logs) cmd_logs ;;
  -h|--help|help) usage ;;
  *)
    echo "Unknown command: $ACTION"
    usage
    exit 1
    ;;
esac
