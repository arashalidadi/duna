#!/usr/bin/env bash
# Restart ONLY the repo-managed API and web processes (start-dev.sh PID files).
# Never stops, starts or probes PostgreSQL. Refuses unmanaged listeners rather
# than guessing a systemd/PM2 unit or killing a process by name.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
API_PORT="$(node scripts/dev-api-port.mjs)"
export API_PORT
mkdir -p logs
[ -f apps/api/dist/src/main.js ] || { echo 'Build API first: pnpm --filter @shipping/api build' >&2; exit 1; }
if command -v pnpm >/dev/null; then PM=(pnpm)
elif command -v corepack >/dev/null; then PM=(corepack pnpm)
else echo 'pnpm or corepack is required' >&2; exit 1; fi
listening() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && { exec 3>&- 3<&-; return 0; } || return 1; }

# Run the complete preflight before stopping EITHER app. Any stale or foreign
# PID needs operator review; a DB or unrelated process is never targeted.
preflight() {
  local name="$1" port="$2" pidfile="logs/$1.pid" pid args cwd pgid
  if [ ! -f "$pidfile" ]; then
    if listening "$port"; then
      echo "$name is listening on :$port without a repo PID file; restart it using its existing manager." >&2
      exit 1
    fi
    return 0
  fi
  pid="$(cat "$pidfile")"
  [[ "$pid" =~ ^[1-9][0-9]*$ ]] || { echo "Invalid $pidfile; inspect it before restarting." >&2; exit 1; }
  kill -0 "$pid" 2>/dev/null || { echo "Stale $pidfile; inspect it before restarting." >&2; exit 1; }
  args="$(ps -p "$pid" -o args=)"
  cwd="$(readlink -f "/proc/$pid/cwd" || true)"
  pgid="$(ps -p "$pid" -o pgid= | tr -d ' ')"
  [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/apps/$name" ]] || {
    echo "$pidfile points outside this checkout; refusing to stop it." >&2; exit 1; }
  [[ "$pgid" == "$pid" ]] || { echo "$pidfile does not own its process group; use its manager." >&2; exit 1; }
  if [ "$name" = api ]; then
    [[ "$args" == *"dist/src/main.js"* && "$args" == *"node"* ]] || {
      echo "$pidfile is not a built API process; refusing." >&2; exit 1; }
  else
    [[ "$args" == *"pnpm"* && "$args" == *"@shipping/web"* ]] || {
      echo "$pidfile is not the repo-managed web process; refusing." >&2; exit 1; }
  fi
}
preflight api "$API_PORT"
preflight web 3000
if [ "${1:-}" = --check ]; then
  echo 'App-only restart preflight passed; PostgreSQL untouched.'
  exit 0
fi
[ "$#" -eq 0 ] || { echo 'Usage: scripts/restart-apps-only.sh [--check]' >&2; exit 1; }
stop_app() {
  local name="$1" port="$2" pidfile="logs/$1.pid" pid count
  [ -f "$pidfile" ] || return 0
  pid="$(cat "$pidfile")"
  kill -TERM -- "-$pid"
  for count in $(seq 1 20); do
    if ! listening "$port"; then break; fi
    sleep 1
  done
  if listening "$port"; then
    echo "$name still owns :$port; inspect before restarting." >&2
    exit 1
  fi
  rm "$pidfile"
}
stop_app api "$API_PORT"
stop_app web 3000
# Double-check both ports BEFORE starting either app.
if listening "$API_PORT"; then echo "API port :$API_PORT is already occupied" >&2; exit 1; fi
if listening 3000; then echo 'Web port :3000 is already occupied' >&2; exit 1; fi
setsid nohup node apps/api/dist/src/main.js >> logs/api.log 2>&1 < /dev/null &
echo $! > logs/api.pid
setsid nohup "${PM[@]}" --filter @shipping/web dev >> logs/web.log 2>&1 < /dev/null &
echo $! > logs/web.pid
for _ in $(seq 1 30); do listening "$API_PORT" && break; sleep 1; done
listening "$API_PORT" || { echo 'API did not start; inspect logs/api.log' >&2; exit 1; }
for _ in $(seq 1 60); do listening 3000 && break; sleep 1; done
listening 3000 || { echo 'Web did not start; inspect logs/web.log' >&2; exit 1; }
echo "API (:${API_PORT}) and web (:3000) restarted. PostgreSQL was not touched."
