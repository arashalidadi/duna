-- P4-U4 backfill (ADR-046 ruling 1 / ADR-045 decision 2): shipped 'ISSUED' rows map to
-- the issued-equivalent 'APPROVED'. DRAFT/CANCELLED untouched. Idempotent — a re-run
-- matches zero rows (safe under any deploy policy).
UPDATE "bills_of_lading" SET "status" = 'APPROVED' WHERE "status" = 'ISSUED';
