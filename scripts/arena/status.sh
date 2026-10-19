#!/usr/bin/env bash
# Arena sandbox status. Read-only: reports what is listening and whether the
# API/web/database answer. Exit code 0 only when all four probes pass.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

MIRROR_PORT="${PRISMA_MIRROR_PORT:-4555}"
API_PORT="$(sed -n 's/^API_PORT=//p' .env 2>/dev/null | tail -1)"
API_PORT="${API_PORT:-3101}"
WEB_PORT="${ARENA_WEB_PORT:-3000}"

ok=0
probe() {
  local label="$1" url="$2" expect="${3:-200}"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" 2>/dev/null || echo 000)"
  if [[ "$code" == "$expect" ]]; then
    printf '  \033[32mOK\033[0m   %-22s %s (HTTP %s)\n' "$label" "$url" "$code"
  else
    printf '  \033[31mFAIL\033[0m %-22s %s (HTTP %s, expected %s)\n' "$label" "$url" "$code" "$expect"
    ok=1
  fi
}

echo "PostgreSQL:"
node scripts/arena/db.mjs status
echo
echo "HTTP:"
probe "engine mirror" "http://127.0.0.1:$MIRROR_PORT/all_commits" 404
probe "api health" "http://127.0.0.1:$API_PORT/api/v1/health" 200
probe "api swagger" "http://127.0.0.1:$API_PORT/docs" 200
probe "web login" "http://127.0.0.1:$WEB_PORT/en/login" 200
probe "web api proxy" "http://127.0.0.1:$WEB_PORT/api/v1/health" 200

echo
echo "Listeners:"
ss -ltnp 2>/dev/null | grep -E ":($MIRROR_PORT|$API_PORT|$WEB_PORT|5432)\b" || echo "  none of the expected ports are listening"

exit "$ok"
