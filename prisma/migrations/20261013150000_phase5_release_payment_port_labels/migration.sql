-- Phase 5 slice 1 (REQ-182, REQ-186, DEC-059/060/061, DEC-063, AUD-010):
-- release payment state, delivery-order port, and configurable B/L lifecycle labels.
--
-- Additive only:
--   1) new enum type and nullable column on release_orders; existing rows stay NULL,
--   2) new nullable port columns and an index on delivery_orders; existing rows stay NULL,
--   3) new table bl_lifecycle_labels; no existing table, column, enum value or row is changed.
-- No status, money field or document number is changed by this migration.
-- Replay-safe: every statement is guarded.

-- 1) Payment state recorded at release (REQ-182, EMP-685..689)
DO $$
BEGIN
  CREATE TYPE "ReleasePaymentState" AS ENUM ('PAID', 'PARTIAL', 'UNPAID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "release_orders" ADD COLUMN IF NOT EXISTS "paymentState" "ReleasePaymentState";

-- 2) Port on the delivery order (REQ-186, EMP-671). portName is a snapshot taken at issue.
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "portId" TEXT;
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "portName" TEXT;

CREATE INDEX IF NOT EXISTS "delivery_orders_portId_idx" ON "delivery_orders"("portId");

DO $$
BEGIN
  ALTER TABLE "delivery_orders"
    ADD CONSTRAINT "delivery_orders_portId_fkey"
    FOREIGN KEY ("portId") REFERENCES "Port"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Configurable B/L lifecycle labels (DEC-059/060/061). Seed rows are written by the seed
--    (add-only, labels default to the code); the migration only creates the table.
CREATE TABLE IF NOT EXISTS "bl_lifecycle_labels" (
    "code" "BlStatus" NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bl_lifecycle_labels_pkey" PRIMARY KEY ("code")
);
