-- Phase 10: staged master-data read switch, archival and durable notifications.
-- Run the read-only Phase 10 preflight on the TARGET database before deploy.
-- Do not interpret any undocumented port code, customer role or load-list state.
-- PostgreSQL executes a Prisma migration in its own transaction only when
-- explicitly enclosed; an exception here rolls back ALL copies and drops.
BEGIN;

-- Port names are administrator managed. No bulk updates to existing Port rows.
ALTER TABLE "Port" ADD COLUMN "displayName" TEXT;
CREATE TABLE "PortAlias" (
    "id" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PortAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortAlias_key_key" ON "PortAlias"("key");
CREATE INDEX "PortAlias_portId_idx" ON "PortAlias"("portId");
ALTER TABLE "PortAlias" ADD CONSTRAINT "PortAlias_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the four prohibited Customer values in a restricted legacy archive.
-- A commercial-role type is NOT a natural/legal person classification.
CREATE TYPE "CustomerPersonKind" AS ENUM ('NATURAL', 'LEGAL');
ALTER TABLE "Customer" ADD COLUMN "personKind" "CustomerPersonKind";
CREATE TABLE "CustomerLegacyAttribute" (
    "customerId" TEXT NOT NULL,
    "legacyType" TEXT,
    "shortName" TEXT,
    "taxId" TEXT,
    "currency" TEXT,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerLegacyAttribute_pkey" PRIMARY KEY ("customerId")
);
ALTER TABLE "CustomerLegacyAttribute" ADD CONSTRAINT "CustomerLegacyAttribute_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "CustomerLegacyAttribute" ("customerId", "legacyType", "shortName", "taxId", "currency")
SELECT "id", "type", "shortName", "taxId", "currency" FROM "Customer"
WHERE "type" IS NOT NULL OR "shortName" IS NOT NULL OR "taxId" IS NOT NULL OR "currency" IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Customer" c LEFT JOIN "CustomerLegacyAttribute" a ON a."customerId" = c."id"
    WHERE (c."type" IS NOT NULL OR c."shortName" IS NOT NULL OR c."taxId" IS NOT NULL OR c."currency" IS NOT NULL)
      AND (a."customerId" IS NULL OR a."legacyType" IS DISTINCT FROM c."type"
           OR a."shortName" IS DISTINCT FROM c."shortName" OR a."taxId" IS DISTINCT FROM c."taxId"
           OR a."currency" IS DISTINCT FROM c."currency")
  ) THEN RAISE EXCEPTION 'Customer archive comparison failed; no legacy columns were dropped'; END IF;
END $$;
DROP INDEX IF EXISTS "Customer_type_idx";
ALTER TABLE "Customer" DROP COLUMN "type", DROP COLUMN "shortName", DROP COLUMN "taxId", DROP COLUMN "currency";
CREATE INDEX "Customer_personKind_idx" ON "Customer"("personKind");

-- Canonical Cargo fields were already used by the web and downstream documents.
-- Archive *every* non-null legacy value before backfilling missing canonical
-- values. Both sides of conflicting non-null pairs remain available (archive
-- and canonical) for manual reconciliation; never choose one by guesswork.
CREATE TABLE "CargoLegacyAttribute" (
    "cargoId" TEXT NOT NULL,
    "chassis" TEXT,
    "serial" TEXT,
    "comment" TEXT,
    "units" INTEGER,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoLegacyAttribute_pkey" PRIMARY KEY ("cargoId")
);
ALTER TABLE "CargoLegacyAttribute" ADD CONSTRAINT "CargoLegacyAttribute_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
INSERT INTO "CargoLegacyAttribute" ("cargoId", "chassis", "serial", "comment", "units")
SELECT "id", "chassis", "serial", "comment", "units" FROM "Cargo"
WHERE "chassis" IS NOT NULL OR "serial" IS NOT NULL OR "comment" IS NOT NULL OR "units" IS NOT NULL;
UPDATE "Cargo" SET
  "chassisNumber" = COALESCE(NULLIF(BTRIM("chassisNumber"), ''), NULLIF(BTRIM("chassis"), '')),
  "serialNumber"  = COALESCE(NULLIF(BTRIM("serialNumber"), ''), NULLIF(BTRIM("serial"), '')),
  "comments"      = COALESCE(NULLIF(BTRIM("comments"), ''), NULLIF(BTRIM("comment"), '')),
  "quantity"      = COALESCE("quantity", CASE WHEN "units" > 0 THEN "units" ELSE NULL END)
WHERE "chassis" IS NOT NULL OR "serial" IS NOT NULL OR "comment" IS NOT NULL OR "units" IS NOT NULL;
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "Cargo" c LEFT JOIN "CargoLegacyAttribute" a ON a."cargoId" = c."id"
    WHERE (c."chassis" IS NOT NULL OR c."serial" IS NOT NULL OR c."comment" IS NOT NULL OR c."units" IS NOT NULL)
      AND (a."cargoId" IS NULL OR a."chassis" IS DISTINCT FROM c."chassis"
           OR a."serial" IS DISTINCT FROM c."serial" OR a."comment" IS DISTINCT FROM c."comment" OR a."units" IS DISTINCT FROM c."units")
  ) THEN RAISE EXCEPTION 'Cargo archive comparison failed; no legacy columns were dropped'; END IF;
END $$;
-- Old columns intentionally remain in the table through the read-switch release.
-- API/Prisma stop writing/reading them. A separately gated contract script
-- checks row-by-row equivalence again before physical removal (after acceptance).
CREATE TYPE "CargoDocumentStatus" AS ENUM ('EXID', 'BCC', 'LOCAL_TRANSFER');
ALTER TABLE "Cargo" ADD COLUMN "documentStatus" "CargoDocumentStatus";
CREATE TABLE "CargoIntakeDocument" (
    "id" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "reference" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CargoIntakeDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CargoIntakeDocument_cargoId_idx" ON "CargoIntakeDocument"("cargoId");
ALTER TABLE "CargoIntakeDocument" ADD CONSTRAINT "CargoIntakeDocument_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- IMO already was optional. Fleet ownership and per-voyage chartering are
-- independent, nullable classifications for historical rows.
CREATE TYPE "VesselOwnership" AS ENUM ('OWNED', 'VOYAGE_CHARTER', 'TIME_CHARTER', 'OTHER');
ALTER TABLE "Vessel" ADD COLUMN "ownership" "VesselOwnership";
ALTER TABLE "Voyage" ADD COLUMN "vesselUse" "VesselOwnership";

-- ADR-041: leave LoadListStatus (all SIX original values) and every
-- historical LoadList row untouched. Application transitions now write only
-- DRAFT / FINALIZED / CANCELLED; contraction requires owner-verified mapping.
-- ActualLoadingStatus is a separate lifecycle and remains unchanged.

CREATE TYPE "NotificationTrigger" AS ENUM ('OVERDUE_INVOICE', 'PENDING_APPROVAL', 'JOB_STATUS_CHANGED', 'UNPAID_RELEASE', 'CARGO_DOCUMENT_PENDING');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'SUPPRESSED');
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "trigger" "NotificationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "recipients" JSONB NOT NULL,
    "channels" JSONB NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "repeatMinutes" INTEGER,
    "maxPerRecord" INTEGER NOT NULL DEFAULT 1,
    "maxPerDay" INTEGER,
    "escalateAfterMinutes" INTEGER,
    "escalationRecipients" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NotificationRule_limits_check" CHECK (
      "delayMinutes" >= 0 AND "maxPerRecord" > 0 AND
      ("repeatMinutes" IS NULL OR "repeatMinutes" > 0) AND
      ("maxPerDay" IS NULL OR "maxPerDay" > 0) AND
      ("escalateAfterMinutes" IS NULL OR "escalateAfterMinutes" > 0))
);
CREATE INDEX "NotificationRule_trigger_isActive_idx" ON "NotificationRule"("trigger", "isActive");
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "baseAt" TIMESTAMP(3) NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "cycle" INTEGER NOT NULL DEFAULT 0,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationEvent_ruleId_eventKey_key" ON "NotificationEvent"("ruleId", "eventKey");
CREATE INDEX "NotificationEvent_status_nextRunAt_idx" ON "NotificationEvent"("status", "nextRunAt");
CREATE INDEX "NotificationEvent_ruleId_sourceId_idx" ON "NotificationEvent"("ruleId", "sourceId");
ALTER TABLE "NotificationEvent" ADD CONSTRAINT "NotificationEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "NotificationInbox" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "cycle" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationInbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationInbox_eventId_userId_stage_cycle_key" ON "NotificationInbox"("eventId", "userId", "stage", "cycle");
CREATE INDEX "NotificationInbox_userId_createdAt_idx" ON "NotificationInbox"("userId", "createdAt");
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "NotificationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotificationInbox" ADD CONSTRAINT "NotificationInbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "inboxId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationDelivery_inboxId_channel_key" ON "NotificationDelivery"("inboxId", "channel");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status", "nextAttemptAt");
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "NotificationInbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
