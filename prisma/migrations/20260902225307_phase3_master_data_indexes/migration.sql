-- Phase 3 — master-data search/filter indexes
-- Supports exact-match country and active filters on Ports,
-- and complements the existing unique code indexes.

CREATE INDEX "Port_country_idx" ON "Port"("country");
