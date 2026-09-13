import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProformaStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  AddProformaItemDto,
  CancelProformaDto,
  CreateProformaDto,
  ListProformaQueryDto,
  UpdateProformaDto,
  UpdateProformaItemDto,
} from './dto/proforma.dto';

// ---------------------------------------------------------------------------
// Proforma lifecycle (server-side).
//   DRAFT -> ISSUED | CANCELLED
//   ISSUED -> CANCELLED
//   CANCELLED is terminal.
// A proforma has NO financial effect: no paidAmount, vouchers cannot link.
// One-time conversion: ISSUED (or DRAFT) -> DRAFT invoice via /convert, which
// copies header + items and stamps linkedInvoiceId (guard against re-convert).
// ---------------------------------------------------------------------------
const PROFORMA_TRANSITIONS: Record<ProformaStatus, ProformaStatus[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['CANCELLED'],
  CANCELLED: [],
};

const EDITABLE_STATUSES: ProformaStatus[] = ['DRAFT'];

const listSelect = {
  id: true,
  proformaNumber: true,
  customerId: true,
  status: true,
  title: true,
  description: true,
  currencyCode: true,
  issueDate: true,
  validUntil: true,
  subtotal: true,
  taxRate: true,
  taxAmount: true,
  discountAmount: true,
  totalAmount: true,
  linkedInvoiceId: true,
  cancelReason: true,
  notes: true,
  createdById: true,
  issuedById: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  issuedAt: true,
  cancelledAt: true,
  deletedAt: true,
  customer: { select: { id: true, code: true, name: true, shortName: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
  createdBy: { select: { id: true, email: true, fullName: true } },
  issuedBy: { select: { id: true, email: true, fullName: true } },
  cancelledBy: { select: { id: true, email: true, fullName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.ProformaSelect;

const detailSelect = {
  ...listSelect,
  items: {
    select: {
      id: true,
      proformaId: true,
      sequence: true,
      description: true,
      quantity: true,
      unitPrice: true,
      amount: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.ProformaSelect;

@Injectable()
export class ProformaService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Proforma CRUD
  // -------------------------------------------------------------------------

  async list(query: ListProformaQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort ?? 'createdAt') as
      | 'proformaNumber'
      | 'status'
      | 'totalAmount'
      | 'issueDate'
      | 'createdAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.ProformaWhereInput = { deletedAt: null };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.unconverted === 'true') where.linkedInvoiceId = null;
    if (query.unconverted === 'false') where.linkedInvoiceId = { not: null };

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { proformaNumber: { contains: s, mode: 'insensitive' } },
        { title: { contains: s, mode: 'insensitive' } },
        { customer: { is: { name: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.proforma.findMany({
        where,
        select: listSelect,
        orderBy: { [sortField]: sortOrder },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.proforma.count({ where }),
    ]);

    return buildPaginated(rows, total, pagination);
  }

  async findById(id: string) {
    const proforma = await this.prisma.proforma.findUnique({
      where: { id },
      select: detailSelect,
    });
    if (!proforma || proforma.deletedAt) {
      throw new NotFoundException('Proforma not found');
    }
    return proforma;
  }

  async create(dto: CreateProformaDto, actor?: AuthenticatedUser) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const proformaNumber = await this.generateReference();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.proforma.create({
          data: {
            proformaNumber,
            customerId: dto.customerId,
            title: dto.title,
            description: dto.description,
            taxRate: dto.taxRate ?? 0,
            discountAmount: dto.discountAmount ?? 0,
            currencyCode: dto.currencyCode ?? 'USD',
            issueDate: dto.issueDate ? new Date(dto.issueDate) : undefined,
            validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
            notes: dto.notes,
            createdById: actor?.id,
          },
          select: detailSelect,
        });

        if (dto.items?.length) {
          let sequence = 0;
          for (const item of dto.items) {
            sequence += 1;
            await tx.proformaItem.create({
              data: {
                proformaId: created.id,
                sequence,
                description: item.description,
                quantity: item.quantity ?? 1,
                unitPrice: new Prisma.Decimal(Number(item.unitPrice).toFixed(2)),
                amount: new Prisma.Decimal(
                  ((item.quantity ?? 1) * Number(item.unitPrice)).toFixed(2)
                ),
              },
            });
          }
          await this.recomputeTotals(tx, created.id);
        }

        return tx.proforma.findUniqueOrThrow({
          where: { id: created.id },
          select: detailSelect,
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        (e.code === 'P2002' || e.code === 'P2018')
      ) {
        throw new ConflictException('Could not create proforma: duplicate reference');
      }
      throw e;
    }
  }

  /** DRAFT-only header edits; money fields recompute derived totals. */
  async update(id: string, dto: UpdateProformaDto) {
    await this.assertEditable(id);
    return this.prisma.$transaction(async (tx) => {
      await tx.proforma.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
          ...(dto.issueDate !== undefined
            ? { issueDate: dto.issueDate ? new Date(dto.issueDate) : null }
            : {}),
          ...(dto.validUntil !== undefined
            ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }
            : {}),
          ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
          ...(dto.discountAmount !== undefined ? { discountAmount: dto.discountAmount } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.proforma.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  /** Soft-delete: DRAFT only (issued quotes are part of the audit trail). */
  async remove(id: string) {
    await this.assertEditable(id);
    await this.prisma.proforma.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { deleted: true };
  }

  // -------------------------------------------------------------------------
  // Line items (DRAFT only)
  // -------------------------------------------------------------------------

  async addItem(id: string, dto: AddProformaItemDto) {
    await this.assertEditable(id);
    return this.prisma.$transaction(async (tx) => {
      const last = await tx.proformaItem.findFirst({
        where: { proformaId: id },
        orderBy: { sequence: 'desc' },
        select: { sequence: true },
      });
      const sequence = (last?.sequence ?? 0) + 1;
      const qty = dto.quantity ?? 1;
      const unitPrice = Number(dto.unitPrice);
      await tx.proformaItem.create({
        data: {
          proformaId: id,
          sequence,
          description: dto.description,
          quantity: qty,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          amount: new Prisma.Decimal((qty * unitPrice).toFixed(2)),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.proforma.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  async updateItem(id: string, itemId: string, dto: UpdateProformaItemDto) {
    await this.assertEditable(id);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.proformaItem.findFirst({
        where: { id: itemId, proformaId: id },
        select: { id: true, quantity: true, unitPrice: true },
      });
      if (!item) throw new NotFoundException('Proforma item not found');

      const qty = dto.quantity ?? item.quantity;
      const unitPrice = dto.unitPrice !== undefined ? Number(dto.unitPrice) : Number(item.unitPrice);
      await tx.proformaItem.update({
        where: { id: itemId },
        data: {
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          quantity: qty,
          unitPrice: new Prisma.Decimal(unitPrice.toFixed(2)),
          amount: new Prisma.Decimal((qty * unitPrice).toFixed(2)),
        },
      });
      await this.recomputeTotals(tx, id);
      return tx.proforma.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  async removeItem(id: string, itemId: string) {
    await this.assertEditable(id);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.proformaItem.findFirst({
        where: { id: itemId, proformaId: id },
        select: { id: true },
      });
      if (!item) throw new NotFoundException('Proforma item not found');
      await tx.proformaItem.delete({ where: { id: itemId } });
      await this.recomputeTotals(tx, id);
      return tx.proforma.findUniqueOrThrow({ where: { id }, select: detailSelect });
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async issue(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.proforma.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true, issueDate: true, validUntil: true, _count: { select: { items: true } } },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Proforma not found');
    }
    this.assertTransition(existing.status, 'ISSUED');
    if (existing._count.items === 0) {
      throw new BadRequestException('Cannot issue a proforma with no lines');
    }

    return this.prisma.proforma.update({
      where: { id },
      data: {
        status: 'ISSUED',
        issuedAt: new Date(),
        issuedById: actor?.id,
        issueDate: existing.issueDate ?? new Date(),
      },
      select: detailSelect,
    });
  }

  /** DRAFT|ISSUED -> CANCELLED. Reason required. Terminal. */
  async cancel(id: string, dto: CancelProformaDto, actor?: AuthenticatedUser) {
    const existing = await this.prisma.proforma.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Proforma not found');
    }
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }

    return this.prisma.proforma.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.cancelReason.trim(),
        cancelledAt: new Date(),
        cancelledById: actor?.id,
      },
      select: detailSelect,
    });
  }

  // -------------------------------------------------------------------------
  // One-time conversion to a real DRAFT invoice (ADR-034)
  // -------------------------------------------------------------------------

  /**
   * Converts the proforma into a new DRAFT invoice: copies header + items,
   * stamps linkedInvoiceId (unique) so a second attempt 409s. Allowed from
   * DRAFT or ISSUED (customer may accept before the quote is formally issued),
   * never from CANCELLED.
   */
  async convert(id: string, actor?: AuthenticatedUser) {
    const existing = await this.prisma.proforma.findUnique({
      where: { id },
      select: {
        id: true,
        proformaNumber: true,
        status: true,
        deletedAt: true,
        linkedInvoiceId: true,
        currencyCode: true,
        title: true,
        description: true,
        issueDate: true,
        validUntil: true,
        taxRate: true,
        discountAmount: true,
        notes: true,
        customerId: true,
      },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Proforma not found');
    }
    if (existing.linkedInvoiceId) {
      throw new ConflictException('Proforma already converted to an invoice');
    }
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Cannot convert a cancelled proforma');
    }

    const items = await this.prisma.proformaItem.findMany({
      where: { proformaId: id },
      orderBy: { sequence: 'asc' },
    });
    if (items.length === 0) {
      throw new BadRequestException('Cannot convert a proforma with no lines');
    }

    // Invoice number via the invoice module's own reference generator shape.
    const invoiceNumber = await this.generateInvoiceReference();

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          customerId: existing.customerId,
          title: existing.title,
          description: existing.description,
          currencyCode: existing.currencyCode,
          taxRate: existing.taxRate,
          discountAmount: existing.discountAmount,
          notes: existing.notes,
          createdById: actor?.id,
        },
        select: { id: true, invoiceNumber: true, status: true, totalAmount: true },
      });

      let sequence = 0;
      for (const item of items) {
        sequence += 1;
        await tx.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            sequence,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
          },
        });
      }

      // Recompute the invoice totals from copied items (same math as Phase 11).
      const agg = await tx.invoiceItem.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      });
      const subtotal = Number(agg._sum.amount ?? 0);
      const discount = Number(existing.discountAmount ?? 0);
      const rate = Number(existing.taxRate ?? 0);
      const taxable = Math.max(subtotal - discount, 0);
      const tax = Number(((taxable * rate) / 100).toFixed(2));
      const total = Number((taxable + tax).toFixed(2));
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
          taxAmount: new Prisma.Decimal(tax.toFixed(2)),
          totalAmount: new Prisma.Decimal(total.toFixed(2)),
        },
      });

      await tx.proforma.update({
        where: { id },
        data: { linkedInvoiceId: invoice.id },
      });

      const proforma = await tx.proforma.findUniqueOrThrow({
        where: { id },
        select: detailSelect,
      });

      return {
        proforma,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          status: 'DRAFT',
          totalAmount: total.toFixed(2),
        },
      };
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async assertEditable(id: string) {
    const existing = await this.prisma.proforma.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Proforma not found');
    }
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new ConflictException(
        `Proforma is ${existing.status} — only DRAFT proformas can be edited`
      );
    }
  }

  private assertTransition(from: ProformaStatus, to: ProformaStatus) {
    if (!PROFORMA_TRANSITIONS[from]?.includes(to)) {
      throw new ConflictException(`Illegal transition ${from} -> ${to}`);
    }
  }

  private async recomputeTotals(tx: Prisma.TransactionClient, proformaId: string) {
    const proforma = await tx.proforma.findUniqueOrThrow({
      where: { id: proformaId },
      select: { taxRate: true, discountAmount: true },
    });

    const agg = await tx.proformaItem.aggregate({
      where: { proformaId },
      _sum: { amount: true },
    });
    const subtotal = Number(agg._sum.amount ?? 0);
    const discount = Number(proforma.discountAmount ?? 0);
    const rate = Number(proforma.taxRate ?? 0);
    const taxable = Math.max(subtotal - discount, 0);
    const tax = Number(((taxable * rate) / 100).toFixed(2));
    const total = Number((taxable + tax).toFixed(2));

    await tx.proforma.update({
      where: { id: proformaId },
      data: {
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        taxAmount: new Prisma.Decimal(tax.toFixed(2)),
        totalAmount: new Prisma.Decimal(total.toFixed(2)),
      },
    });
  }

  /** PRF-YYMM-##### — same shape as the rest of the suite. */
  private async generateReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `PRF-${yymm}-`;

    const latest = await this.prisma.proforma.findFirst({
      where: { proformaNumber: { startsWith: prefix } },
      orderBy: { proformaNumber: 'desc' },
      select: { proformaNumber: true },
    });

    const lastSeq = latest ? Number(latest.proformaNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  /** INV-YYMM-##### for the converted invoice (mirrors the invoice module). */
  private async generateInvoiceReference(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1
    ).padStart(2, '0')}`;
    const prefix = `INV-${yymm}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });

    const lastSeq = latest ? Number(latest.invoiceNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
