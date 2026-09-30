-- Phase 2 follow-up: migration-replay completeness.
--
-- Discovered while closing the reported `agent_destinations` gap: a fresh replay
-- of prisma/migrations does NOT reproduce prisma/schema.prisma. Verified with
--   npx prisma migrate diff --from-migrations prisma/migrations \
--       --to-schema-datamodel prisma/schema.prisma --shadow-database-url <shadow>
-- which reported 6 missing tables, 4 enum mismatches, 9 Cargo columns, 1
-- LoadListItem column, wrong constraint/index names and 2 FK definitions.
--
-- Everything below is guarded so that:
--   * on this live DB  -> the file is a near no-op (rows/indexes already match)
--   * on a fresh replay-> the resulting schema matches schema.prisma
-- No row data is written; enum rebuilds only run when the label set differs.

-- =========================================================================
-- 1) Enums
-- =========================================================================

-- 1a) LoadListItemSelectionStatus: absent from every migration file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoadListItemSelectionStatus') THEN
    EXECUTE $q$CREATE TYPE "LoadListItemSelectionStatus" AS ENUM ('NOT_SELECTED', 'SELECTED', 'LOADED', 'NOT_LOADED')$q$;
  END IF;
END $$;

-- 1b) LoadListStatus: migrations create ('DRAFT','FINALIZED','CANCELLED') only.
DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['IN_PROGRESS', 'PARTIALLY_LOADED', 'COMPLETED'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'LoadListStatus' AND e.enumlabel = v
    ) THEN
      EXECUTE format('ALTER TYPE "LoadListStatus" ADD VALUE %L', v);
    END IF;
  END LOOP;
END $$;

-- 1c) ActualLoadingStatus: replay has (NOT_STARTED,IN_PROGRESS,COMPLETED,CANCELLED);
--     schema wants (DRAFT,IN_PROGRESS,PARTIALLY_LOADED,COMPLETED,FINALIZED,CANCELLED).
--     Rebuild only when the label set actually differs (no-op on live).
DO $$
DECLARE
  want text[] := ARRAY['DRAFT','IN_PROGRESS','PARTIALLY_LOADED','COMPLETED','FINALIZED','CANCELLED'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'ActualLoadingStatus';
  IF have IS DISTINCT FROM want THEN
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "ActualLoadingStatus_new" AS ENUM ('DRAFT','IN_PROGRESS','PARTIALLY_LOADED','COMPLETED','FINALIZED','CANCELLED')$q$;
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" TYPE "ActualLoadingStatus_new" USING ("status"::text::"ActualLoadingStatus_new")';
    EXECUTE 'ALTER TYPE "ActualLoadingStatus" RENAME TO "ActualLoadingStatus_old"';
    EXECUTE 'ALTER TYPE "ActualLoadingStatus_new" RENAME TO "ActualLoadingStatus"';
    EXECUTE 'DROP TYPE "ActualLoadingStatus_old"';
    EXECUTE 'ALTER TABLE "ActualLoading" ALTER COLUMN "status" SET DEFAULT ''DRAFT''';
  END IF;
END $$;

-- 1d) CargoStatus: replay has READY, schema wants READY_FOR_LOADING.
DO $$
DECLARE
  want text[] := ARRAY['REGISTERED','AT_YARD','READY_FOR_LOADING','LOADED','DELIVERED','CANCELLED'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'CargoStatus';
  IF have IS DISTINCT FROM want THEN
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "CargoStatus_new" AS ENUM ('REGISTERED','AT_YARD','READY_FOR_LOADING','LOADED','DELIVERED','CANCELLED')$q$;
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" TYPE "CargoStatus_new" USING ("status"::text::"CargoStatus_new")';
    EXECUTE 'ALTER TYPE "CargoStatus" RENAME TO "CargoStatus_old"';
    EXECUTE 'ALTER TYPE "CargoStatus_new" RENAME TO "CargoStatus"';
    EXECUTE 'DROP TYPE "CargoStatus_old"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "status" SET DEFAULT ''REGISTERED''';
  END IF;
END $$;

-- 1e) InspectionStatus: replay has (PENDING,APPROVED,REJECTED),
--     schema wants (PENDING,BOOKED,DONE,FAILED,NEEDS_REINSPECTION).
--     Two columns depend on it: Cargo.inspectionStatus and Inspection.status.
DO $$
DECLARE
  want text[] := ARRAY['PENDING','BOOKED','DONE','FAILED','NEEDS_REINSPECTION'];
  have text[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO have
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
   WHERE t.typname = 'InspectionStatus';
  IF have IS DISTINCT FROM want THEN
    -- Dependent expression: the partial unique index
    -- Inspection_one_pending_per_cargo_idx has predicate
    -- `status = 'PENDING'::"InspectionStatus"`. Postgres must rewrite that
    -- predicate during the type swap and cannot compare the old enum to the
    -- new one, so drop it first and rebuild it afterwards (42883 otherwise).
    EXECUTE 'DROP INDEX IF EXISTS "Inspection_one_pending_per_cargo_idx"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" DROP DEFAULT';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" DROP DEFAULT';
    EXECUTE $q$CREATE TYPE "InspectionStatus_new" AS ENUM ('PENDING','BOOKED','DONE','FAILED','NEEDS_REINSPECTION')$q$;
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" TYPE "InspectionStatus_new" USING ("inspectionStatus"::text::"InspectionStatus_new")';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" TYPE "InspectionStatus_new" USING ("status"::text::"InspectionStatus_new")';
    EXECUTE 'ALTER TYPE "InspectionStatus" RENAME TO "InspectionStatus_old"';
    EXECUTE 'ALTER TYPE "InspectionStatus_new" RENAME TO "InspectionStatus"';
    EXECUTE 'DROP TYPE "InspectionStatus_old"';
    EXECUTE 'ALTER TABLE "Cargo" ALTER COLUMN "inspectionStatus" SET DEFAULT ''PENDING''';
    EXECUTE 'ALTER TABLE "Inspection" ALTER COLUMN "status" SET DEFAULT ''PENDING''';
    EXECUTE $q$CREATE UNIQUE INDEX "Inspection_one_pending_per_cargo_idx" ON "Inspection"("cargoId") WHERE (status = 'PENDING'::"InspectionStatus")$q$;
  END IF;
END $$;

-- =========================================================================
-- 2) Columns present in schema.prisma but created by no migration
-- =========================================================================
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "cargoValue" DECIMAL(18,2);
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "cargoValueCurrency" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "chassis" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "comment" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "jobId" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "pod" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "pol" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "serial" TEXT;
ALTER TABLE "Cargo" ADD COLUMN IF NOT EXISTS "units" INTEGER;

ALTER TABLE "LoadListItem"
  ADD COLUMN IF NOT EXISTS "selectionStatus" "LoadListItemSelectionStatus" NOT NULL DEFAULT 'NOT_SELECTED';

-- ActualLoading.status default (schema: @default(DRAFT); safe/idempotent)
ALTER TABLE "ActualLoading" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- =========================================================================
-- 3) Tables declared by schema.prisma but created by no migration
--    (DDL copied verbatim from `prisma migrate diff --from-migrations`)
-- =========================================================================
CREATE TABLE IF NOT EXISTS "agent_destinations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "portId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agent_destinations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NumberingSequence" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeValue" TEXT,
    "prefix" TEXT NOT NULL DEFAULT '',
    "padding" INTEGER NOT NULL DEFAULT 5,
    "format" TEXT NOT NULL DEFAULT '{prefix}{sequence}',
    "nextSequence" INTEGER NOT NULL DEFAULT 1,
    "period" TEXT NOT NULL DEFAULT 'YYYY',
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FileAttachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "contentType" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageAdapter" TEXT NOT NULL DEFAULT 'local',
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- =========================================================================
-- 4) Indexes for those tables
-- =========================================================================
CREATE INDEX IF NOT EXISTS "agent_destinations_agentId_idx" ON "agent_destinations"("agentId");
CREATE INDEX IF NOT EXISTS "agent_destinations_portId_idx" ON "agent_destinations"("portId");
CREATE INDEX IF NOT EXISTS "agent_destinations_isActive_idx" ON "agent_destinations"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_destinations_agentId_portId_key" ON "agent_destinations"("agentId", "portId");

CREATE UNIQUE INDEX IF NOT EXISTS "NumberingSequence_name_key" ON "NumberingSequence"("name");
CREATE INDEX IF NOT EXISTS "NumberingSequence_documentType_scopeType_scopeValue_isActiv_idx" ON "NumberingSequence"("documentType", "scopeType", "scopeValue", "isActive");
CREATE INDEX IF NOT EXISTS "NumberingSequence_isActive_idx" ON "NumberingSequence"("isActive");

CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_timestamp_idx" ON "AuditLog"("entityType", "entityId", "timestamp");

CREATE INDEX IF NOT EXISTS "FileAttachment_entityType_entityId_idx" ON "FileAttachment"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "FileAttachment_category_idx" ON "FileAttachment"("category");
CREATE INDEX IF NOT EXISTS "FileAttachment_uploadedById_idx" ON "FileAttachment"("uploadedById");
CREATE INDEX IF NOT EXISTS "FileAttachment_storageAdapter_storageKey_idx" ON "FileAttachment"("storageAdapter", "storageKey");
CREATE INDEX IF NOT EXISTS "FileAttachment_deletedAt_idx" ON "FileAttachment"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_name_key" ON "DocumentTemplate"("name");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_documentType_idx" ON "DocumentTemplate"("documentType");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_documentType_isActive_idx" ON "DocumentTemplate"("documentType", "isActive");

CREATE INDEX IF NOT EXISTS "DocumentTemplateVersion_templateId_idx" ON "DocumentTemplateVersion"("templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");

-- =========================================================================
-- 5) Foreign keys
-- =========================================================================

-- agent_destinations: live carries the legacy name AgentDestination_*_fkey and
-- omits ON UPDATE CASCADE; drop the legacy one, ensure the canonical one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentDestination_agentId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" DROP CONSTRAINT "AgentDestination_agentId_fkey"';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_destinations_agentId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" ADD CONSTRAINT "agent_destinations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentDestination_portId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" DROP CONSTRAINT "AgentDestination_portId_fkey"';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_destinations_portId_fkey') THEN
    EXECUTE 'ALTER TABLE "agent_destinations" ADD CONSTRAINT "agent_destinations_portId_fkey" FOREIGN KEY ("portId") REFERENCES "Port"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- DocumentTemplateVersion -> DocumentTemplate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentTemplateVersion_templateId_fkey') THEN
    EXECUTE 'ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- Cargo party FKs: schema wants ON UPDATE CASCADE; the cutover migration copied
-- the pre-existing live definition (ON DELETE SET NULL only). Repair in place,
-- and only when the definition is actually wrong.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_shipperId_fkey') THEN
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Cargo_shipperId_fkey' AND pg_get_constraintdef(oid) LIKE '%ON UPDATE CASCADE%'
  ) THEN
    EXECUTE 'ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_shipperId_fkey"';
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_shipperId_fkey" FOREIGN KEY ("shipperId") REFERENCES "shippers"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Cargo_consigneeId_fkey') THEN
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  ELSIF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'Cargo_consigneeId_fkey' AND pg_get_constraintdef(oid) LIKE '%ON UPDATE CASCADE%'
  ) THEN
    EXECUTE 'ALTER TABLE "Cargo" DROP CONSTRAINT "Cargo_consigneeId_fkey"';
    EXECUTE 'ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_consigneeId_fkey" FOREIGN KEY ("consigneeId") REFERENCES "consignees"("id") ON DELETE SET NULL ON UPDATE CASCADE';
  END IF;
END $$;

-- =========================================================================
-- 6) Constraint/index naming: Prisma derives names from the MAPPED table name
--    (agents_pkey, shippers_code_idx), but the party-masters/agent-linkage
--    migrations wrote model-name-based names captured from live. Rename only
--    when the legacy name exists and the canonical one does not.
-- =========================================================================
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('agents',    'Agent_pkey',      'agents_pkey'),
      ('consignees','Consignee_pkey',  'consignees_pkey'),
      ('shippers',  'Shipper_pkey',    'shippers_pkey'),
      ('agent_destinations','AgentDestination_pkey','agent_destinations_pkey')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('"' || rec.tbl || '"') AND conname = rec.old_name)
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = to_regclass('"' || rec.tbl || '"') AND conname = rec.new_name) THEN
      EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', rec.tbl, rec.old_name, rec.new_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('agents',     'Agent_code_idx',        'agents_code_idx'),
      ('agents',     'Agent_code_key',        'agents_code_key'),
      ('agents',     'Agent_isActive_idx',    'agents_isActive_idx'),
      ('agents',     'Agent_name_idx',        'agents_name_idx'),
      ('consignees', 'Consignee_code_idx',    'consignees_code_idx'),
      ('consignees', 'Consignee_code_key',    'consignees_code_key'),
      ('consignees', 'Consignee_isActive_idx','consignees_isActive_idx'),
      ('consignees', 'Consignee_name_idx',    'consignees_name_idx'),
      ('shippers',   'Shipper_code_idx',      'shippers_code_idx'),
      ('shippers',   'Shipper_code_key',      'shippers_code_key'),
      ('shippers',   'Shipper_isActive_idx',  'shippers_isActive_idx'),
      ('shippers',   'Shipper_name_idx',      'shippers_name_idx'),
      ('agent_destinations','AgentDestination_agentId_idx',        'agent_destinations_agentId_idx'),
      ('agent_destinations','AgentDestination_portId_idx',         'agent_destinations_portId_idx'),
      ('agent_destinations','AgentDestination_isActive_idx',       'agent_destinations_isActive_idx'),
      ('agent_destinations','AgentDestination_agentId_portId_key', 'agent_destinations_agentId_portId_key')
    ) AS t(tbl, old_name, new_name)
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = rec.old_name AND n.nspname = current_schema())
       AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE c.relname = rec.new_name AND n.nspname = current_schema()) THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', rec.old_name, rec.new_name);
    END IF;
  END LOOP;
END $$;
