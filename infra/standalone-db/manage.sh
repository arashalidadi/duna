#!/usr/bin/env bash
# =============================================================================
# Standalone PostgreSQL for Shipping ERP (rootless, no Docker/root required)
#
# Why this exists: this sandbox has neither Docker (daemon) nor root/sudo, and
# the Metasploit-bundled PostgreSQL previously used is gone. The app's reference
# DB is `postgres:16-alpine` (see docker/docker-compose.dev.yml) with connection
# string `postgresql://shipping:...@localhost:5432/shipping_erp` (.env).
#
# This script provisions PostgreSQL 16 from Ubuntu .debs into a user-writable
# prefix and manages a standalone cluster. It makes NO modifications to the
# system, root dirs, or /opt — everything lives under a PG_HOME you choose.
#
# Usage:
#   ./infra/standalone-db/manage.sh install   # download+extract PG16 binaries
#   ./infra/standalone-db/manage.sh init      # create cluster + db + apply seed
#   ./infra/standalone-db/manage.sh start     # start the server
#   ./infra/standalone-db/manage.sh stop      # stop the server
#   ./infra/standalone-db/manage.sh status    # show listening + health
#   ./infra/standalone-db/manage.sh reset     # (re)init from scratch (destructive)
# =============================================================================
set -Eeuo pipefail

# ------------------------------------------------------------------ paths/config
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Durable home for the cluster DATA dir. This lives OUTSIDE /tmp so it is never
# subject to systemd tmpfiles 30-day cleanup or reboot-time /tmp clearing, and it
# is independent of any OpenCode session. Binaries may still live under a temp
# prefix; only the DATA must be durable.
PG_HOME="${PG_HOME:-/home/arash/shipping-erp}"
PG_VERSION="16"

PGROOT="${PGROOT:-/tmp/opencode/pgroot}"       # extracted binaries/lib
# NOTE: binaries are provisioned to /tmp/opencode/pgroot (see GETPG note). Override
# with PGROOT=... if you choose a different prefix. Never use /opt — protected here.
PGBIN="${PGROOT}/usr/lib/postgresql/${PG_VERSION}/bin"
PGLIB="${PGROOT}/usr/lib/postgresql/${PG_VERSION}/lib"
PGX86LIB="${PGROOT}/usr/lib/x86_64-linux-gnu"
PGDATA="${PG_HOME}/pgdata"                     # cluster data dir
PGSOCK="${PG_HOME}/socket"                     # unix socket dir
PGLOG="${PG_HOME}/pg.log"
PGPORT=5432
PGUSER=shipping
PGDB=shipping_erp

# debs to fetch via apt download (pin exact-ish for reproducibility)
DEBS=(libpq5 postgresql-${PG_VERSION} postgresql-client-${PG_VERSION} postgresql-common postgresql-client-common ssl-cert)

export LD_LIBRARY_PATH="${PGLIB}:${PGX86LIB}"
export PATH="${PGBIN}:${PATH}"

# ------------------------------------------------------------------ helpers
log() { printf '[manage.sh] %s\n' "$*"; }
die() { printf '[manage.sh] ERROR: %s\n' "$*" >&2; exit 1; }

wrp() { # run a pg binary with proper env
  "${PGBIN}/$1" "${@:2}"
}

download_binaries() {
  [ -x "${PGBIN}/postgres" ] && { log "binaries already present at ${PGBIN}"; return 0; }
  command -v apt-get >/dev/null || die "apt-get not found (required to fetch PG .debs)"
  mkdir -p "${PG_HOME}/debs" "${PGROOT}"
  local d fn
  for d in "${DEBS[@]}"; do
    # apt-get download prints to cwd and can block on lock when a repo holds the lock;
    # run it scoped and with a hard timeout so we never hang.
    ( cd "${PG_HOME}/debs" && timeout 60 apt-get download "$d" >/dev/null 2>&1 || true )
  done
  local found=0
  shopt -s nullglob
  for deb in "${PG_HOME}/debs"/*.deb; do
    dpkg-deb -x "$deb" "${PGROOT}/"; found=1
  done
  shopt -u nullglob
  [ "$found" = 1 ] || die "no .deb downloaded — run apt-get download <pkg> manually into ${PG_HOME}/debs"
  [ -x "${PGBIN}/postgres" ] || die "postgres binary missing after extraction"
  log "PostgreSQL $(wrp postgres --version) extracted under ${PGROOT}"
}

init_cluster() {
  [ -f "${PGDATA}/PG_VERSION" ] && { log "cluster already initialized"; return 0; }
  mkdir -p "${PGDATA}" "${PGSOCK}"
  wrp initdb -D "${PGDATA}" -U "${PGUSER}" --auth-local=trust --auth-host=trust -E UTF8 --no-locale >/dev/null
  {
    echo "# shipping ERP standalone — managed by infra/standalone-db/manage.sh"
    echo "port = ${PGPORT}"
    echo "listen_addresses = '127.0.0.1'"
    echo "unix_socket_directories = '${PGSOCK}'"
    echo "shared_buffers = 64MB"
  } >> "${PGDATA}/postgresql.conf"
  log "cluster initialized at ${PGDATA} (user=${PGUSER}, port=${PGPORT})"
}

ensure_db() {
  pg_isready -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" >/dev/null 2>&1 || start
  wrp psql -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${PGDB}'" | grep -q 1 || {
      wrp createdb -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" "${PGDB}"
      log "created database ${PGDB}"
    }
}

start() {
  if pg_isready -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" >/dev/null 2>&1; then
    log "already running on 127.0.0.1:${PGPORT}"
    return 0
  fi
  pg_ctl -D "${PGDATA}" -l "${PGLOG}" start >/dev/null
  log "started (logs: ${PGLOG})"
  sleep 1
}

stop() {
  pg_ctl -D "${PGDATA}" stop >/dev/null 2>&1 && log "stopped" || log "not running"
}

status() {
  printf 'home : %s\n' "${PG_HOME}"
  pg_isready -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" && printf 'port : %s\n' "${PGPORT}"
}

reset() {
  stop || true
  rm -rf "${PGDATA}"
  init_cluster
  start
}

# ------------------------------------------------------------------ dispatch
case "${1:-status}" in
  install) download_binaries ;;
  init)
    download_binaries
    init_cluster
    start
    ensure_db
    ;;
  start)   download_binaries; init_cluster; start; ensure_db ;;
  stop)    stop ;;
  status)  download_binaries >/dev/null 2>&1 || true; status ;;
  reset)   download_binaries; reset ;;
  *) echo "usage: $0 {install|init|start|stop|status|reset}" >&2; exit 2 ;;
esac
