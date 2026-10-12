import { Prisma } from '@prisma/client';
import {
  NumberingService,
  nextSequenceAfter,
  periodicSequenceRequest,
} from '../../common/infrastructure/numbering';

/**
 * Allocate the next INV number (shared INV family, DEC-027). Runs inside the caller's
 * transaction so the counter rolls back with a failed insert. Used by invoice create and by
 * the correction replacement; proforma-convert keeps its own call.
 */
export async function allocateInvoiceNumber(
  numbering: NumberingService,
  tx: Prisma.TransactionClient,
  now: Date,
): Promise<string> {
  const req = periodicSequenceRequest('INVOICE', now);
  const { sequence } = await numbering.allocateNumber({
    ...req,
    seedNextSequence: async (seedTx) =>
      nextSequenceAfter(
        req.prefix,
        (
          await seedTx.invoice.findFirst({
            where: { invoiceNumber: { startsWith: req.prefix } },
            orderBy: { invoiceNumber: 'desc' },
            select: { invoiceNumber: true },
          })
        )?.invoiceNumber ?? null,
      ),
    tx,
  });
  return sequence;
}
