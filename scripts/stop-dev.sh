#!/usr/bin/env bash
# =============================================================================
# stop-dev.sh — Stop the Shipping ERP local dev stack (Web + API + PostgreSQL).
# Graceful, idempotent. Leaves nothing running on 3000/3101/5432.
# =============================================================================
set -Eeuo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
PID_DIR="$REPO_ROOT/logs"
log() { printf '[stop-dev] %s\n' "$*"; }

stop_pidfile() { # $1=name $2=pidfile $3=grep-extra
  local name="$1" pf="$2"
  if [ -f "$pf" ]; then
    local pid; pid="$(cat "$pf" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "stopped $name (pid $pid)"
      for _ in $(seq 1 15); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$pf"
  fi
}

log "=== Shipping ERP stop ==="

# Web: stop via pidfile, else by port lockfile/pattern on :3000
if [ -f "$PID_DIR/web.pid" ]; then
  stop_pidfile web "$PID_DIR/web.pid"
else
  pkill -f "next dev -p 3000" 2>/dev/null && log "stopped web (pattern)" || true
fi

# API: stop via pidfile, else node main.js
if [ -f "$PID_DIR/api.pid" ]; then
  stop_pidfile api "$PID_DIR/api.pid"
else
  pkill -f "apps/api/dist/src/main.js" 2>/dev/null && log "stopped api (pattern)" || true
fi

# PostgreSQL: stop via manage.sh (durable data; safe, idempotent)
if (exec 3<>"/dev/tcp/127.0.0.1/5432") 2>/dev/null; then
  exec 3>&- 3<&-
  "$REPO_ROOT/infra/standalone-db/manage.sh" stop
  log "stopped PostgreSQL"
else
  log "PostgreSQL not running (skip)"
fi

sleep 2
log "=== Remaining listeners ==="
ss -lntp 2>/dev/null | grep -E ':(3000|3101|5432)\b' || log "ports 3000/3101/5432 clear"