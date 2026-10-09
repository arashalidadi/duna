#!/usr/bin/env bash
# =============================================================================
# start-dev.sh — Start the Shipping ERP local development stack detached.
#
# Starts, in order (each idempotent / skip-if-already-running):
#   1. PostgreSQL  (standalone, durable data at /home/arash/shipping-erp/pgdata)
#   2. API         (NestJS, apps/api/dist/src/main.js, API_PORT, default 3101)
#   3. Web         (Next.js dev, port 3000)
#
# All processes are launched with setsid + nohup and full FD redirect, so they
# are detached from the caller's session/terminal and keep running after the
# OpenCode session (or any shell) is closed. Logs go to ./logs/.
#
# Usage:
#   ./scripts/start-dev.sh
#   ./scripts/stop-dev.sh
#   ./scripts/status-dev.sh
# =============================================================================
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Match Nest config precedence: process environment, repo .env, then default.
API_PORT="$(node "$REPO_ROOT/scripts/dev-api-port.mjs")"
export API_PORT

LOG_DIR="$REPO_ROOT/logs"
PID_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"

API=apps/api
WEB=apps/web

log() { printf '[start-dev] %s\n' "$*"; }
die() { printf '[start-dev] ERROR: %s\n' "$*" >&2; exit 1; }

is_listening() { # $1=port
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1
}

start_pg() {
  if is_listening 5432; then
    log "PostgreSQL already running on :5432 (skip)"
    return 0
  fi
  log "Starting PostgreSQL (durable data)..."
  # manage.sh uses setsid-independent pg_ctl; wrap in setsid+nohup too so the
  # orchestration shell detaches. It is idempotent (won't re-init existing cluster).
  setsid nohup "$REPO_ROOT/infra/standalone-db/manage.sh" start >> "$LOG_DIR/pg-start.log" 2>&1 < /dev/null &
  for _ in $(seq 1 20); do is_listening 5432 && break; sleep 1; done
  is_listening 5432 || die "PostgreSQL did not come up in time (see logs/pg-start.log)"
  log "PostgreSQL up on 127.0.0.1:5432"
}

start_api() {
  if is_listening "$API_PORT"; then
    log "API already running on :${API_PORT} (skip)"
    return 0
  fi
  [ -f "$API/dist/src/main.js" ] || die "API build missing — run: pnpm --filter @shipping/api build"
  log "Starting API on :${API_PORT} ..."
  # Nest's configFactory loads repo .env without overriding exported variables.
  # Do not source .env as shell code or overwrite the port resolved above.
  setsid nohup node "$API/dist/src/main.js" >> "$LOG_DIR/api.log" 2>&1 < /dev/null &
  echo $! > "$PID_DIR/api.pid"
  for _ in $(seq 1 30); do is_listening "$API_PORT" && break; sleep 1; done
  is_listening "$API_PORT" || { log "API failed to start — see logs/api.log"; tail -40 "$LOG_DIR/api.log"; return 1; }
  log "API up on :${API_PORT} (pid $(cat "$PID_DIR/api.pid"))"
}

start_web() {
  if is_listening 3000; then
    log "Web already running on :3000 (skip)"
    return 0
  fi
  log "Starting Web (Next.js) on :3000 ..."
  # NEXT_PUBLIC_API_URL is baked from apps/web/.env.local (relative /api/v1).
  setsid nohup pnpm --filter @shipping/web dev >> "$LOG_DIR/web.log" 2>&1 < /dev/null &
  echo $! > "$PID_DIR/web.pid"
  for _ in $(seq 1 60); do is_listening 3000 && break; sleep 1; done
  is_listening 3000 || { log "Web failed to start in time — see logs/web.log"; tail -40 "$LOG_DIR/web.log"; return 1; }
  log "Web up on :3000 (pid $(cat "$PID_DIR/web.pid"))"
}

log "=== Shipping ERP start ==="
start_pg
start_api
start_web
log "=== All services started ==="
"$REPO_ROOT/scripts/status-dev.sh"
