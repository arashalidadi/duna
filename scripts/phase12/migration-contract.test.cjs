'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const sql = fs.readFileSync(path.join(ROOT,
  'prisma/migrations/20261017120000_phase12_archive_retention/migration.sql'), 'utf8');
test('automatic archive worker cannot start unrelated API notification poller', () => {
  const worker = fs.readFileSync(path.join(ROOT, 'apps/api/scripts/run-phase12-archive.ts'), 'utf8');
  assert.match(worker, /createApplicationContext\(ArchiveWorkerModule/);
  assert.match(worker, /PrismaModule, AuditModule, ArchiveModule/);
  assert.doesNotMatch(worker, /createApplicationContext\(AppModule/);
  assert.doesNotMatch(worker, /NotificationsModule/);
});
test('Phase 12 migration is atomic/additive, seeds no legal periods and protects floor/letter deletion', () => {
  assert.match(sql, /^--[\s\S]*?\nBEGIN;\nALTER TABLE public\."letters" ADD COLUMN "archivedFromStatus" public\."LetterStatus";\nCREATE TABLE public\."RetentionPolicy"/);
  assert.match(sql, /COMMIT;\s*$/);
  assert.doesNotMatch(sql, /\b(?:DROP TABLE|TRUNCATE TABLE|DELETE FROM|UPDATE public\."(?:Invoice|Voucher|FileAttachment)")\b/i);
  assert.match(sql, /"minimumDays" integer,/);
  assert.match(sql, /"minimumDays" IS NULL OR/);
  assert.match(sql, /NEW\."minimumDays" < OLD\."minimumDays"/);
  assert.match(sql, /NEW\."scope" IS DISTINCT FROM OLD\."scope"/);
  assert.match(sql, /phase12_retention_no_reduction/);
  assert.match(sql, /phase12_retention_no_truncate/);
  assert.match(sql, /phase12_letter_no_archive_delete_bypass/);
  assert.match(sql, /a\."action" = 'letter\.archive'/);
  assert.match(sql, /GREATEST\(OLD\."createdAt", OLD\."letterDate"\)/);
  assert.match(sql, /p\."minimumDays" IS NOT NULL/);
  assert.match(sql, /ENABLE ALWAYS TRIGGER phase12_retention_no_reduction/);
  assert.match(sql, /ENABLE ALWAYS TRIGGER phase12_letter_no_archive_delete_bypass/);
  assert.match(sql, /GRANT SELECT, INSERT, UPDATE ON public\."RetentionPolicy" TO shipping_runtime_p11/);
  assert.match(sql, /REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER/);
});
