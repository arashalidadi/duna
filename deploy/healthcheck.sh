#!/usr/bin/env bash
# Read-only health probe for a deployed Duna ERP instance.
#
# Checks the two processes, their listeners, the API health endpoint, and the
# dashboard through the Next same-origin proxy. Exits non-zero on any failure
# and prints exactly what failed, so it is usable from systemd, the installer
# and the GitHub Actions deploy job alike.
set -uo pipefail

API_PORT="${API_PORT:-3101}"
WEB_PORT="${WEB_PORT:-3000}"
LOCALE="${DUNA_HEALTH_LOCALE:-en}"
TIMEOUT="${DUNA_HEALTH_TIMEOUT:-10}"

failures=0
pass() { printf '  \033[1;32mPASS\033[0m  %s\n' "$*"; }
fail() { printf '  \033[1;31mFAIL\033[0m  %s\n' "$*"; failures=$((failures + 1)); }

# curl prints 000 AND exits non-zero when the connection fails, so a plain
# `|| echo 000` fallback would emit "000000". Fall back only on empty output.
code_of() {
  local code
  code="$(curl -s -o /dev/null -m "$TIMEOUT" -w '%{http_code}' "$1" 2>/dev/null)" || true
  if [ -n "$code" ]; then printf '%s' "$code"; else printf '000'; fi
}

echo "Duna health probe"

# 1. Listeners
for pair in "API:$API_PORT" "web:$WEB_PORT"; do
  name="${pair%%:*}"; port="${pair##*:}"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -q ":$port " && pass "$name listening on :$port" || fail "$name not listening on :$port"
  else
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && pass "$name listening on :$port" || fail "$name not listening on :$port"
  fi
done

# 2. API health endpoint (direct)
api_code="$(code_of "http://127.0.0.1:$API_PORT/api/v1/health")"
[ "$api_code" = "200" ] && pass "GET /api/v1/health -> 200" || fail "GET /api/v1/health -> $api_code"

# 3. Dashboard through the Next same-origin proxy
web_code="$(code_of "http://127.0.0.1:$WEB_PORT/$LOCALE/login")"
[ "$web_code" = "200" ] && pass "GET /$LOCALE/login -> 200" || fail "GET /$LOCALE/login -> $web_code"

# 4. The proxy must reach the API from the browser's origin
proxy_code="$(code_of "http://127.0.0.1:$WEB_PORT/api/v1/health")"
[ "$proxy_code" = "200" ] && pass "proxy /api/v1/health -> 200" || fail "proxy /api/v1/health -> $proxy_code"

# 5. An unauthenticated business route must be rejected, not open
guard_code="$(code_of "http://127.0.0.1:$API_PORT/api/v1/customers")"
if [ "$guard_code" = "401" ] || [ "$guard_code" = "403" ]; then
  pass "GET /api/v1/customers -> $guard_code (authentication enforced)"
else
  fail "GET /api/v1/customers -> $guard_code (expected 401/403)"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "HEALTHY"
  exit 0
fi
echo "UNHEALTHY: $failures check(s) failed"
exit 1
