#!/usr/bin/env bash
set -Eeuo pipefail
# API + Web by default, or pass api/web. Never stops PostgreSQL.
# Unmanaged/unknown listeners are NOT killed; use their actual owner manager.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$#" -le 1 ]] || { echo 'Usage: stop-dev.sh [api|web|apps]' >&2; exit 2; }
exec node "$REPO_ROOT/scripts/phase11-apps.mjs" stop "${1:-apps}"
