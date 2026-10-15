-- Phase 9: additive configuration. No existing records, statuses, numbers,
-- permissions or historical document output are rewritten.
CREATE TABLE "ConfigOptionList" (
    "id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true, "createdById" TEXT NOT NULL,
    "updatedById" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigOptionList_code_key" ON "ConfigOptionList"("code");

CREATE TABLE "ConfigOption" (
    "id" TEXT NOT NULL PRIMARY KEY, "listId" TEXT NOT NULL, "code" TEXT NOT NULL,
    "label" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigOption_listId_code_key" ON "ConfigOption"("listId", "code");
CREATE INDEX "ConfigOption_listId_isActive_idx" ON "ConfigOption"("listId", "isActive");
ALTER TABLE "ConfigOption" ADD CONSTRAINT "ConfigOption_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ConfigOptionList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigField" (
    "id" TEXT NOT NULL PRIMARY KEY, "scope" TEXT NOT NULL, "key" TEXT NOT NULL,
    "label" TEXT NOT NULL, "kind" TEXT NOT NULL, "required" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB NOT NULL DEFAULT '{}', "optionListId" TEXT,
    "displayLocation" TEXT NOT NULL DEFAULT 'detail', "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibility" JSONB NOT NULL DEFAULT '{}', "viewPermission" TEXT, "editPermission" TEXT,
    "searchable" BOOLEAN NOT NULL DEFAULT false, "filterable" BOOLEAN NOT NULL DEFAULT false,
    "reportable" BOOLEAN NOT NULL DEFAULT false, "exportable" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigField_scope_key_key" ON "ConfigField"("scope", "key");
CREATE INDEX "ConfigField_scope_isActive_sortOrder_idx" ON "ConfigField"("scope", "isActive", "sortOrder");
CREATE INDEX "ConfigField_optionListId_idx" ON "ConfigField"("optionListId");
ALTER TABLE "ConfigField" ADD CONSTRAINT "ConfigField_optionListId_fkey"
    FOREIGN KEY ("optionListId") REFERENCES "ConfigOptionList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldRevision" (
    "id" TEXT NOT NULL PRIMARY KEY, "fieldId" TEXT NOT NULL,
    "version" INTEGER NOT NULL, "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigFieldRevision_fieldId_version_key" ON "ConfigFieldRevision"("fieldId", "version");
ALTER TABLE "ConfigFieldRevision" ADD CONSTRAINT "ConfigFieldRevision_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "ConfigField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY, "fieldId" TEXT NOT NULL, "scope" TEXT NOT NULL,
    "recordId" TEXT NOT NULL, "value" JSONB NOT NULL, "searchText" TEXT,
    "fieldSnapshot" JSONB NOT NULL, "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigFieldValue_fieldId_recordId_key" ON "ConfigFieldValue"("fieldId", "recordId");
CREATE INDEX "ConfigFieldValue_scope_recordId_idx" ON "ConfigFieldValue"("scope", "recordId");
CREATE INDEX "ConfigFieldValue_fieldId_searchText_idx" ON "ConfigFieldValue"("fieldId", "searchText");
ALTER TABLE "ConfigFieldValue" ADD CONSTRAINT "ConfigFieldValue_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "ConfigField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigFieldValueRevision" (
    "id" TEXT NOT NULL PRIMARY KEY, "valueId" TEXT NOT NULL,
    "value" JSONB NOT NULL, "snapshot" JSONB NOT NULL,
    "actorId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ConfigFieldValueRevision_valueId_createdAt_idx" ON "ConfigFieldValueRevision"("valueId", "createdAt");
ALTER TABLE "ConfigFieldValueRevision" ADD CONSTRAINT "ConfigFieldValueRevision_valueId_fkey"
    FOREIGN KEY ("valueId") REFERENCES "ConfigFieldValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocumentType" (
    "id" TEXT NOT NULL PRIMARY KEY, "code" TEXT NOT NULL, "isCore" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT false, "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigDocumentType_code_key" ON "ConfigDocumentType"("code");
CREATE INDEX "ConfigDocumentType_isActive_idx" ON "ConfigDocumentType"("isActive");

CREATE TABLE "ConfigDocumentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY, "typeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL, "definition" JSONB NOT NULL,
    "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigDocumentVersion_typeId_version_key" ON "ConfigDocumentVersion"("typeId", "version");
ALTER TABLE "ConfigDocumentVersion" ADD CONSTRAINT "ConfigDocumentVersion_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "ConfigDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY, "scope" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false,
    "currentVersionId" TEXT, "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigWorkflow_scope_key" ON "ConfigWorkflow"("scope");

CREATE TABLE "ConfigWorkflowVersion" (
    "id" TEXT NOT NULL PRIMARY KEY, "workflowId" TEXT NOT NULL, "version" INTEGER NOT NULL,
    "definition" JSONB NOT NULL, "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConfigWorkflowVersion_workflowId_version_key" ON "ConfigWorkflowVersion"("workflowId", "version");
ALTER TABLE "ConfigWorkflowVersion" ADD CONSTRAINT "ConfigWorkflowVersion_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "ConfigWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocument" (
    "id" TEXT NOT NULL PRIMARY KEY, "typeId" TEXT NOT NULL, "versionId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL, "number" TEXT NOT NULL, "status" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}', "links" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1, "issuedAt" TIMESTAMP(3), "issueSnapshot" JSONB,
    "createdById" TEXT NOT NULL, "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ConfigDocument_typeId_number_key" ON "ConfigDocument"("typeId", "number");
CREATE INDEX "ConfigDocument_typeId_status_idx" ON "ConfigDocument"("typeId", "status");
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_typeId_fkey"
    FOREIGN KEY ("typeId") REFERENCES "ConfigDocumentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "ConfigDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_workflowVersionId_fkey"
    FOREIGN KEY ("workflowVersionId") REFERENCES "ConfigWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigDocumentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL, "kind" TEXT NOT NULL,
    "beforeData" JSONB, "afterData" JSONB, "reason" TEXT, "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ConfigDocumentEvent_documentId_createdAt_idx" ON "ConfigDocumentEvent"("documentId", "createdAt");
ALTER TABLE "ConfigDocumentEvent" ADD CONSTRAINT "ConfigDocumentEvent_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "ConfigDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConfigApproval" (
    "id" TEXT NOT NULL PRIMARY KEY, "workflowVersionId" TEXT NOT NULL,
    "scope" TEXT NOT NULL, "recordId" TEXT NOT NULL, "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL, "context" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING', "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedById" TEXT, "decidedAt" TIMESTAMP(3), "decisionNote" TEXT,
    "consumedAt" TIMESTAMP(3),
    CONSTRAINT "ConfigApproval_status_check" CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CONSUMED','EXPIRED'))
);
CREATE INDEX "ConfigApproval_scope_recordId_status_idx" ON "ConfigApproval"("scope", "recordId", "status");
CREATE INDEX "ConfigApproval_requestedById_status_idx" ON "ConfigApproval"("requestedById", "status");
-- Exactly one live approval per edge/record even under concurrent requests.
CREATE UNIQUE INDEX "ConfigApproval_one_open_request" ON "ConfigApproval"("scope", "recordId", "fromStatus", "toStatus")
    WHERE "status" IN ('PENDING', 'APPROVED') AND "consumedAt" IS NULL;
ALTER TABLE "ConfigApproval" ADD CONSTRAINT "ConfigApproval_workflowVersionId_fkey"
    FOREIGN KEY ("workflowVersionId") REFERENCES "ConfigWorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve immutable configuration versions, value revisions, and document
-- transition events even if an application writer accidentally calls UPDATE.
CREATE FUNCTION phase9_reject_history_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Phase 9 configuration history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_field_revision_immutable BEFORE UPDATE OR DELETE ON "ConfigFieldRevision"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_value_revision_immutable BEFORE UPDATE OR DELETE ON "ConfigFieldValueRevision"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_type_version_immutable BEFORE UPDATE OR DELETE ON "ConfigDocumentVersion"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_workflow_version_immutable BEFORE UPDATE OR DELETE ON "ConfigWorkflowVersion"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();
CREATE TRIGGER phase9_document_event_immutable BEFORE UPDATE OR DELETE ON "ConfigDocumentEvent"
    FOR EACH ROW EXECUTE FUNCTION phase9_reject_history_change();

CREATE FUNCTION phase9_document_frozen() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured documents are retained; deletion is forbidden'; END IF;
    IF OLD."issuedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Issued configured documents are immutable';
    END IF;
    IF NEW."issuedAt" IS NOT NULL AND NEW."issueSnapshot" IS NULL THEN
        RAISE EXCEPTION 'Issuance requires a frozen output snapshot';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_document_frozen BEFORE UPDATE OR DELETE ON "ConfigDocument"
    FOR EACH ROW EXECUTE FUNCTION phase9_document_frozen();
ALTER TABLE "ConfigDocument" ADD CONSTRAINT "ConfigDocument_issueSnapshot_check"
    CHECK (("issuedAt" IS NULL AND "issueSnapshot" IS NULL)
        OR ("issuedAt" IS NOT NULL AND "issueSnapshot" IS NOT NULL));

CREATE FUNCTION phase9_definition_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured definitions may only be deactivated'; END IF;
    IF TG_TABLE_NAME = 'ConfigOptionList' THEN
        IF OLD."code" <> NEW."code" THEN
            RAISE EXCEPTION 'Option list code is immutable';
        END IF;
    ELSIF TG_TABLE_NAME = 'ConfigDocumentType' THEN
        IF OLD."code" <> NEW."code" OR OLD."isCore" <> NEW."isCore" THEN
            RAISE EXCEPTION 'Document type identity is immutable';
        END IF;
    ELSIF TG_TABLE_NAME = 'ConfigWorkflow' THEN
        IF OLD."scope" <> NEW."scope" THEN
            RAISE EXCEPTION 'Workflow scope is immutable';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_option_list_identity BEFORE UPDATE OR DELETE ON "ConfigOptionList"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();
CREATE TRIGGER phase9_document_type_identity BEFORE UPDATE OR DELETE ON "ConfigDocumentType"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();
CREATE TRIGGER phase9_workflow_identity BEFORE UPDATE OR DELETE ON "ConfigWorkflow"
    FOR EACH ROW EXECUTE FUNCTION phase9_definition_identity();

CREATE FUNCTION phase9_option_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Configured options may only be deactivated'; END IF;
    IF OLD."code" <> NEW."code" OR OLD."listId" <> NEW."listId" THEN
        RAISE EXCEPTION 'Option code and list are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_option_identity BEFORE UPDATE OR DELETE ON "ConfigOption"
    FOR EACH ROW EXECUTE FUNCTION phase9_option_identity();

CREATE FUNCTION phase9_field_identity() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Custom fields may only be deactivated'; END IF;
    IF OLD."scope" <> NEW."scope" OR OLD."key" <> NEW."key" OR
        OLD."kind" <> NEW."kind" OR OLD."optionListId" IS DISTINCT FROM NEW."optionListId" THEN
        RAISE EXCEPTION 'Field identity, type and option list are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_field_identity BEFORE UPDATE OR DELETE ON "ConfigField"
    FOR EACH ROW EXECUTE FUNCTION phase9_field_identity();

CREATE FUNCTION phase9_approval_final() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Approval history is retained'; END IF;
    IF OLD."status" IN ('REJECTED','CONSUMED','EXPIRED') OR
       OLD."status" = 'APPROVED' AND NEW."status" NOT IN ('CONSUMED','EXPIRED') OR
       OLD."status" = 'PENDING' AND NEW."status" NOT IN ('APPROVED','REJECTED','EXPIRED') OR
       OLD."scope" <> NEW."scope" OR OLD."recordId" <> NEW."recordId" OR
       OLD."fromStatus" <> NEW."fromStatus" OR OLD."toStatus" <> NEW."toStatus" OR
       OLD."context" IS DISTINCT FROM NEW."context" OR
       OLD."requestedById" <> NEW."requestedById" OR OLD."workflowVersionId" <> NEW."workflowVersionId" OR
       OLD."status" = 'APPROVED' AND (OLD."decidedById" IS DISTINCT FROM NEW."decidedById" OR
           OLD."decidedAt" IS DISTINCT FROM NEW."decidedAt" OR
           OLD."decisionNote" IS DISTINCT FROM NEW."decisionNote") THEN
        RAISE EXCEPTION 'Approval decision and identity cannot be rewritten';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_approval_final BEFORE UPDATE OR DELETE ON "ConfigApproval"
    FOR EACH ROW EXECUTE FUNCTION phase9_approval_final();

-- Phase-8 core archive rows stay untouched; NEW configurable-document bytes
-- cannot be rewritten by SQL even if an application bug bypasses service checks.
CREATE FUNCTION phase9_output_frozen() RETURNS trigger AS $$
BEGIN
    IF OLD."documentType" LIKE 'CUSTOM:%' THEN
        RAISE EXCEPTION 'Issued configurable output is immutable';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER phase9_output_frozen BEFORE UPDATE OR DELETE ON "DocumentRenderedOutput"
    FOR EACH ROW EXECUTE FUNCTION phase9_output_frozen();
