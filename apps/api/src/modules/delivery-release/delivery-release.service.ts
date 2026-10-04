import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DeliveryOrder,
  ReleaseEligibility,
  ReleaseOrder,
} from '@shipping/shared';
import { PrismaClient } from '@prisma/client';

const PAGE_SIZE_MAX = 100;

type Tx = Prisma.TransactionClient;
type ACTX = { canOverride?: boolean; userId?: string };

@Injectable()
export class DeliveryReleaseService {
  constructor(private readonly prisma: PrismaService) {}

  // ── helpers ────────────────────────────────────────────────────────────────

  private async nextNumber(tx: Tx, prefix: 'DO' | 'RO'): Promise<string> {
    const now = new Date();
    const yy = String(now.getFullYear() % 100).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const head = `${prefix}-${yy}${mm}-`;
    const model = prefix === 'DO' ? tx.deliveryOrder : tx.releaseOrder;
    for (let seq = 1; seq <= 9999; seq++) {
      const candidate = `${head}${String(seq).padStart(5, '0')}`;
      const exists = await (model as any).findUnique({ where: { docNumber: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    throw new ConflictException(`doc number space exhausted for ${head}`);
  }

  /** B/L must exist, be live and APPROVED (the issued-equivalent — P4-U4). */
  private async requireIssuedBill(tx: Tx, billOfLadingId: string) {
    const bill = await tx.billOfLading.findFirst({
      where: { id: billOfLadingId, deletedAt: null },
    });
    if (!bill) throw new NotFoundException('bill of lading not found');
    if (bill.status !== 'APPROVED') {
      throw new ConflictException(`bill of lading must be APPROVED (current: ${bill.status})`);
    }
    return bill;
  }

  private async assertNoActive(tx: Tx, prefix: 'DO' | 'RO', billOfLadingId: string) {
    const model = prefix === 'DO' ? tx.deliveryOrder : tx.releaseOrder;
    const active = await (model as any).findFirst({
      where: { billOfLadingId, status: 'ISSUED', deletedAt: null },
      select: { docNumber: true },
    });
    if (active) {
      throw new ConflictException(`an active ${prefix} already exists for this B/L (${active.docNumber})`);
    }
  }

  /**
   * Money rule: every live ISSUED invoice anchored to this B/L must be settled.
   * No invoices billed yet = nothing outstanding (allowed without override).
   */
  private async billFinancials(tx: Tx, billOfLadingId: string) {
    const invoices = await tx.invoice.findMany({
      where: { billOfLadingId, deletedAt: null, status: 'ISSUED' },
      select: { totalAmount: true, paidAmount: true },
    });
    let total = new Prisma.Decimal(0);
    let paid = new Prisma.Decimal(0);
    for (const inv of invoices) {
      total = total.plus(inv.totalAmount);
      paid = paid.plus(inv.paidAmount);
    }
    // overpay clamp: paid may exceed total; outstanding never negative
    let outstanding = total.minus(paid);
    if (outstanding.lessThan(0)) outstanding = new Prisma.Decimal(0);
    return {
      invoicesTotal: total.toFixed(2),
      invoicesPaid: paid.toFixed(2),
      outstanding: outstanding.toFixed(2),
      fullyPaid: outstanding.lessThanOrEqualTo(0.005),
    };
  }

  // ── eligibility (release pre-check) ───────────────────────────────────────

  async eligibility(billOfLadingId: string): Promise<ReleaseEligibility> {
    const bill = await this.prisma.billOfLading.findFirst({ where: { id: billOfLadingId, deletedAt: null } });
    if (!bill) throw new NotFoundException('bill of lading not found');
    // P4-U4: issued-equivalent swap (ADR-046 ruling 1). Eligibility POLICY (ruling 3:
    // APPROVED + fully paid) is P4-U6's job — only the state token changes here.
    if (bill.status !== 'APPROVED') {
      return {
        billOfLadingId, billNumber: bill.billNumber,
        invoicesTotal: '0.00', invoicesPaid: '0.00', outstanding: '0.00',
        fullyPaid: false, needsOverride: true, canRelease: false,
      };
    }
    const fin = await this.billFinancials(this.prisma as unknown as Tx, billOfLadingId);
    return {
      billOfLadingId,
      billNumber: bill.billNumber,
      invoicesTotal: fin.invoicesTotal,
      invoicesPaid: fin.invoicesPaid,
      outstanding: fin.outstanding,
      fullyPaid: fin.fullyPaid,
      needsOverride: !fin.fullyPaid,
      canRelease: fin.fullyPaid,
    };
  }

  // ── Delivery Order ────────────────────────────────────────────────────────

  private serializeDo(d: Prisma.DeliveryOrderGetPayload<{ include: { billOfLading: true; recipientCustomer: true } }>) {
    return {
      id: d.id,
      docNumber: d.docNumber,
      billOfLadingId: d.billOfLadingId,
      status: d.status,
      issueDate: d.issueDate.toISOString(),
      recipient: d.recipient,
      recipientId: d.recipientId,
      vehiclePlate: d.vehiclePlate,
      notes: d.notes,
      cancelReason: d.cancelReason,
      cancelledById: d.cancelledById,
      cancelledAt: d.cancelledAt ? d.cancelledAt.toISOString() : null,
      createdById: d.createdById,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      billOfLading: d.billOfLading ? { id: d.billOfLading.id, billNumber: d.billOfLading.billNumber, status: d.billOfLading.status } : null,
      recipientCustomer: d.recipientCustomer ? { id: d.recipientCustomer.id, name: d.recipientCustomer.name } : null,
    };
  }

  async listDelivery(params: {
    page?: number; pageSize?: number; search?: string; status?: string; billOfLadingId?: string; sort?: string; order?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.DeliveryOrderWhereInput = { deletedAt: null };
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { docNumber: { contains: q, mode: 'insensitive' } },
        { recipient: { contains: q, mode: 'insensitive' } },
        { vehiclePlate: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.status) where.status = params.status as any;
    if (params.billOfLadingId) where.billOfLadingId = params.billOfLadingId;

    const sortBy = ['docNumber', 'issueDate', 'createdAt'].includes(params.sort ?? '') ? params.sort! : 'issueDate';
    const order = params.order ?? 'desc';

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deliveryOrder.findMany({
        where, include: { billOfLading: true, recipientCustomer: true },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.deliveryOrder.count({ where }),
    ]);
    return { data: rows.map((r) => this.serializeDo(r)), meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async detailDelivery(id: string) {
    const d = await this.prisma.deliveryOrder.findFirst({
      where: { id, deletedAt: null }, include: { billOfLading: true, recipientCustomer: true },
    });
    if (!d) throw new NotFoundException('delivery order not found');
    return this.serializeDo(d);
  }

  async createDelivery(dto: {
    billOfLadingId: string; recipient: string; recipientId?: string; vehiclePlate?: string; notes?: string; issueDate?: string;
  }, ctx: ACTX) {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.requireIssuedBill(tx, dto.billOfLadingId);
      await this.assertNoActive(tx, 'DO', dto.billOfLadingId);
      if (dto.recipientId) {
        const c = await tx.customer.findFirst({ where: { id: dto.recipientId, deletedAt: null } });
        if (!c) throw new NotFoundException('recipient customer not found');
      }
      return tx.deliveryOrder.create({
        data: {
          docNumber: await this.nextNumber(tx, 'DO'),
          billOfLadingId: dto.billOfLadingId,
          recipient: dto.recipient,
          recipientId: dto.recipientId ?? null,
          vehiclePlate: dto.vehiclePlate,
          notes: dto.notes,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : new Date(),
          createdById: ctx.userId!,
        },
      });
    });
    return this.detailDelivery(created.id);
  }

  async updateDelivery(id: string, dto: { recipient?: string; recipientId?: string | null; vehiclePlate?: string; notes?: string; issueDate?: string }) {
    await this.prisma.$transaction(async (tx) => {
      const d = await tx.deliveryOrder.findFirst({ where: { id, deletedAt: null } });
      if (!d) throw new NotFoundException('delivery order not found');
      if (d.status === 'CANCELLED') throw new ConflictException('cancelled delivery order is frozen');
      const data: Prisma.DeliveryOrderUpdateInput = {};
      if (dto.recipient !== undefined) data.recipient = dto.recipient;
      if (dto.recipientId !== undefined) {
        if (dto.recipientId !== null) {
          const c = await tx.customer.findFirst({ where: { id: dto.recipientId, deletedAt: null } });
          if (!c) throw new NotFoundException('recipient customer not found');
        }
        data.recipientCustomer = dto.recipientId === null ? { disconnect: true } : { connect: { id: dto.recipientId } };
      }
      if (dto.vehiclePlate !== undefined) data.vehiclePlate = dto.vehiclePlate;
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.issueDate !== undefined) data.issueDate = new Date(dto.issueDate);
      await tx.deliveryOrder.update({ where: { id }, data });
    });
    return this.detailDelivery(id);
  }

  async cancelDelivery(id: string, dto: { reason: string }, ctx: ACTX) {
    await this.prisma.$transaction(async (tx) => {
      const d = await tx.deliveryOrder.findFirst({ where: { id, deletedAt: null } });
      if (!d) throw new NotFoundException('delivery order not found');
      if (d.status === 'CANCELLED') throw new ConflictException('already cancelled');
      await tx.deliveryOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: dto.reason, cancelledById: ctx.userId ?? null, cancelledAt: new Date() },
      });
    });
    return this.detailDelivery(id);
  }

  async removeDelivery(id: string) {
    const d = await this.prisma.deliveryOrder.findFirst({ where: { id, deletedAt: null } });
    if (!d) throw new NotFoundException('delivery order not found');
    if (d.status === 'ISSUED') throw new ConflictException('cancel the delivery order before deleting it');
    await this.prisma.deliveryOrder.delete({ where: { id } });
    return { id };
  }

  // ── Release Order ──────────────────────────────────────────────────────────

  private serializeRo(r: Prisma.ReleaseOrderGetPayload<{ include: { billOfLading: true } }>) {
    return {
      id: r.id,
      docNumber: r.docNumber,
      billOfLadingId: r.billOfLadingId,
      status: r.status,
      releaseDate: r.releaseDate.toISOString(),
      financialOverride: r.financialOverride,
      overrideReason: r.overrideReason,
      notes: r.notes,
      cancelReason: r.cancelReason,
      cancelledById: r.cancelledById,
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      createdById: r.createdById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      billOfLading: r.billOfLading ? { id: r.billOfLading.id, billNumber: r.billOfLading.billNumber, status: r.billOfLading.status } : null,
      financials: null as any,
    };
  }

  async listRelease(params: {
    page?: number; pageSize?: number; search?: string; status?: string; billOfLadingId?: string; sort?: string; order?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.ReleaseOrderWhereInput = { deletedAt: null };
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { docNumber: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { overrideReason: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params.status) where.status = params.status as any;
    if (params.billOfLadingId) where.billOfLadingId = params.billOfLadingId;

    const sortBy = ['docNumber', 'releaseDate', 'createdAt'].includes(params.sort ?? '') ? params.sort! : 'releaseDate';
    const order = params.order ?? 'desc';

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.releaseOrder.findMany({
        where, include: { billOfLading: true },
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      this.prisma.releaseOrder.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({ ...this.serializeRo(r), financials: null })),
      meta: { page, pageSize, totalItems: total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async detailRelease(id: string) {
    const r = await this.prisma.releaseOrder.findFirst({
      where: { id, deletedAt: null }, include: { billOfLading: true },
    });
    if (!r) throw new NotFoundException('release order not found');
    const fin = await this.billFinancials(this.prisma as unknown as Tx, r.billOfLadingId);
    return { ...this.serializeRo(r), financials: { invoicesTotal: fin.invoicesTotal, invoicesPaid: fin.invoicesPaid, fullyPaid: fin.fullyPaid } };
  }

  async createRelease(dto: {
    billOfLadingId: string; releaseDate?: string; notes?: string; force?: boolean; overrideReason?: string;
  }, ctx: ACTX) {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.requireIssuedBill(tx, dto.billOfLadingId);
      await this.assertNoActive(tx, 'RO', dto.billOfLadingId);
      const fin = await this.billFinancials(tx, dto.billOfLadingId);
      let financialOverride = false;
      let overrideReason: string | null = null;
      if (!fin.fullyPaid) {
        // money rule blocks: require explicit authorized override
        if (!dto.force || !dto.overrideReason) {
          throw new ConflictException(
            `outstanding balance ${fin.outstanding} — release requires full settlement or an authorized override`
          );
        }
        if (!ctx.canOverride) throw new ForbiddenException('release:override permission required');
        financialOverride = true;
        overrideReason = dto.overrideReason;
      }
      return tx.releaseOrder.create({
        data: {
          docNumber: await this.nextNumber(tx, 'RO'),
          billOfLadingId: dto.billOfLadingId,
          releaseDate: dto.releaseDate ? new Date(dto.releaseDate) : new Date(),
          notes: dto.notes,
          financialOverride,
          overrideReason,
          createdById: ctx.userId!,
        },
      });
    });
    return this.detailRelease(created.id);
  }

  async updateRelease(id: string, dto: { notes?: string; releaseDate?: string }) {
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.releaseOrder.findFirst({ where: { id, deletedAt: null } });
      if (!r) throw new NotFoundException('release order not found');
      if (r.status === 'CANCELLED') throw new ConflictException('cancelled release order is frozen');
      const data: Prisma.ReleaseOrderUpdateInput = {};
      if (dto.notes !== undefined) data.notes = dto.notes;
      if (dto.releaseDate !== undefined) data.releaseDate = new Date(dto.releaseDate);
      await tx.releaseOrder.update({ where: { id }, data });
    });
    return this.detailRelease(id);
  }

  async cancelRelease(id: string, dto: { reason: string }, ctx: ACTX) {
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.releaseOrder.findFirst({ where: { id, deletedAt: null } });
      if (!r) throw new NotFoundException('release order not found');
      if (r.status === 'CANCELLED') throw new ConflictException('already cancelled');
      await tx.releaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', cancelReason: dto.reason, cancelledById: ctx.userId ?? null, cancelledAt: new Date() },
      });
    });
    return this.detailRelease(id);
  }

  async removeRelease(id: string) {
    const r = await this.prisma.releaseOrder.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw new NotFoundException('release order not found');
    if (r.status === 'ISSUED') throw new ConflictException('cancel the release order before deleting it');
    await this.prisma.releaseOrder.delete({ where: { id } });
    return { id };
  }
}
