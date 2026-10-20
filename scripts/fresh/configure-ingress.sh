#!/usr/bin/env bash
# Install the repo-managed HTTPS reverse proxy and an automatically renewed cert.
set -Eeuo pipefail

DOMAIN=${1:?usage: configure-ingress.sh DOMAIN TLS_EMAIL}
EMAIL=${2:?usage: configure-ingress.sh DOMAIN TLS_EMAIL}
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { echo 'Invalid public hostname' >&2; exit 2; }
[[ "$DOMAIN" == *.* && "$DOMAIN" != *..* ]] || { echo 'DEPLOY_DOMAIN must be a fully qualified domain name' >&2; exit 2; }
[[ "$EMAIL" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo 'Invalid TLS_EMAIL' >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo 'Ingress setup requires root' >&2; exit 1; }

AVAILABLE=/etc/nginx/sites-available/duna-managed.conf
ENABLED=/etc/nginx/sites-enabled/duna-managed.conf
OWNER=/etc/nginx/sites-available/duna-managed.owner
EXPECTED="duna-managed:${DOMAIN}"
if [ -e "$OWNER" ]; then
  [ -f "$OWNER" ] && [ ! -L "$OWNER" ] || { echo 'Invalid Nginx ownership marker' >&2; exit 1; }
  IFS= read -r actual < "$OWNER"
  [ "$actual" = "$EXPECTED" ] || { echo 'Managed hostname differs from installed hostname; refusing implicit ingress change' >&2; exit 1; }
else
  [ ! -e "$AVAILABLE" ] || { echo 'Nginx site name is already occupied; refusing overwrite' >&2; exit 1; }
  [ ! -e "$ENABLED" ] || { echo 'Nginx enabled-site name is already occupied; refusing overwrite' >&2; exit 1; }
  (umask 022; printf '%s\n' "$EXPECTED" > "$OWNER")
fi
if [ -e "$ENABLED" ] && [ "$(readlink -f "$ENABLED" 2>/dev/null || true)" != "$AVAILABLE" ]; then
  echo 'Nginx enabled-site path is not owned by this installer; refusing overwrite' >&2
  exit 1
fi

render_template() {
  local source=$1 destination=$2 temporary
  temporary=$(mktemp)
  python3 - "$source" "$DOMAIN" "$temporary" <<'PY'
import pathlib, sys
source, hostname, destination = sys.argv[1:]
text = pathlib.Path(source).read_text(encoding='utf-8')
if text.count('duna.example.com') == 0:
    raise SystemExit('Nginx template is missing its hostname placeholder')
pathlib.Path(destination).write_text(text.replace('duna.example.com', hostname), encoding='utf-8')
PY
  install -m 0644 "$temporary" "$destination"
  rm -f "$temporary"
}

mkdir -p /var/www/certbot/.well-known/acme-challenge /etc/nginx/sites-available /etc/nginx/sites-enabled
render_template deploy/nginx/duna-http-challenge.conf "$AVAILABLE"
ln -sfn "$AVAILABLE" "$ENABLED"
nginx -t >/dev/null
systemctl reload nginx

# Do not try to issue a certificate before the webroot challenge can be served.
# certbot is idempotent and keeps a valid certificate until it nears expiry.
certbot certonly --webroot --webroot-path /var/www/certbot \
  --domain "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive --keep-until-expiring

render_template deploy/nginx/duna.conf "$AVAILABLE"
nginx -t >/dev/null
systemctl reload nginx
systemctl enable --now certbot.timer
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat > /etc/letsencrypt/renewal-hooks/deploy/50-duna-reload-nginx <<'HOOK'
#!/bin/sh
systemctl reload nginx
HOOK
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/50-duna-reload-nginx

echo "INGRESS_PASS https://${DOMAIN}/"
