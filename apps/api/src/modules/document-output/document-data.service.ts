import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { VoucherService } from '../voucher/voucher.service';
import {
  type DocumentData, type DocumentType, isDocumentType,
} from './document-layout';
import { fields, line, projectRecordedDocument } from './document-record-projection';

/** Snapshot data for only the 11 approved document types. No portal/agent route calls this service. */
@Injectable()
export class DocumentDataService {
  constructor(private readonly prisma: PrismaService, private readonly vouchers: VoucherService) {}

  async get(typeInput: string, id: string, ledger?: { fromDate?: string; toDate?: string; currencyCode?: string }): Promise<DocumentData> {
    if (!isDocumentType(typeInput) || !/^[a-zA-Z0-9_-]{5,70}$/.test(id)) {
      throw new BadRequestException('Unknown document type or invalid record id');
    }
    const type: DocumentType = typeInput;
    if (type !== 'ledger') return projectRecordedDocument(this.prisma, type, id);
    // Ledger is a live statement, not an issued transaction: never archive or collapse currencies.
    const result = await this.vouchers.ledger({ customerId: id, ...ledger });
    const r = result.summary;
    if (result.entries.length > 2_000) throw new BadRequestException('Ledger output over 2,000 rows; narrow the date range');
    return { type, id, number: r.customerName, status: 'LIVE', effectiveAt: null, issued: false,
      fields: fields({ number: r.customerName, party: r.customerName, currency: r.currencyCode,
        amount: r.currencyCode === 'MIXED' ? null : r.closingBalance,
        period: [ledger?.fromDate, ledger?.toDate].filter(Boolean).join(' — ') }),
      rows: result.entries.map((e) => line({ reference: e.documentNumber, description: e.description,
        debit: e.debit, credit: e.credit, balance: e.balance, currency: e.currencyCode })),
      warning: r.warning ?? (r.currencyCode === 'MIXED' ? 'Amounts are per original currency; no cross-currency total.' : undefined) };
  }
}
