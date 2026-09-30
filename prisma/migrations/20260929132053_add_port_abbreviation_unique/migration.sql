-- Phase 2: Port.abbreviation — additive, non-destructive.

-- 1) Ensure the column exists as nullable text.
--    (Already present on the live DB from an out-of-band change; IF NOT EXISTS
--     keeps this safe on both the live database and a fresh replay.)
ALTER TABLE "Port" ADD COLUMN IF NOT EXISTS "abbreviation" TEXT;

-- 2) Drop the stray non-unique index on abbreviation (created outside Prisma;
--    not declared in schema.prisma, redundant once the unique index exists).
DROP INDEX IF EXISTS "Port_abbreviation_idx";

-- 3) Enforce uniqueness where a value is supplied (Postgres treats NULLs as
--    distinct, so ports without an abbreviation are unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS "Port_abbreviation_key" ON "Port"("abbreviation");
