#!/usr/bin/env bash
set -Eeuo pipefail
# Read-only PID/listener/build status. DB destination is NOT verified here.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$REPO_ROOT/scripts/phase11-apps.mjs" status
