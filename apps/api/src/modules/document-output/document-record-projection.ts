import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type DocumentData, type DocumentType, type HeaderField, type LineField } from './document-layout';

/** Do not use a generic ORM-to-template serializer: projections below are explicit allow-lists. */
function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') return value.toString();
  return '';
}
export const fields = (values: Partial<Record<HeaderField, unknown>>): DocumentData['fields'] =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, text(v)]));
export const line = (values: Partial<Record<LineField, unknown>>): DocumentData['rows'][number] =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, text(v)]));

/** Shared explicit projection for rendering AND the issuance transaction.
 * Reads the same transaction as the status transition, before any source,
 * company or counterparty can be changed by a subsequent committed write. */
export async function projectRecordedDocument(db: Prisma.TransactionClient | PrismaService,
  type: Exclude<DocumentType, 'ledger'>, id: string): Promise<DocumentData> {
  if (!/^[a-zA-Z0-9_-]{5,70}$/.test(id)) throw new BadRequestException('Invalid record id');
  if (type === 'loading-list') {
    const r = await db.loadList.findFirst({ where: { id, deletedAt: null }, select: {
      id: true, loadListNumber: true, status: true, createdAt: true, finalizedAt: true, notes: true,
      voyage: { select: { voyageNumber: true, vessel: { select: { name: true } },
        originPort: { select: { name: true } }, destinationPort: { select: { name: true } } } },
      items: { orderBy: { sequence: 'asc' }, select: { sequence: true, plannedQuantity: true,
        cargo: { select: { reference: true, description: true, quantity: true, packages: true, weight: true } } } },
    } });
    if (!r) throw new NotFoundException('Loading list not found');
    return { type, id, number: r.loadListNumber, status: r.status, effectiveAt: r.finalizedAt,
      issued: r.status === 'FINALIZED' || !!r.finalizedAt, fields: fields({ number: r.loadListNumber, status: r.status,
        date: r.finalizedAt ?? r.createdAt, voyage: r.voyage.voyageNumber, vessel: r.voyage.vessel.name,
        origin: r.voyage.originPort.name, destination: r.voyage.destinationPort.name, notes: r.notes }),
      rows: r.items.map((i) => line({ reference: i.cargo.reference,
        description: i.cargo.description, quantity: i.plannedQuantity ?? i.cargo.quantity,
        packages: i.cargo.packages, weight: i.cargo.weight })) };
  }
  if (type === 'bill') {
    const r = await db.billOfLading.findFirst({ where: { id, deletedAt: null }, select: {
      billNumber: true, status: true, issuedAt: true, createdAt: true, dateOfIssue: true,
      vesselName: true, voyage: { select: { voyageNumber: true } },
      shipper: { select: { name: true } }, consignee: { select: { name: true } },
      goodsDescription: true, totalPackages: true, totalGrossWeight: true, freightAmount: true,
      currencyCode: true, notes: true,
      items: { orderBy: { sequence: 'asc' }, select: { cargo: { select: { reference: true } },
        goodsDescription: true, packages: true, grossWeight: true, marksAndNumbers: true } },
    } });
    if (!r) throw new NotFoundException('Bill of lading not found');
    return { type, id, number: r.billNumber, status: r.status, effectiveAt: r.issuedAt,
      issued: ['APPROVED', 'RELEASED', 'ISSUED'].includes(r.status) || !!r.issuedAt,
      fields: fields({ number: r.billNumber, status: r.status, date: r.dateOfIssue ?? r.issuedAt ?? r.createdAt,
        party: r.consignee?.name, reference: r.shipper?.name, vessel: r.vesselName,
        voyage: r.voyage.voyageNumber,
        amount: r.freightAmount, currency: r.currencyCode, notes: r.goodsDescription ?? r.notes }),
      rows: r.items.map((i) => line({ reference: i.cargo.reference,
        description: i.goodsDescription ?? i.marksAndNumbers, packages: i.packages, weight: i.grossWeight })) };
  }
  if (type === 'manifest') {
    const r = await db.manifest.findFirst({ where: { id, deletedAt: null }, select: {
      manifestNumber: true, status: true, createdAt: true, manifestDate: true, approvedAt: true,
      vesselName: true, voyage: { select: { voyageNumber: true } },
      polPort: { select: { name: true } }, podPort: { select: { name: true } },
      totalQuantity: true, totalPackages: true, totalWeight: true, notes: true,
      items: { orderBy: { sequence: 'asc' }, select: { blNumber: true,
        billOfLadingItem: { select: { billOfLading: { select: { billNumber: true } } } },
        shipper: { select: { name: true } }, consignee: { select: { name: true } },
        cargo: { select: { description: true } },
        quantity: true, packages: true, weight: true } },
    } });
    if (!r) throw new NotFoundException('Manifest not found');
    return { type, id, number: r.manifestNumber, status: r.status, effectiveAt: r.approvedAt,
      issued: r.status === 'APPROVED' || !!r.approvedAt,
      fields: fields({ number: r.manifestNumber, status: r.status, date: r.manifestDate ?? r.createdAt,
        vessel: r.vesselName, voyage: r.voyage.voyageNumber, origin: r.polPort.name,
        destination: r.podPort.name, notes: r.notes }),
      rows: [...r.items.map((i) => line({
        reference: i.blNumber ?? i.billOfLadingItem?.billOfLading.billNumber,
        description: i.cargo.description, shipper: i.shipper?.name, consignee: i.consignee?.name,
        units: i.quantity, packages: i.packages, weight: i.weight,
      })), line({ reference: 'TOTAL', units: r.totalQuantity,
        packages: r.totalPackages, weight: r.totalWeight })] };
  }
  if (type === 'invoice') {
    const r = await db.invoice.findFirst({ where: { id, deletedAt: null }, select: {
      invoiceNumber: true, status: true, issueDate: true, issuedAt: true, createdAt: true,
      customer: { select: { name: true } }, billOfLading: { select: { billNumber: true } },
      title: true, description: true, currencyCode: true, subtotal: true, taxAmount: true,
      totalAmount: true, trn: true, notes: true,
      items: { orderBy: { sequence: 'asc' }, select: { description: true, quantity: true,
        unitPrice: true, amount: true, taxAmount: true } },
    } });
    if (!r) throw new NotFoundException('Invoice not found');
    return { type, id, number: r.invoiceNumber, status: r.status, effectiveAt: r.issuedAt,
      issued: r.status === 'ISSUED' || (r.status === 'CANCELLED' && !!r.issuedAt),
      fields: fields({ number: r.invoiceNumber, status: r.status, date: r.issueDate ?? r.issuedAt ?? r.createdAt,
        party: r.customer?.name, reference: r.billOfLading?.billNumber, notes: r.title ?? r.description ?? r.notes,
        currency: r.currencyCode, subtotal: r.subtotal, tax: r.taxAmount, amount: r.totalAmount,
        taxNumber: r.trn }),
      rows: r.items.map((i) => line({ description: i.description, quantity: i.quantity,
        unitPrice: i.unitPrice, amount: i.amount, tax: i.taxAmount, currency: r.currencyCode })) };
  }
  if (type === 'delivery-order' || type === 'release-order') {
    const select = { docNumber: true, status: true, createdAt: true,
      billOfLading: { select: { billNumber: true, vesselName: true } } } as const;
    if (type === 'delivery-order') {
      const r = await db.deliveryOrder.findFirst({ where: { id, deletedAt: null }, select: {
        ...select, issueDate: true, recipient: true, portName: true, notes: true,
      } });
      if (!r) throw new NotFoundException('Delivery order not found');
      return { type, id, number: r.docNumber, status: r.status, effectiveAt: r.createdAt,
        issued: true, fields: fields({ number: r.docNumber, status: r.status, date: r.issueDate,
          reference: r.billOfLading.billNumber, vessel: r.billOfLading.vesselName,
          party: r.recipient, port: r.portName, notes: r.notes }), rows: [] };
    }
    const r = await db.releaseOrder.findFirst({ where: { id, deletedAt: null }, select: {
      ...select, releaseDate: true, paymentState: true, notes: true,
    } });
    if (!r) throw new NotFoundException('Release order not found');
    return { type, id, number: r.docNumber, status: r.status, effectiveAt: r.createdAt,
      issued: true, fields: fields({ number: r.docNumber, status: r.status, date: r.releaseDate,
        reference: r.billOfLading.billNumber, vessel: r.billOfLading.vesselName,
        paymentState: r.paymentState ?? 'Not recorded', notes: r.notes }), rows: [] };
  }
  if (type === 'salary-slip') {
    const r = await db.salaryRecord.findFirst({ where: { id, deletedAt: null }, select: {
      recordNumber: true, status: true, createdAt: true, approvedAt: true, year: true, month: true,
      employee: { select: { name: true, code: true } }, base: true, additions: true,
      deductions: true, net: true, currencyCode: true, notes: true,
    } });
    if (!r) throw new NotFoundException('Salary slip not found');
    return { type, id, number: r.recordNumber, status: r.status, effectiveAt: r.approvedAt,
      issued: ['APPROVED', 'PAID'].includes(r.status) || !!r.approvedAt,
      fields: fields({ number: r.recordNumber, status: r.status, date: r.approvedAt ?? r.createdAt,
        party: r.employee.name, reference: r.employee.code, period: `${r.year}-${String(r.month).padStart(2, '0')}`,
        currency: r.currencyCode, amount: r.net, notes: r.notes }),
      rows: [line({ description: 'Base', amount: r.base, currency: r.currencyCode }),
        line({ description: 'Additions', amount: r.additions, currency: r.currencyCode }),
        line({ description: 'Deductions', amount: `-${r.deductions}`, currency: r.currencyCode })] };
  }
  if (type === 'voucher' || type === 'payment' || type === 'receipt') {
    const r = await db.voucher.findFirst({ where: { id, deletedAt: null,
      ...(type === 'payment' ? { type: 'PAYMENT' } : type === 'receipt' ? { type: 'RECEIPT' } : {}) }, select: {
        voucherNumber: true, status: true, type: true, voucherDate: true, createdAt: true,
        customer: { select: { name: true } }, amount: true, currencyCode: true,
        reference: true, description: true, allocations: { where: { reversedAt: null },
          select: { amount: true, invoice: { select: { invoiceNumber: true } },
            billOfLading: { select: { billNumber: true } } } },
      } });
    if (!r) throw new NotFoundException('Voucher not found');
    return { type, id, number: r.voucherNumber, status: r.status, effectiveAt: r.createdAt,
      issued: true, fields: fields({ number: r.voucherNumber, status: r.status,
        date: r.voucherDate, party: r.customer?.name, reference: r.reference,
        amount: r.amount, currency: r.currencyCode, notes: r.description,
        paymentState: r.type }), rows: r.allocations.map((a) => line({
        reference: a.invoice?.invoiceNumber ?? a.billOfLading?.billNumber,
        amount: a.amount, currency: r.currencyCode })) };
  }
  throw new BadRequestException('Ledger is not an issued record');
}
