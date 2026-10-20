#!/usr/bin/env bash
# Idempotently install the runtime required by the fresh installer on Debian/Ubuntu.
# Docker-group membership is root-equivalent; the caller must explicitly authorize it.
set -Eeuo pipefail

DEPLOY_USER=${1:?usage: bootstrap-host.sh DEPLOY_USER}
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*\$?$ ]] || { echo 'Invalid deploy user' >&2; exit 2; }

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

if [ "$(id -u)" -ne 0 ] && ! sudo -n true 2>/dev/null; then
  echo 'DEPLOY_USER needs non-interactive sudo/root for first-run host provisioning' >&2
  exit 1
fi

. /etc/os-release
case "${ID:-}" in
  debian|ubuntu) ;;
  *) echo 'Only Debian and Ubuntu hosts are supported by automated provisioning' >&2; exit 1 ;;
esac
CODENAME=${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}
case "$CODENAME" in
  ''|*[!a-z0-9]*) echo 'Could not identify a supported Debian/Ubuntu release' >&2; exit 1 ;;
esac

if command -v docker >/dev/null 2>&1 && command -v node >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1 && command -v nginx >/dev/null 2>&1 && command -v certbot >/dev/null 2>&1; then
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
  pnpm_major=$(pnpm --version 2>/dev/null | cut -d. -f1 || true)
  if [ "$node_major" -ge 20 ] && [ "$pnpm_major" = 9 ] && \
    docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && \
    systemctl is-enabled --quiet docker && systemctl is-enabled --quiet nginx; then
    echo 'HOST_BOOTSTRAP_PASS existing Node.js, pnpm 9 and boot-enabled Docker are ready'
    exit 0
  fi
fi

# A previous bootstrap attempt may have left our Docker .list beside an
# existing deb822 .sources entry. Remove only that duplicate before the first
# apt update; conflicting Signed-By values make apt abort before it can repair.
DOCKER_SOURCES=
for source in /etc/apt/sources.list.d/*.sources; do
  [ -f "$source" ] || continue
  if grep -Eqi 'URIs:[[:space:]]*https?://download\.docker\.com/linux/' "$source"; then
    DOCKER_SOURCES=$source
    if ! grep -Eqi 'Signed-By:[[:space:]]*/etc/apt/keyrings/docker\.asc([[:space:]]|$)' "$source"; then
      echo 'Existing Docker deb822 source uses an unexpected Signed-By key; refusing to change APT trust implicitly' >&2
      exit 1
    fi
    if [ -f /etc/apt/sources.list.d/docker.list ] && \
      grep -q 'download.docker.com/linux/' /etc/apt/sources.list.d/docker.list; then
      as_root rm -f /etc/apt/sources.list.d/docker.list
    fi
    break
  fi
done

# No host packages are removed or upgraded. Docker's signed APT repository is
# pinned to its published primary-key fingerprint before APT can trust it.
as_root apt-get update -qq
as_root apt-get install -y -qq ca-certificates curl gnupg libstdc++6
as_root install -d -m 0755 /etc/apt/keyrings
key_tmp=$(mktemp)
trap 'rm -f "$key_tmp"' EXIT
curl -fsSL https://download.docker.com/linux/${ID}/gpg -o "$key_tmp"
actual=$(gpg --show-keys --with-colons "$key_tmp" 2>/dev/null | awk -F: '$1 == "fpr" {print $10; exit}')
expected=9DC858229FC7DD38854AE2D88D81803C0EBFCD88
[ "$actual" = "$expected" ] || { echo 'Docker APT signing-key fingerprint mismatch' >&2; exit 1; }
as_root install -m 0644 "$key_tmp" /etc/apt/keyrings/docker.asc
arch=$(dpkg --print-architecture)
if [ -z "$DOCKER_SOURCES" ]; then
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' "$arch" "$ID" "$CODENAME" |
    as_root tee /etc/apt/sources.list.d/docker.list >/dev/null
fi
as_root apt-get update -qq
as_root apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx certbot
as_root systemctl enable --now docker nginx
if command -v ufw >/dev/null 2>&1 && as_root ufw status 2>/dev/null | grep -q '^Status: active'; then
  as_root ufw allow 80/tcp comment 'Duna ACME HTTP-01'
  as_root ufw allow 443/tcp comment 'Duna HTTPS dashboard'
fi

# The deploy user needs Docker CLI access. This is effectively root authority,
# required for the requested autonomous database/container installation.
if [ "$DEPLOY_USER" != root ]; then
  as_root getent group docker >/dev/null || as_root groupadd docker
  as_root usermod -aG docker "$DEPLOY_USER"
fi

# The same official, registry-verified Node 22 image used by the project supplies
# a host Node runtime if absent/too old; no untrusted curl|bash installer is used.
node_ok=false
if command -v node >/dev/null 2>&1; then
  node_major=$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
  [ "$node_major" -ge 20 ] && node_ok=true
fi
if [ "$node_ok" != true ]; then
  image=node:22-bookworm
  as_root docker pull "$image" >/dev/null
  container=$(as_root docker create "$image")
  node_tmp=$(mktemp -d)
  trap 'rm -rf "$node_tmp"; as_root docker rm -f "$container" >/dev/null 2>&1 || true; rm -f "$key_tmp"' EXIT
  mkdir -p "$node_tmp/usr-local"
  as_root docker cp "$container:/usr/local/." "$node_tmp/usr-local"
  target=/opt/duna-toolchain/node22
  as_root install -d -m 0755 "$target"
  as_root cp -a "$node_tmp/usr-local/." "$target/"
  rm -rf "$node_tmp"
  as_root docker rm "$container" >/dev/null
  trap 'rm -f "$key_tmp"' EXIT
  for bin in node npm npx corepack; do
    as_root ln -sfn "$target/bin/$bin" "/usr/local/bin/$bin"
  done
fi
node_major=$(node -p 'Number(process.versions.node.split(".")[0])')
[ "$node_major" -ge 20 ] || { echo 'Node.js >=20 is required' >&2; exit 1; }
if ! command -v pnpm >/dev/null 2>&1 || [[ "$(pnpm --version)" != 9.* ]]; then
  as_root npm install --global pnpm@9.15.9
fi

# Ensure this ssh session need not rely on stale group membership; workflow opens
# a new SSH session after bootstrap before it runs Docker-backed setup.
docker compose version --short >/dev/null
systemctl is-enabled --quiet docker
systemctl is-enabled --quiet nginx
echo 'HOST_BOOTSTRAP_PASS Debian/Ubuntu, Docker Compose, Node.js, pnpm, Nginx and Certbot ready'
