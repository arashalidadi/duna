/**
 * Phase 4 attachment policy (pure, no I/O).
 *
 * Scope is DEC-092: identity documents and signatures on payment vouchers and salary slips
 * only. Nothing here extends capture to unrelated documents.
 *
 * Technical defaults below (MIME allow-list, size cap) are proposals pending owner
 * confirmation; see docs/source-material/project-audit.md §3.
 */

export const ATTACHMENT_ENTITY_TYPES = ['VOUCHER', 'SALARY_RECORD'] as const;
export type AttachmentEntityType = (typeof ATTACHMENT_ENTITY_TYPES)[number];

/** DEC-092 evidence: recipient ID front/back + signature (vouchers); employee ID front/back + signature (salary slips). */
export const IDENTITY_ATTACHMENT_CATEGORIES = ['ID_FRONT', 'ID_BACK', 'SIGNATURE'] as const;
export type IdentityAttachmentCategory = (typeof IDENTITY_ATTACHMENT_CATEGORIES)[number];

export function isIdentityCategory(value: string): value is IdentityAttachmentCategory {
  return (IDENTITY_ATTACHMENT_CATEGORIES as readonly string[]).includes(value);
}

interface MimeRule {
  extension: string;
  /** Leading bytes that must match the content (the declared MIME type is not trusted alone). */
  magic: readonly number[];
}

export const ATTACHMENT_MIME_RULES: Readonly<Record<string, MimeRule>> = {
  'application/pdf': { extension: 'pdf', magic: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  'image/jpeg': { extension: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png': { extension: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
};

/** Proposed cap: 10 MiB per file. */
export const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function isAllowedMimeType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(ATTACHMENT_MIME_RULES, mimeType);
}

export function matchesMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const rule = ATTACHMENT_MIME_RULES[mimeType];
  if (!rule || buffer.length < rule.magic.length) {
    return false;
  }
  return rule.magic.every((byte, index) => buffer[index] === byte);
}

/**
 * Keeps only the base name, strips path separators and control characters, and limits length.
 * The stored key never uses this value; it is display metadata only.
 */
export function sanitizeFilename(original: string): string {
  const base = original.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  const limited = cleaned.slice(0, 200);
  return limited.length > 0 ? limited : 'document';
}
