#!/usr/bin/env bash
# =============================================================================
# status-dev.sh — Report status of the Shipping ERP dev stack (Web/API/PostgreSQL).
# =============================================================================
set -Eeuo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

s() { printf '[%s] %s\n' "$1" "$2"; }
is() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1; }

echo "=== Shipping ERP status ==="

if is 3000; then s web "UP   http://127.0.0.1:3000  (port 3000)"; else s web "DOWN (port 3000)"; fi
if is 3101; then s api "UP   http://127.0.0.1:3101/api/v1  (port 3101)"; else s api "DOWN (port 3101)"; fi
if is 5432; then s pg  "UP   postgresql://shipping:***@127.0.0.1:5432/shipping_erp  (port 5432)"; else s pg "DOWN (port 5432)"; fi

echo
if is 5432; then
  source /tmp/opencode/pg/bin/pgenv.sh >/dev/null 2>&1 || true
  PGPASSWORD=shipping_dev_pass psql -h 127.0.0.1 -p 5432 -U shipping -d shipping_erp -tAc \
    "SELECT 'db:ok rows(User)='||count(*) FROM \"User\"" 2>/dev/null \
    || echo "[db] could not query"
fi

echo
echo "Ports:   Web 3000 | API 3101 | PostgreSQL 5432"
echo "Logs:    $REPO_ROOT/logs/{api.log,web.log,pg-start.log}"
echo "Start:   ./scripts/start-dev.sh"
echo "Stop:    ./scripts/stop-dev.sh"