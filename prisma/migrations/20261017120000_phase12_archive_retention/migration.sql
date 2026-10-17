-- Phase 12: additive policy vocabulary. No period, archive criterion, data
-- rewrite, deletion or backup schedule is inferred from this migration.
BEGIN;
ALTER TABLE public."letters" ADD COLUMN "archivedFromStatus" public."LetterStatus";
CREATE TABLE public."RetentionPolicy" (
  "scope" varchar(40) NOT NULL PRIMARY KEY,
  "minimumDays" integer,
  "archiveAfterDays" integer,
  "secureDeleteAfterDays" integer,
  "authority" varchar(500),
  "lawfulBasis" varchar(500),
  "updatedById" text NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RetentionPolicy_scope_check" CHECK ("scope" IN
    ('LETTER', 'IDENTITY_DOCUMENT', 'DOCUMENT_ASSET', 'DOCUMENT_TEMPLATE',
     'ISSUED_OUTPUT', 'FINANCE', 'AUDIT')),
  CONSTRAINT "RetentionPolicy_archive_check" CHECK
    ("archiveAfterDays" IS NULL OR ("scope" = 'LETTER' AND "archiveAfterDays" BETWEEN 1 AND 365000
      AND "authority" IS NOT NULL AND length(btrim("authority")) >= 10)),
  CONSTRAINT "RetentionPolicy_minimum_check" CHECK
    ("minimumDays" IS NULL OR ("minimumDays" BETWEEN 1 AND 365000
      AND "authority" IS NOT NULL AND length(btrim("authority")) >= 10)),
  CONSTRAINT "RetentionPolicy_identity_check" CHECK
    ("scope" <> 'IDENTITY_DOCUMENT' OR "minimumDays" IS NULL OR
      ("lawfulBasis" IS NOT NULL AND length(btrim("lawfulBasis")) >= 10)),
  CONSTRAINT "RetentionPolicy_purge_check" CHECK
    ("secureDeleteAfterDays" IS NULL OR
      ("minimumDays" IS NOT NULL AND "secureDeleteAfterDays" BETWEEN "minimumDays" AND 365000))
);

-- An administrator may increase a floor but cannot silently lower/remove one.
-- Changes needing a lower compliance floor require a separately reviewed DBA
-- migration. The configured secure-delete threshold never starts a purge job.
CREATE FUNCTION public.phase12_protect_retention_policy()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP IN ('DELETE', 'TRUNCATE') THEN
    RAISE EXCEPTION 'RetentionPolicy cannot be deleted or truncated'
      USING ERRCODE = '42501';
  END IF;
  IF NEW."scope" IS DISTINCT FROM OLD."scope" THEN
    RAISE EXCEPTION 'Retention scope cannot be reassigned' USING ERRCODE = '42501';
  END IF;
  IF OLD."minimumDays" IS NOT NULL AND
      (NEW."minimumDays" IS NULL OR NEW."minimumDays" < OLD."minimumDays") THEN
    RAISE EXCEPTION 'Retention minimum may not be reduced' USING ERRCODE = '42501';
  END IF;
  IF OLD."secureDeleteAfterDays" IS NOT NULL AND
      (NEW."secureDeleteAfterDays" IS NULL OR NEW."secureDeleteAfterDays" < OLD."secureDeleteAfterDays") THEN
    RAISE EXCEPTION 'Secure deletion threshold may not be reduced' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase12_retention_no_reduction
  BEFORE UPDATE OR DELETE ON public."RetentionPolicy"
  FOR EACH ROW EXECUTE FUNCTION public.phase12_protect_retention_policy();
CREATE TRIGGER phase12_retention_no_truncate
  BEFORE TRUNCATE ON public."RetentionPolicy"
  FOR EACH STATEMENT EXECUTE FUNCTION public.phase12_protect_retention_policy();
ALTER TABLE public."RetentionPolicy" ENABLE ALWAYS TRIGGER phase12_retention_no_reduction;
ALTER TABLE public."RetentionPolicy" ENABLE ALWAYS TRIGGER phase12_retention_no_truncate;
REVOKE ALL ON public."RetentionPolicy" FROM PUBLIC;
-- The existing Phase 11 non-owner runtime identity must be reverified before
-- deploy. A fresh development database without that role is still migratable;
-- the deployment postflight explicitly checks the reviewed runtime grants.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'shipping_runtime_p11') THEN
    GRANT SELECT, INSERT, UPDATE ON public."RetentionPolicy" TO shipping_runtime_p11;
    REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public."RetentionPolicy" FROM shipping_runtime_p11;
  END IF;
END;
$$;
COMMENT ON TABLE public."RetentionPolicy" IS
  'Phase 12 compliance-configured floors and archive criterion. No seeded periods or physical-delete authority.';

-- A letter reopened to DRAFT is not a new record. A later delete_draft
-- must not erase its archive/retention obligations, even if a caller skips
-- the service guard. The existing non-owner API role has no hard DELETE grant.
CREATE FUNCTION public.phase12_protect_archived_letter()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" AND NEW."deletedAt" IS NOT NULL AND
      (OLD."status" <> 'DRAFT' OR OLD."archivedFromStatus" IS NOT NULL OR EXISTS (
        SELECT 1 FROM public."AuditLog" a WHERE a."entityType" = 'Letter'
          AND a."entityId" = OLD."id" AND a."action" = 'letter.archive') OR EXISTS (
        SELECT 1 FROM public."RetentionPolicy" p WHERE p."scope" = 'LETTER'
          AND p."minimumDays" IS NOT NULL
          AND GREATEST(OLD."createdAt", OLD."letterDate") >
            (clock_timestamp() AT TIME ZONE 'UTC') - p."minimumDays" * INTERVAL '1 day')) THEN
    RAISE EXCEPTION 'Archived or issued letter cannot be deleted'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER phase12_letter_no_archive_delete_bypass
  BEFORE UPDATE OF "deletedAt" ON public."letters"
  FOR EACH ROW EXECUTE FUNCTION public.phase12_protect_archived_letter();
ALTER TABLE public."letters" ENABLE ALWAYS TRIGGER phase12_letter_no_archive_delete_bypass;
COMMIT;
