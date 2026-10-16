import { BadRequestException } from '@nestjs/common';
import type { AuditLogRecord } from './audit.types';

export const MAX_AUDIT_EXPORT_ROWS = 1000;
const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;

/** Fixed UTC time window so no export silently truncates the whole history. */
export function auditExportWindow(from: string, to: string): { from: Date; to: Date } {
  const start = new Date(from);
  const end = new Date(to);
  if (!from || !to || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
    start > end || end.getTime() - start.getTime() > MAX_RANGE_MS || end.getTime() > Date.now()) {
    throw new BadRequestException('Audit export requires a valid past UTC from/to range of at most 31 days');
  }
  return { from: start, to: end };
}

function cell(value: unknown): string {
  let text = value === null || value === undefined ? '' : typeof value === 'object'
    ? JSON.stringify(value) : String(value);
  // Defend spreadsheet readers against formula injection even if an audited
  // user-agent/email/metadata field begins with whitespace and a formula sigil.
  if (/^\s*[=+\-@]/u.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Export privileged audit history as UTF-8 CSV without storage URLs or secrets. */
export function renderAuditCsv(rows: AuditLogRecord[]): string {
  const fields = ['id', 'timestamp', 'actorId', 'actorEmail', 'action', 'entityType', 'entityId',
    'beforeData', 'afterData', 'metadata', 'ipAddress', 'userAgent'] as const;
  return [fields.join(','), ...rows.map((row) => fields.map((field) =>
    cell(field === 'timestamp' ? row.timestamp.toISOString() : row[field])).join(','))].join('\r\n') + '\r\n';
}
