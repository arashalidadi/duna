#!/usr/bin/env bash
# One live, authorized Audit check; one intentional owner export/audit event.
# Tokens are read silently from a private terminal, passed through stdin, and
# never placed in command arguments, exported environment, a file or a log.
set +x
set -Eeuo pipefail
umask 077
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -t 0 && -r /dev/tty ]] || { echo 'A private interactive terminal is required.' >&2; exit 1; }
[[ "${PHASE11_DB_IDENTITY_ATTESTED:-}" == I_VERIFIED_ACTIVE_SESSION ]] || {
  echo 'STOP: independently verify the active DB session before an owner export.' >&2; exit 1;
}
[[ "${PHASE11_APPROVED_DB_NAME:-}" == duna_seed_test ]] || {
  echo 'STOP: require owner-confirmed duna_seed_test before authorized export.' >&2; exit 1;
}
ordinary_token=''
owner_token=''
trap 'unset ordinary_token owner_token' EXIT
IFS= read -r -s -p 'Approved ordinary-reader access token: ' ordinary_token </dev/tty
printf '\n' >/dev/tty
IFS= read -r -s -p 'Approved primary-owner access token: ' owner_token </dev/tty
printf '\n' >/dev/tty
[[ -n "$ordinary_token" && -n "$owner_token" ]] || { echo 'Both approved tokens are required.' >&2; exit 1; }
printf '%s\n%s\n' "$ordinary_token" "$owner_token" | node "$REPO_ROOT/scripts/check-phase11-authorized.mjs"
