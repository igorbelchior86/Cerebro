#!/bin/bash

# Playbook Brain - Complete Startup Script
# Initializes database, starts services, and runs the platform

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠  $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

FAST_MODE=true
FORCE_INSTALL=false
SKIP_PORT_KILL=false

for arg in "$@"; do
    case "$arg" in
        --install)
            FORCE_INSTALL=true
            ;;
        --full)
            FAST_MODE=false
            ;;
        --no-port-kill)
            SKIP_PORT_KILL=true
            ;;
        *)
            ;;
    esac
done

# Select compose command once
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD=(docker-compose)
elif docker compose version &> /dev/null; then
    COMPOSE_CMD=(docker compose)
else
    log_error "Neither docker-compose nor docker compose is available"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

log_info "Starting Playbook Brain Platform..."
log_info "Project Root: $PROJECT_ROOT"

# Check prerequisites
log_info "Checking prerequisites..."

if ! command -v pnpm &> /dev/null; then
    log_error "pnpm is not installed"
    exit 1
fi
log_success "pnpm found"

# Check ports
if [ "$SKIP_PORT_KILL" = false ]; then
    log_info "Checking for port conflicts (3000, 3001)..."
    for port in 3000 3001; do
        PID=$(lsof -t -i:$port || true)
        if [ -n "$PID" ]; then
            log_warning "Port $port is in use by PID $PID. Killing it..."
            kill -9 $PID || true
        fi
    done
else
    log_info "Skipping port cleanup (--no-port-kill)"
fi

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
fi
log_success "Docker found"

# Change to project root
cd "$PROJECT_ROOT"

# Step 1: Install dependencies
log_info "Syncing environment variables..."
if [ -f ".env" ]; then
    cp .env apps/api/.env || true
    cp .env apps/web/.env || true
fi

if [ ! -d "node_modules" ] || [ "$FORCE_INSTALL" = true ]; then
    log_info "Installing dependencies..."
    pnpm install
    log_success "Dependencies installed"
else
    log_info "Skipping dependency installation for speed. (Run with --install to force)"
fi

# Step 2: Start Docker services (PostgreSQL + Redis)
log_info "Starting Docker services (PostgreSQL + Redis)..."
"${COMPOSE_CMD[@]}" up -d postgres redis

if [ $? -eq 0 ]; then
    log_success "Docker services started"
else
    log_error "Failed to start Docker services"
    exit 1
fi

# Step 3: Wait for services to be healthy
log_info "Waiting for services to be ready..."
RETRY_COUNT=0
if [ "$FAST_MODE" = true ]; then
    MAX_RETRIES=12
else
    MAX_RETRIES=30
fi

POSTGRES_ID=$("${COMPOSE_CMD[@]}" ps -q postgres)
REDIS_ID=$("${COMPOSE_CMD[@]}" ps -q redis)

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    PG_HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$POSTGRES_ID" 2>/dev/null || echo "unknown")
    REDIS_HEALTH=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$REDIS_ID" 2>/dev/null || echo "unknown")

    if [ "$PG_HEALTH" = "healthy" ] && [ "$REDIS_HEALTH" = "healthy" ]; then
        log_success "All services are healthy"
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
        echo -ne "\rWaiting... ($RETRY_COUNT/$MAX_RETRIES attempts) postgres=$PG_HEALTH redis=$REDIS_HEALTH"
        sleep 1
    fi
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    if [ "$FAST_MODE" = true ]; then
        log_warning "Fast mode timeout reached (${MAX_RETRIES}s). Continuing startup anyway. Use --full for strict wait."
    else
        log_error "Services failed to be ready after ${MAX_RETRIES}s"
        exit 1
    fi
fi

if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo ""
fi

if [ "$FAST_MODE" = true ]; then
    log_info "Fast mode enabled (default). Use --full for strict startup checks."
else
    log_info "Full mode enabled (strict checks)."
fi

# Step 4: Print configuration
echo ""
log_success "Platform ready to start!"
echo ""
log_info "Starting development servers..."
echo ""
log_info "Configuration:"
echo "  - API Server: http://localhost:3001"
echo "  - Web UI: http://localhost:3000"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
log_warning "Press Ctrl+C to stop all services"
echo ""

# Step 5: Start development servers
cd "$PROJECT_ROOT"

# Limit Node.js heap to avoid OOM hangs
export NODE_OPTIONS="--max-old-space-size=2048"

# Exclude heavy directories from Spotlight indexing (prevents mds_stores CPU spike)
if ! mdutil -s "$PROJECT_ROOT" 2>/dev/null | grep -q "disabled"; then
    touch "$PROJECT_ROOT/node_modules/.metadata_never_index" 2>/dev/null || true
    touch "$PROJECT_ROOT/apps/web/.next/.metadata_never_index" 2>/dev/null || true
fi

# We optionally leave Docker services running for faster subsequent boots.
# Use docker compose down manually to stop them.
trap 'log_info "Shutting down dev server (Docker services left running in background)..."' INT TERM EXIT

pnpm dev
