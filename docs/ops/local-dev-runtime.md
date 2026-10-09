# ERP Local Development — Runtime & Persistence

> Current API default: **3101**. The startup/status scripts honor exported `API_PORT`, then
> repo-root `.env`, then this default. Set the matching server-only `API_INTERNAL_URL` in
> `apps/web/.env.local`; keep `NEXT_PUBLIC_API_URL=/api/v1`.
>
> The machine-specific PostgreSQL paths and persistence notes below describe a **historical
> workstation**, not provisioned services in a fresh Arena workspace. Check binaries, cluster,
> credentials and listeners first. Do not execute install/init/reset against an existing DB
> merely to repair a preview. See [current audit](backend-connection-audit.md).

## Quick start

```bash
cd /home/arash/Downloads/ai/opencode

# Start everything (idempotent, detached):
./scripts/start-dev.sh

# Check status:
./scripts/status-dev.sh

# Stop everything:
./scripts/stop-dev.sh
```

Services are launched with `setsid`+`nohup` and are detached from the calling shell.
Closing OpenCode does NOT stop them.

## Services

| Service  | Port  | URL                              |
|----------|-------|----------------------------------|
| Web      | 3000  | http://127.0.0.1:3000           |
| API      | 3101  | http://127.0.0.1:3101/api/v1    |
| PostgreSQL | 5432 | postgresql://shipping:***@127.0.0.1:5432/shipping_erp |

## PostgreSQL data persistence

**Data directory:** `/home/arash/shipping-erp/pgdata`

- On root filesystem `/dev/vda2` (NOT tmpfs, NOT under `/tmp`)
- Survives reboot and shell/terminal closure
- Not subject to systemd-tmpfiles 30-day cleanup
- Managed by `infra/standalone-db/manage.sh` (PG_HOME default updated)

**Before:** data was at `/tmp/opencode/pg/pgdata` — subject to `/tmp` 30-day cleanup
via systemd-tmpfiles-clean (`D /tmp 1777 root root 30d`). Relocated to durable
home directory. All data preserved byte-for-byte (rsync while stopped, no dump/restore).

## Architecture

```
Browser → http://127.0.0.1:3000 (Next.js dev)
              ↓ (same-origin /api/v1 proxy)
           http://127.0.0.1:3101 (NestJS API)
              ↓
           http://127.0.0.1:5432 (PostgreSQL, durable data)
```

- Docker is NOT used (socket denied). Standalone PG 16 (extracted from Ubuntu .debs).
- PG binaries: `/tmp/opencode/pgroot/usr/lib/postgresql/16/bin/` (not relocated, no persistence risk).
- Socket: `/home/arash/shipping-erp/socket` (durable).

## Logs

```
logs/api.log          — API output
logs/web.log          — Next.js dev output  
logs/pg-start.log     — PostgreSQL start output
/home/arash/shipping-erp/pg.log — PostgreSQL server log
```

## After reboot

Run `./scripts/start-dev.sh` — it will start PG from durable data, then API, then Web.
No manual intervention required.

## Troubleshooting

**Port 3000 in use:** Run `./scripts/stop-dev.sh` first, or identify and stop the conflicting process.

**API unavailable:** Check `logs/api.log`. Ensure PostgreSQL is up first (`./scripts/status-dev.sh`).

**Database unavailable:** Check `logs/pg-start.log`. Ensure `/home/arash/shipping-erp/pgdata/PG_VERSION` exists.
If missing, data was lost — restore from backup.

**Web process lingers after stop:** Run `pkill -f "next dev -p 3000"` and `pkill -f "next-server"`.
