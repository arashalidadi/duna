#!/usr/bin/env bash
# Foreground API entry for an already approved service manager. No daemonizing,
# database startup, environment override, or hard-coded home directory.
set -Eeuo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Reject an unresolved/wrong database target BEFORE the API can connect. This
# reads configuration only; the operator must still verify the active session.
node "$REPO_ROOT/scripts/check-phase11-api-target.mjs"
# Embed only a non-secret build digest into the Node process's startup environment.
# status-dev compares this marker with the current canonical output; an on-disk
# build performed after a process started must not be mistaken for a live upgrade.
DUNA_API_BUILD_SHA256="$(node "$REPO_ROOT/scripts/check-api-build.mjs" fingerprint)"
export DUNA_API_BUILD_SHA256
cd "$REPO_ROOT/apps/api"
# config.factory.ts loads the repo .env without overriding the manager's env.
# Never source .env as executable shell code or echo DATABASE_URL.
exec node "$REPO_ROOT/apps/api/dist/src/main.js"
