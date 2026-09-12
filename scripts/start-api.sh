#!/usr/bin/env bash
# Load root .env then start the built API (dist/src/main.js does not auto-load .env).
set -a
source /home/arash/shipping-dashboard/new-erp/.env
set +a
cd /home/arash/shipping-dashboard/new-erp/apps/api
exec node dist/src/main.js
