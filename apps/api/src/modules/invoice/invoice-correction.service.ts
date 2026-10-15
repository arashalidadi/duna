import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/auth/types';
import { NumberingService } from '../../common/infrastructure/numbering';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { allocateInvoiceNumber } from './invoice-number';
import { recomputeInvoiceTax } from './invoice-tax';
import { CustomerPostingService } from '../finance/customer-posting.service';
import { WorkflowConfigService } from '../configuration/workflow-config.service';

/**
 * Phase 3 — controlled invoice correction (DEC-019…023, DEC-102).
 *
 * Mechanism: cancel-and-reissue. An ISSUED invoice is never edited. In one transaction:
 *   1) the original moves ISSUED -> CANCELLED with the reason, user and timestamp; its money
 *      fields are not touched,
 *   2) a new DRAFT replacement is created from the original (lines, per-line VAT, Job and B/L
 *      links, TRN) with the next INV number,
 *   3) an InvoiceCorrection row links the two and records who requested and who approved.
 *
 * Approval (DEC-022) is configuration: CompanySettings.invoiceCorrectionApprovalRequired.
 * When off, a correction applies immediately. When on, the request stays PENDING_APPROVAL
 * until a user with invoice:approve_correction approves or rejects it. That user must differ
 * from the requester unless the requester is the primary administrator (DEC-116).
 *
 * A credit note is NOT implemented: it would need its own document type and number format,
 * which the owner has not defined.
 */

type TxClient = Prisma.TransactionClient;

interface LockedInvoice {
  id: string;
  status: string;
  deletedAt: Date | null;
}

const correctionInclude = {
  original: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
  replacement: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
  requestedBy: { select: { id: true, email: true, fullName: true } },
  decidedBy: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.InvoiceCorrectionInclude;

@Injectable()
export class InvoiceCorrectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
    private readonly postings: CustomerPostingService,
    private readonly workflows: WorkflowConfigService,
  ) {}

  /** Corrections where the invoice is the original or the replacement. */
  async listForInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, deletedAt: true },
    });
    if (!invoice || invoice.deletedAt) {
      throw new NotFoundException('Invoice not found');
    }
    return this.prisma.invoiceCorrection.findMany({
      where: {
        OR: [{ originalInvoiceId: invoiceId }, { replacementInvoiceId: invoiceId }],
      },
      include: correctionInclude,
      orderBy: { requestedAt: 'desc' },
    });
  }

  /** DEC-020 — request a correction of an ISSUED invoice. Applies at once unless approval is on. */
  async request(invoiceId: string, reason: string, actor: AuthenticatedUser) {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException('A correction reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      // Row lock: serialises concurrent correction requests on the same invoice.
      const invoice = await this.lockInvoice(tx, invoiceId);
      if (!invoice || invoice.deletedAt) {
        throw new NotFoundException('Invoice not found');
      }
      if (invoice.status !== 'ISSUED') {
        throw new ConflictException(
          `Only ISSUED invoices can be corrected; this invoice is ${invoice.status}`,
        );
      }

      const open = await tx.invoiceCorrection.findFirst({
        where: {
          originalInvoiceId: invoiceId,
          status: { in: ['PENDING_APPROVAL', 'APPLIED'] },
        },
        select: { id: true, status: true },
      });
      if (open) {
        throw new ConflictException(
          open.status === 'APPLIED'
            ? 'This invoice has already been corrected'
            : 'A correction for this invoice is already awaiting approval',
        );
      }

      const approvalRequired = await this.approvalRequired(tx);
      const correction = await tx.invoiceCorrection.create({
        data: {
          originalInvoiceId: invoiceId,
          reason: trimmed,
          status: 'PENDING_APPROVAL',
          requestedById: actor.id,
        },
        select: { id: true },
      });

      // Phase 9 adds a version-pinned approval when configured. It can only
      // ADD a gate to the original CompanySettings rule, never switch it off.
      const configuredApproval = await this.workflows.requestCorrectionIn(tx, correction.id, trimmed, actor);
      if (approvalRequired || configuredApproval) {
        await this.audit.recordIn(tx, {
          action: 'invoice.correction.requested',
          entityType: 'Invoice',
          entityId: invoiceId,
          actorId: actor.id,
          actorEmail: actor.email,
          metadata: { correctionId: correction.id, reason: trimmed },
        });
        return this.findCorrection(tx, correction.id);
      }

      await this.apply(tx, correction.id, actor, null);
      return this.findCorrection(tx, correction.id);
    });
  }

  /**
   * DEC-022 — approve a pending correction.
   *
   * A non-owner cannot approve their own request (segregation of duties). The primary
   * administrator is exempt: DEC-116 states the owner requires no approval from any other
   * user to approve operations.
   */
  async approve(correctionId: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.invoiceCorrection.findUnique({
        where: { id: correctionId },
        select: { id: true, status: true, requestedById: true, originalInvoiceId: true },
      });
      if (!correction) {
        throw new NotFoundException('Correction not found');
      }
      if (correction.status !== 'PENDING_APPROVAL') {
        throw new ConflictException(`Correction is ${correction.status}; only pending corrections can be approved`);
      }
      if (correction.requestedById === actor.id && actor.isPrimaryAdmin !== true) {
        throw new ForbiddenException('The user who requested a correction cannot approve it');
      }

      await this.lockInvoice(tx, correction.originalInvoiceId);
      await this.workflows.decideCorrectionIn(tx, correction.id, true, '', actor);
      await this.apply(tx, correction.id, actor, actor);
      return this.findCorrection(tx, correction.id);
    });
  }

  /** DEC-022 — reject a pending correction. The original invoice is left untouched. */
  async reject(correctionId: string, reason: string, actor: AuthenticatedUser) {
    const trimmed = reason?.trim();
    if (!trimmed) {
      throw new BadRequestException('A rejection reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const correction = await tx.invoiceCorrection.findUnique({
        where: { id: correctionId },
        select: { id: true, status: true, originalInvoiceId: true },
      });
      if (!correction) {
        throw new NotFoundException('Correction not found');
      }
      if (correction.status !== 'PENDING_APPROVAL') {
        throw new ConflictException(`Correction is ${correction.status}; only pending corrections can be rejected`);
      }

      await this.workflows.decideCorrectionIn(tx, correctionId, false, trimmed, actor);
      await tx.invoiceCorrection.update({
        where: { id: correctionId },
        data: {
          status: 'REJECTED',
          decidedById: actor.id,
          decidedAt: new Date(),
          decisionNote: trimmed,
        },
      });
      await this.audit.recordIn(tx, {
        action: 'invoice.correction.rejected',
        entityType: 'Invoice',
        entityId: correction.originalInvoiceId,
        actorId: actor.id,
        actorEmail: actor.email,
        metadata: { correctionId, reason: trimmed },
      });
      return this.findCorrection(tx, correctionId);
    });
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  /**
   * Applies a correction inside the caller's transaction: cancels the original, creates the
   * DRAFT replacement, and links them. `approver` is null when no approval was required.
   */
  private async apply(
    tx: TxClient,
    correctionId: string,
    actor: AuthenticatedUser,
    approver: AuthenticatedUser | null,
  ): Promise<void> {
    const correction = await tx.invoiceCorrection.findUniqueOrThrow({
      where: { id: correctionId },
      select: { id: true, originalInvoiceId: true, reason: true },
    });

    const original = await tx.invoice.findUniqueOrThrow({
      where: { id: correction.originalInvoiceId },
      include: {
        items: { orderBy: { sequence: 'asc' } },
        jobLinks: { select: { jobId: true } },
        billLinks: { select: { billOfLadingId: true } },
      },
    });
    if (original.status !== 'ISSUED' || original.deletedAt) {
      throw new ConflictException(`Invoice is ${original.status}; only ISSUED invoices can be corrected`);
    }

    const now = new Date();
    const before = snapshot(original);

    // 1) Original: ISSUED -> CANCELLED. Conditional update guards against a parallel change.
    const cancelled = await tx.invoice.updateMany({
      where: { id: original.id, status: 'ISSUED' },
      data: {
        status: 'CANCELLED',
        cancelReason: `Corrected: ${correction.reason}`,
        cancelledAt: now,
        cancelledById: actor.id,
      },
    });
    if (cancelled.count !== 1) {
      throw new ConflictException('Invoice changed while the correction was applied; retry');
    }
    await this.postings.append(tx, this.postings.invoiceSource(original), original.totalAmount.negated(), 'CANCEL');

    // 2) Replacement: a new DRAFT with the next INV number. Money is recomputed for the DRAFT
    //    only; the original keeps its stored figures.
    const invoiceNumber = await allocateInvoiceNumber(this.numbering, tx, now);
    const replacement = await tx.invoice.create({
      data: {
        invoiceNumber,
        customerId: original.customerId,
        title: original.title,
        description: original.description,
        currencyCode: original.currencyCode,
        dueDate: original.dueDate,
        taxRate: original.taxRate,
        discountAmount: original.discountAmount,
        billOfLadingId: original.billOfLadingId,
        manifestId: original.manifestId,
        voyageId: original.voyageId,
        trn: original.trn,
        notes: original.notes,
        createdById: actor.id,
      },
      select: { id: true, invoiceNumber: true },
    });

    await tx.invoiceItem.createMany({
      data: original.items.map((it) => ({
        invoiceId: replacement.id,
        sequence: it.sequence,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount,
        taxRate: it.taxRate,
        notes: it.notes,
      })),
    });
    if (original.jobLinks.length > 0) {
      await tx.invoiceJob.createMany({
        data: original.jobLinks.map((l) => ({ invoiceId: replacement.id, jobId: l.jobId })),
        skipDuplicates: true,
      });
    }
    if (original.billLinks.length > 0) {
      await tx.invoiceBill.createMany({
        data: original.billLinks.map((l) => ({
          invoiceId: replacement.id,
          billOfLadingId: l.billOfLadingId,
        })),
        skipDuplicates: true,
      });
    }
    await recomputeInvoiceTax(tx, replacement.id);

    // 3) Link and record the decision.
    await tx.invoiceCorrection.update({
      where: { id: correction.id },
      data: {
        status: 'APPLIED',
        replacementInvoiceId: replacement.id,
        appliedAt: now,
        ...(approver ? { decidedById: approver.id, decidedAt: now } : {}),
      },
    });

    const replacementAfter = await tx.invoice.findUniqueOrThrow({
      where: { id: replacement.id },
      select: { id: true, invoiceNumber: true, status: true, subtotal: true, taxAmount: true, totalAmount: true },
    });

    await this.audit.recordIn(tx, {
      action: 'invoice.corrected',
      entityType: 'Invoice',
      entityId: original.id,
      actorId: actor.id,
      actorEmail: actor.email,
      beforeData: before,
      afterData: { status: 'CANCELLED', cancelReason: `Corrected: ${correction.reason}`, cancelledAt: now },
      metadata: {
        correctionId: correction.id,
        mechanism: 'CANCEL_AND_REISSUE',
        reason: correction.reason,
        replacementInvoiceId: replacement.id,
        replacementInvoiceNumber: replacement.invoiceNumber,
        approvedById: approver?.id ?? null,
      },
    });
    await this.audit.recordIn(tx, {
      action: 'invoice.correction_replacement_created',
      entityType: 'Invoice',
      entityId: replacement.id,
      actorId: actor.id,
      actorEmail: actor.email,
      afterData: replacementAfter,
      metadata: { correctionId: correction.id, originalInvoiceId: original.id },
    });
  }

  private async lockInvoice(tx: TxClient, invoiceId: string): Promise<LockedInvoice | null> {
    const rows = await tx.$queryRaw<LockedInvoice[]>`
      SELECT "id", "status"::text AS "status", "deletedAt"
      FROM "invoices"
      WHERE "id" = ${invoiceId}
      FOR UPDATE`;
    return rows[0] ?? null;
  }

  private async approvalRequired(tx: TxClient): Promise<boolean> {
    const settings = await tx.companySettings.findFirst({
      select: { invoiceCorrectionApprovalRequired: true },
    });
    return settings?.invoiceCorrectionApprovalRequired === true;
  }

  private findCorrection(tx: TxClient, correctionId: string) {
    return tx.invoiceCorrection.findUniqueOrThrow({
      where: { id: correctionId },
      include: correctionInclude,
    });
  }
}

/** Stored money and status of an invoice, for the before/after audit record (DEC-021). */
function snapshot(inv: {
  id: string;
  invoiceNumber: string;
  status: string;
  trn: string | null;
  subtotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  items: { sequence: number; quantity: number; unitPrice: Prisma.Decimal; amount: Prisma.Decimal; taxRate: Prisma.Decimal | null; taxAmount: Prisma.Decimal | null }[];
}) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    trn: inv.trn,
    subtotal: inv.subtotal.toFixed(2),
    taxRate: inv.taxRate.toFixed(2),
    taxAmount: inv.taxAmount.toFixed(2),
    discountAmount: inv.discountAmount.toFixed(2),
    totalAmount: inv.totalAmount.toFixed(2),
    paidAmount: inv.paidAmount.toFixed(2),
    items: inv.items.map((it) => ({
      sequence: it.sequence,
      quantity: it.quantity,
      unitPrice: it.unitPrice.toFixed(2),
      amount: it.amount.toFixed(2),
      taxRate: it.taxRate?.toFixed(2) ?? null,
      taxAmount: it.taxAmount?.toFixed(2) ?? null,
    })),
  };
}
