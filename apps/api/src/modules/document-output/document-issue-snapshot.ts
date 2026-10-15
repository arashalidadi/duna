import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { defaultLayout, type DocumentData, type DocumentType } from './document-layout';
import { projectRecordedDocument } from './document-record-projection';

/**
 * Invoked INSIDE the operational issuance transaction, after the final status
 * write. Snapshot failure rolls the issuance back rather than leaving a new
 * document with a mutable first-render interpretation. The projection is an
 * explicit allow-list, never an ORM object or a public/portal projection.
 *
 * Ledger is a live statement and deliberately has no issuance event.
 */
export async function captureIssuedDocument(tx: Prisma.TransactionClient,
  type: Exclude<DocumentType, 'ledger'>, id: string, actorId?: string | null): Promise<void> {
  const data = await projectRecordedDocument(tx, type, id);
  if (!data.issued || !data.effectiveAt) throw new ConflictException('Only issued records can be captured');
  const [company, assignment] = await Promise.all([
    tx.companySettings.findFirst({ select: {
      companyName: true, legalName: true, registrationNumber: true, taxNumber: true,
      address: true, city: true, country: true, phone: true, email: true, defaultCurrency: true,
    } }),
    // The assignment visible IN this transaction is the one in force when the
    // document is actually issued, even if its display date was backdated.
    tx.documentTemplateAssignment.findFirst({ where: { documentType: type },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], select: { versionId: true } }),
  ]);
  await tx.documentIssuedSnapshot.create({ data: {
    documentType: type, recordId: id,
    data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
    identity: company ? (JSON.parse(JSON.stringify(company)) as Prisma.InputJsonValue) : Prisma.JsonNull,
    // A missing/deactivated assignment uses the generic layout as it existed
    // WHEN issued, not whatever the server's fallback becomes years later.
    fallbackLayout: assignment?.versionId ? Prisma.JsonNull
      : (defaultLayout(type) as unknown as Prisma.InputJsonValue),
    templateVersionId: assignment?.versionId ?? null, createdById: actorId ?? null,
  } });
}

/** Convert only the date written by the server, not new state from live records. */
export function restoreIssuedData(stored: Prisma.JsonValue): DocumentData {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new ConflictException('Issued document snapshot is invalid');
  }
  const data = stored as unknown as DocumentData;
  if (!data.issued || !data.effectiveAt || !data.number || !data.fields || !Array.isArray(data.rows)) {
    throw new ConflictException('Issued document snapshot is incomplete');
  }
  const at = new Date(data.effectiveAt);
  if (Number.isNaN(at.getTime())) throw new ConflictException('Issued document date is invalid');
  return { ...data, effectiveAt: at };
}
