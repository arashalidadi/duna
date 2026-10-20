#!/usr/bin/env bash
# Duna ERP — server installer / updater / repair tool.
#
# Runs ON the target server as the deploy user. It is idempotent: running it
# again on a healthy install is a no-op apart from pulling the branch,
# reinstalling dependencies, re-applying migrations and restarting services.
#
# It never drops a database, never deletes application data, and never touches
# PostgreSQL's own data directory. The one destructive operation (re-baselining
# the migration journal) is behind an explicit flag plus an acknowledgement
# variable, because a squashed migration history cannot be applied over a
# journal that still lists the pre-squash names.
#
# Modes:
#   --check      read-only diagnosis; changes nothing, exits 1 if not deployable
#   --install    full install or repair (default)
#   --update     same as --install but skips prerequisite installation
#   --health     only probe the running services
#
# Every step below reuses the repository's own commands (pnpm db generate,
# pnpm db deploy, pnpm db seed, pnpm build, pnpm check); nothing is
# re-implemented here.
set -Eeuo pipefail
umask 022

# ---------------------------------------------------------------------------
# Configuration (override through the environment; never hard-code secrets)
# ---------------------------------------------------------------------------
APP_DIR="${APP_DIR:-/opt/duna}"
BRANCH="${BRANCH:-arena/5c597eb9-duna}"
REPO_URL="${REPO_URL:-https://github.com/arashalidadi/duna.git}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env}"
WEB_ENV_FILE="${WEB_ENV_FILE:-$APP_DIR/apps/web/.env.local}"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"
INSTALL_SYSTEMD="${INSTALL_SYSTEMD:-1}"
INSTALL_NGINX="${INSTALL_NGINX:-0}"
ATTACHMENT_DIR="${ATTACHMENT_DIR:-/var/lib/duna/attachments}"
NODE_MAJOR_MIN="${NODE_MAJOR_MIN:-20}"
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"
# Required by the API's pre-start target check when the Phase 11 gate is in use.
PHASE11_APPROVED_DB_NAME="${PHASE11_APPROVED_DB_NAME:-}"
# Acknowledgement for the only destructive step; see --rebaseline-migrations.
DUNA_ACK_REBASELINE="${DUNA_ACK_REBASELINE:-}"

MODE="install"
REBASELINE=0
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --install) MODE="install" ;;
    --update) MODE="update" ;;
    --health) MODE="health" ;;
    --rebaseline-migrations) REBASELINE=1 ;;
    --no-systemd) INSTALL_SYSTEMD=0 ;;
    --with-nginx) INSTALL_NGINX=1 ;;
    -h|--help)
      sed -n '2,26p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[1;34m[duna]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[duna]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[duna]\033[0m %s\n' "$*" >&2; exit 1; }
ok()   { printf '\033[1;32m[duna]\033[0m %s\n' "$*"; }

need() { command -v "$1" >/dev/null 2>&1 || return 1; }

# ---------------------------------------------------------------------------
# 1. Prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
  local missing=()
  need git   || missing+=("git")
  need node  || missing+=("node")
  need pnpm  || missing+=("pnpm")
  if [ ${#missing[@]} -gt 0 ]; then
    warn "missing prerequisites: ${missing[*]}"
    return 1
  fi
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -lt "$NODE_MAJOR_MIN" ]; then
    warn "Node $major is older than the required $NODE_MAJOR_MIN"
    return 1
  fi
  ok "prerequisites: git $(git --version | awk '{print $3}'), node $(node -v), pnpm $(pnpm -v)"
}

install_prerequisites() {
  if ! need node; then
    die "Node.js >= $NODE_MAJOR_MIN must be installed by the operator (package manager policy differs per distribution); refusing to modify system packages silently."
  fi
  if ! need pnpm || [ "$(pnpm -v 2>/dev/null | cut -d. -f1)" != "${PNPM_VERSION%%.*}" ]; then
    log "installing pnpm $PNPM_VERSION"
    npm install --global "pnpm@$PNPM_VERSION" >/dev/null
  fi
  check_prerequisites || die "prerequisites still incomplete"
}

# ---------------------------------------------------------------------------
# 2. Source tree
# ---------------------------------------------------------------------------
fetch_source() {
  if [ ! -d "$APP_DIR/.git" ]; then
    log "cloning $REPO_URL ($BRANCH) into $APP_DIR"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  else
    log "updating $APP_DIR to $BRANCH"
    git -C "$APP_DIR" remote set-url origin "$REPO_URL"
    git -C "$APP_DIR" fetch --prune origin "$BRANCH"
    # A previous failed install commonly leaves a dirty tree or a detached HEAD.
    # The branch is the deployment source of truth, so it is checked out hard.
    git -C "$APP_DIR" checkout --force "$BRANCH"
    git -C "$APP_DIR" reset --hard "origin/$BRANCH"
    git -C "$APP_DIR" clean -ffd -e .env -e .env.local -e 'apps/web/.env.local' -e node_modules
  fi
  ok "source at $(git -C "$APP_DIR" rev-parse --short HEAD) — $(git -C "$APP_DIR" log -1 --pretty=%s)"
}

# ---------------------------------------------------------------------------
# 3. Environment file
# ---------------------------------------------------------------------------
check_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    warn "$ENV_FILE is missing; copy .env.production.example and fill in real secrets"
    return 1
  fi
  local perms owner
  perms="$(stat -c '%a' "$ENV_FILE")"
  owner="$(stat -c '%U' "$ENV_FILE")"
  [ "$perms" = "600" ] || warn "$ENV_FILE is mode $perms; it must be 600"
  [ "$owner" = "$(id -un)" ] || warn "$ENV_FILE is owned by $owner, not $(id -un)"
  # Refuse to start with the shipped placeholders: that is the classic cause of
  # an install that "succeeds" and then serves an app that cannot authenticate.
  if grep -qE '^(AUTH_JWT_SECRET|AUTH_JWT_REFRESH_SECRET)=change-me' "$ENV_FILE"; then
    warn "$ENV_FILE still contains a placeholder JWT secret"
    return 1
  fi
  if grep -qE '^DATABASE_URL=.*shipping_dev_pass' "$ENV_FILE"; then
    warn "$ENV_FILE still contains the example database password"
    return 1
  fi
  ok "environment file present and not using shipped placeholders"
}

# NODE_ENV=development is what .env.example ships, and it breaks `next build`
# (Next refuses to prerender with a non-standard NODE_ENV). Builds must run
# without it; the API reads it from the file at runtime instead.
load_env_for_build() {
  set -a; . "$ENV_FILE"; set +a
  unset NODE_ENV
}

db_url() { grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"'; }

# ---------------------------------------------------------------------------
# 4. Database
# ---------------------------------------------------------------------------
psql_admin() {
  # The operator supplies an administrative connection; the app's own runtime
  # URL is deliberately not used for DDL.
  local url="${DUNA_ADMIN_DATABASE_URL:-}"
  [ -n "$url" ] || die "DUNA_ADMIN_DATABASE_URL is required for database provisioning (an owner/superuser URL for the target cluster)"
  psql "$url" -v ON_ERROR_STOP=1 "$@"
}

check_database() {
  local url
  url="$(db_url)"
  [ -n "$url" ] || { warn "no DATABASE_URL in $ENV_FILE"; return 1; }
  if ! node -e '
    const url = process.argv[1];
    const net = require("node:net");
    const u = new URL(url);
    const s = net.connect(Number(u.port || 5432), u.hostname);
    s.setTimeout(5000, () => { s.destroy(); process.exit(1); });
    s.on("connect", () => { s.end(); process.exit(0); });
    s.on("error", () => process.exit(1));
  ' "$url" 2>/dev/null; then
    warn "PostgreSQL is not reachable at the host in DATABASE_URL"
    return 1
  fi
  ok "PostgreSQL reachable at $(node -p "new URL(process.argv[1]).host" "$url")"
}

# A database provisioned before the migration squash still lists the 49 old
# names in _prisma_migrations. `prisma migrate deploy` then refuses to apply the
# three-file baseline. Re-baselining rewrites only that journal, never data.
migrations_need_rebaseline() {
  local count
  count="$(psql_admin -tAc "select count(*) from _prisma_migrations" 2>/dev/null || echo 0)"
  [ "${count:-0}" -gt 3 ]
}

rebaseline_migrations() {
  if ! migrations_need_rebaseline; then
    log "migration journal already matches the squashed baseline"
    return 0
  fi
  if [ "$DUNA_ACK_REBASELINE" != "I_UNDERSTAND_JOURNAL_ONLY" ]; then
    die "the existing database records $(psql_admin -tAc 'select count(*) from _prisma_migrations') pre-squash migrations. Re-run with --rebaseline-migrations and DUNA_ACK_REBASELINE=I_UNDERSTOOD_JOURNAL_ONLY. This rewrites ONLY _prisma_migrations; no table data is touched."
  fi
  warn "re-baselining the migration journal (data untouched)"
  psql_admin -c 'DELETE FROM _prisma_migrations'
  for m in $(ls -1 "$APP_DIR/prisma/migrations" | grep -E '^[0-9]{14}_' | sort); do
    log "  marking applied: $m"
    ( cd "$APP_DIR" && pnpm exec prisma migrate resolve --applied "$m" )
  done
  ok "migration journal re-baselined to $(ls -1 "$APP_DIR/prisma/migrations" | grep -cE '^[0-9]{14}_') migrations"
}

provision_database() {
  check_database || die "cannot reach PostgreSQL"
  local db
  db="$(node -p "new URL(process.argv[1]).pathname.slice(1)" "$(db_url)")"
  local exists
  exists="$(psql_admin -tAc "select 1 from pg_database where datname='$db'" || true)"
  if [ -z "$exists" ]; then
    log "creating database $db"
    psql_admin -c "CREATE DATABASE $(node -p "JSON.stringify(process.argv[1])" "$db" | sed 's/"//g' | sed "s/.*/\"&\"/")"
  else
    log "database $db already exists"
  fi
  if ! psql_admin -tAc "select to_regclass('public._prisma_migrations')" | grep -q .; then
    log "empty schema; migrations will create it"
  else
    rebaseline_migrations
  fi
}

# ---------------------------------------------------------------------------
# 5. Build and migrate
# ---------------------------------------------------------------------------
build_and_migrate() {
  log "installing dependencies"
  ( cd "$APP_DIR" && pnpm install --frozen-lockfile )
  load_env_for_build
  log "applying migrations"
  ( cd "$APP_DIR" && pnpm db deploy )
  log "seeding reference data (no demo business data)"
  ( cd "$APP_DIR" && SEED_DEMO_DATA=false pnpm db seed )
  log "building (NODE_ENV intentionally unset for the Next build)"
  ( cd "$APP_DIR" && pnpm build )
  mkdir -p "$ATTACHMENT_DIR"
  chmod 0700 "$ATTACHMENT_DIR" 2>/dev/null || true
  ok "build complete: apps/api/dist/src/main.js and apps/web/.next present"
}

# ---------------------------------------------------------------------------
# 6. Services
# ---------------------------------------------------------------------------
install_services() {
  if [ "$INSTALL_SYSTEMD" != "1" ]; then
    log "skipping systemd units (--no-systemd)"
    return 0
  fi
  if [ ! -d "$SYSTEMD_DIR" ] || ! need systemctl; then
    warn "systemd not available; not installing units"
    return 0
  fi
  local unit
  for unit in duna-api duna-web; do
    log "installing $unit.service"
    sed -e "s|@APP_DIR@|$APP_DIR|g" \
        -e "s|@ENV_FILE@|$ENV_FILE|g" \
        -e "s|@ATTACHMENT_DIR@|$ATTACHMENT_DIR|g" \
        -e "s|@USER@|$(id -un)|g" \
        -e "s|@NODE@|$(command -v node)|g" \
        -e "s|@PHASE11_DB@|$PHASE11_APPROVED_DB_NAME|g" \
        "$APP_DIR/deploy/systemd/$unit.service" > "$SYSTEMD_DIR/$unit.service"
  done
  systemctl daemon-reload
  systemctl enable duna-api duna-web >/dev/null 2>&1 || true
  systemctl restart duna-api
  sleep 3
  systemctl restart duna-web
  ok "services restarted"
  if [ "$INSTALL_NGINX" = "1" ] && [ -d /etc/nginx/sites-available ]; then
    cp "$APP_DIR/deploy/nginx/duna.conf" /etc/nginx/sites-available/duna.conf
    ln -sf /etc/nginx/sites-available/duna.conf /etc/nginx/sites-enabled/duna.conf
    nginx -t && systemctl reload nginx && ok "nginx reloaded"
  fi
}

health() {
  local rc=0
  bash "$APP_DIR/deploy/healthcheck.sh" || rc=1
  return $rc
}

# ---------------------------------------------------------------------------
main() {
  case "$MODE" in
    check)
      log "read-only diagnosis (mode=check)"
      local failed=0
      check_prerequisites || failed=1
      if [ -d "$APP_DIR/.git" ]; then
        ok "source tree present at $APP_DIR ($(git -C "$APP_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown))"
      else
        warn "no source tree at $APP_DIR"; failed=1
      fi
      check_env_file || failed=1
      if [ -f "$ENV_FILE" ]; then check_database || failed=1; fi
      [ -f "$APP_DIR/apps/api/dist/src/main.js" ] && ok "API build present" || { warn "API build missing"; failed=1; }
      [ -d "$APP_DIR/apps/web/.next" ] && ok "web build present" || { warn "web build missing"; failed=1; }
      [ -d "$APP_DIR/node_modules" ] && ok "dependencies installed" || { warn "node_modules missing"; failed=1; }
      if [ -f "$ENV_FILE" ]; then health || failed=1; fi
      [ "$failed" = 0 ] && ok "diagnosis clean: this host is deployable" \
                        || die "diagnosis found problems; see the warnings above"
      ;;
    health)
      [ -d "$APP_DIR" ] || die "$APP_DIR does not exist"
      health
      ;;
    install|update)
      if [ "$MODE" = "install" ]; then install_prerequisites; else check_prerequisites || die "prerequisites missing"; fi
      fetch_source
      check_env_file || die "fix $ENV_FILE before deploying"
      provision_database
      build_and_migrate
      install_services
      sleep 2
      health || die "services did not become healthy; check journalctl -u duna-api -u duna-web"
      ok "deployment complete on $BRANCH"
      ;;
  esac
}
main
