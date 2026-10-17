#!/usr/bin/env bash
set -Eeuo pipefail
# --check is strictly read-only. api/web/apps never includes PostgreSQL.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ "${1:-}" == "--check" ]]; then
  shift
  [[ "$#" -le 1 ]] || { echo 'Usage: restart-apps-only.sh [--check] [api|web|apps]' >&2; exit 2; }
  exec node "$REPO_ROOT/scripts/phase11-apps.mjs" preflight "${1:-apps}"
fi
[[ "$#" -le 1 ]] || { echo 'Usage: restart-apps-only.sh [--check] [api|web|apps]' >&2; exit 2; }
exec node "$REPO_ROOT/scripts/phase11-apps.mjs" restart "${1:-apps}"
