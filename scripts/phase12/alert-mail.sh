#!/usr/bin/env bash
set -Eeuo pipefail
# Minimal example notifier. The owner must verify a working, approved MTA and
# independently observe delivery before enabling either timer. No assets,
# credentials, SQL text or backup contents are included in the message.
[[ "$#" == 2 ]] || exit 2
[[ "${PHASE12_ALERT_RECIPIENT:-}" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || exit 2
[[ "$1" =~ ^[a-z0-9.-]+$ && "$2" =~ ^(FAILED|TEST)$ ]] || exit 2
[[ -x /usr/sbin/sendmail ]] || exit 1
printf 'To: %s\nSubject: Duna Phase 12 %s %s\n\nPhase 12 %s: %s. Inspect the protected owner-host journal and off-server backup status.\n' \
  "$PHASE12_ALERT_RECIPIENT" "$1" "$2" "$1" "$2" | /usr/sbin/sendmail -t
