-- Phase 11 / DEC-047: append-only audit rows, including TRUNCATE protection.
-- Existing rows are never copied, rewritten, or deleted. In addition to this
-- defense in depth, deploy with a non-owner, non-superuser runtime role whose
-- UPDATE/DELETE/TRUNCATE privileges are revoked (see
-- docs/duna-analysis/09-audit/phase11-security-audit-2026-10-16.md).
CREATE FUNCTION public.phase11_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: UPDATE, DELETE and TRUNCATE are prohibited'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER phase11_audit_no_update_delete
  BEFORE UPDATE OR DELETE ON public."AuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.phase11_reject_audit_mutation();
CREATE TRIGGER phase11_audit_no_truncate
  BEFORE TRUNCATE ON public."AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION public.phase11_reject_audit_mutation();
ALTER TABLE public."AuditLog" ENABLE ALWAYS TRIGGER phase11_audit_no_update_delete;
ALTER TABLE public."AuditLog" ENABLE ALWAYS TRIGGER phase11_audit_no_truncate;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public."AuditLog" FROM PUBLIC;
COMMENT ON TABLE public."AuditLog" IS 'Phase 11: immutable audit history. Runtime role may SELECT/INSERT only; never UPDATE, DELETE or TRUNCATE.';
