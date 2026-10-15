-- Phase 8: additive output infrastructure. No existing rows are rewritten,
-- deleted, or marked as migrated. Inspect migration status on the target before applying.
ALTER TABLE "DocumentTemplateVersion" ADD COLUMN "contentHash" TEXT;

CREATE TABLE "DocumentTemplateAssignment" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "templateId" TEXT,
    "versionId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT NOT NULL,
    CONSTRAINT "DocumentTemplateAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentTemplateAssignment_documentType_assignedAt_idx" ON "DocumentTemplateAssignment"("documentType", "assignedAt");
ALTER TABLE "DocumentTemplateAssignment" ADD CONSTRAINT "DocumentTemplateAssignment_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentTemplateAssignment" ADD CONSTRAINT "DocumentTemplateAssignment_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentAsset" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentAsset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentAsset_storageKey_key" ON "DocumentAsset"("storageKey");
CREATE INDEX "DocumentAsset_kind_isApproved_idx" ON "DocumentAsset"("kind", "isApproved");

CREATE TABLE "DocumentIssuedSnapshot" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "identity" JSONB NOT NULL,
    "fallbackLayout" JSONB NOT NULL,
    "templateVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentIssuedSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentIssuedSnapshot_documentType_recordId_key"
    ON "DocumentIssuedSnapshot"("documentType", "recordId");
CREATE INDEX "DocumentIssuedSnapshot_templateVersionId_idx" ON "DocumentIssuedSnapshot"("templateVersionId");
ALTER TABLE "DocumentIssuedSnapshot" ADD CONSTRAINT "DocumentIssuedSnapshot_templateVersionId_fkey"
    FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DocumentRenderedOutput" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "revisionKey" TEXT NOT NULL,
    "templateVersionId" TEXT,
    "content" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DocumentRenderedOutput_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DocumentRenderedOutput_documentType_recordId_format_revisionKey_key"
    ON "DocumentRenderedOutput"("documentType", "recordId", "format", "revisionKey");
CREATE INDEX "DocumentRenderedOutput_templateVersionId_idx" ON "DocumentRenderedOutput"("templateVersionId");
ALTER TABLE "DocumentRenderedOutput" ADD CONSTRAINT "DocumentRenderedOutput_templateVersionId_fkey"
    FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
