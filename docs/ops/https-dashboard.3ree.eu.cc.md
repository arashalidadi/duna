# HTTPS vhost proposal for dashboard.3ree.eu.cc (APPLY WITH ROOT / SUDO)

Diagnosis date: 2026-09-04.

## Root cause (verified)

- DNS for `dashboard.3ree.eu.cc` is proxied through Cloudflare (orange cloud):
  A `188.114.96.3` / `188.114.97.3`, AAAA `2a06:98c1:3120::3` / `2a06:98c1:3121::3`.
- Cloudflare terminates the viewer TLS with the valid wildcard cert
  `*.3ree.eu.cc` (Let's Encrypt, `CN=3ree.eu.cc`, valid 2026-08-08 .. 2026-11-06).
  So the browser's TLS handshake succeeds and "connects".
- Cloudflare SSL mode is **Full** -> it reaches the ORIGIN on **:443**.
- The origin nginx has **no server block for `dashboard.3ree.eu.cc` on :443**
  (the existing `dashboard.3ree.eu.cc` block only listens on :80).
  The :443 listener matches the panel/default server (expired
  `CN=panel.3ree.eu.cc` cert) and serves nginx's default
  `/var/www/html/index.html` "Welcome to nginx!" page.

Therefore:
- http://dashboard.3ree.eu.cc/           -> app  (works)
- https://dashboard.3ree.eu.cc/          -> "Welcome to nginx!" (wrong site)
- https://dashboard.3ree.eu.cc/api/v1/health -> nginx welcome page, NOT the API

## Fix

Add a `listen 443 ssl` server block for `dashboard.3ree.eu.cc` REUSING the
existing Let's Encrypt **wildcard** certificate that already covers this
hostname (`*.3ree.eu.cc`, in `/etc/letsencrypt/live/3ree.eu.cc/`). Same upstream
and proxy headers as the working :80 block. This is the smallest safe change:
it adds a vhost and does not touch the `3ree.eu.cc` / panel configuration.

### Proposed `/etc/nginx/sites-available/dashboard.3ree.eu.cc`

```nginx
server {
    listen 80;
    listen [::]:80;

    server_name dashboard.3ree.eu.cc;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    server_name dashboard.3ree.eu.cc;

    ssl_certificate     /etc/letsencrypt/live/3ree.eu.cc/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/3ree.eu.cc/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!eNULL:!MD5:!RC4:!ADH:!SSLv3:!EXP:!PSK:!DSS;

    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

CAUTION: the wildcard private key at
`/etc/letsencrypt/live/3ree.eu.cc/privkey.pem` is the SAME key already used by
the `3ree.eu.cc` server block (port 8443). Reusing the same key for a new vhost
of the same wildcard domain is safe and does NOT break the panel.

## Apply (requires sudo / root)

```bash
sudo cp /etc/nginx/sites-available/dashboard.3ree.eu.cc \
        /etc/nginx/sites-available/dashboard.3ree.eu.cc.bak.$(date +%s)   # backup (rollback)
# edit /etc/nginx/sites-available/dashboard.3ree.eu.cc with the content above
sudo nginx -t                                                              # MUST pass
sudo systemctl reload nginx
```

## Verify (sudo not needed for these)

```bash
sudo ss -lntp | grep ':443'                                  # nginx listens on 443
openssl s_client -connect 127.0.0.1:443 -servername dashboard.3ree.eu.cc \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
curl -I https://dashboard.3ree.eu.cc/                        # expect X-Powered-By: Next.js (app), 200
curl -sS https://dashboard.3ree.eu.cc/api/v1/health          # expect {"success":true,...}
curl -sS -X POST https://dashboard.3ree.eu.cc/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@shipping.local","password":"<redacted>"}'   # expect success:true
curl -I http://dashboard.3ree.eu.cc/                         # HTTP still works (or 301 if redirect added)
curl -skI https://panel1.3ree.eu.cc/LHv4xQI456Th/            # panel unchanged
```

## Optional: http->https

Only AFTER the :443 vhost is verified, if desired add `return 301 https://$host$request_uri;`
in the :80 server block. Do NOT add it in the same edit as the :443 block to avoid a redirect
loop before HTTPS is confirmed.

## Certificate renewal

`certbot` is installed with an automated **`certbot.timer`** (systemd;
next run seen 2026-09-04 16:05 +0330) and renewal config
`/etc/letsencrypt/renewal/3ree.eu.cc.conf`. The wildcard cert automatically
renews; because the new vhost references the SAME `/etc/letsencrypt/live/...`
symlinks, no renewal action is needed.