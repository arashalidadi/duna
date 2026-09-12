import type { PaginatedResult } from './api';

/** Money in (from customer) / money out (refund to customer). */
export type VoucherType = 'RECEIPT' | 'PAYMENT';

export type VoucherMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

/** Vouchers post immediately; CANCELLED is terminal (audit). */
export type VoucherStatus = 'POSTED' | 'CANCELLED';

export interface Voucher {
  id: string;
  /** RCP-YYMM-##### (RECEIPT) / PMT-YYMM-##### (PAYMENT). */
  voucherNumber: string;
  type: VoucherType;
  status: VoucherStatus;
  customerId: string;
  /** Optional settlement document; null = standalone deposit/advance. */
  invoiceId: string | null;
  /** Denormalized from invoice.voyageId at creation (filter aid only). */
  voyageId: string | null;
  /** Always positive; sign comes from type. Money Decimal(18,2) as string. */
  amount: string;
  currencyCode: string;
  /** Rate at voucher date; 1 = no conversion. Decimal(10,4) as string. */
  exchangeRate: string;
  method: VoucherMethod;
  /** Cheque / transfer trace number. */
  reference: string | null;
  description: string | null;
  note: string | null;
  voucherDate: string;
  cancelReason: string | null;
  createdById: string | null;
  cancelledById: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
  invoice?: { id: string; invoiceNumber: string; status: string; totalAmount: string } | null;
  createdBy?: { id: string; fullName: string } | null;
  cancelledBy?: { id: string; fullName: string } | null;
}

/** Ledger/statement line — unified journal entry derived from invoices + vouchers. */
export interface LedgerEntry {
  /** Sortable ISO date for the entry. */
  date: string;
  /** 'invoice' (charge) | 'voucher' (settlement) | 'balance' (opening/closing). */
  kind: 'invoice' | 'voucher' | 'balance';
  documentNumber: string;
  documentId: string;
  description: string;
  /** Debit: customer owes more (invoice issued). 0 when credit side. */
  debit: string;
  /** Credit: customer settled (RECEIPT posted). 0 when debit side. */
  credit: string;
  /** Running balance in the requested currency (owes more = positive). */
  balance: string;
  invoiceId: string | null;
  voucherId: string | null;
}

export interface LedgerSummary {
  customerId: string;
  customerName: string;
  fromDate: string | null;
  toDate: string | null;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  currencyCode: string;
}

export interface CreateVoucherDto {
  type: VoucherType;
  customerId: string;
  invoiceId?: string;
  amount: number;
  currencyCode?: string;
  exchangeRate?: number;
  method?: VoucherMethod;
  reference?: string;
  description?: string;
  note?: string;
  voucherDate?: string;
}

export interface UpdateVoucherDto {
  method?: VoucherMethod;
  reference?: string;
  description?: string;
  note?: string;
  voucherDate?: string;
  amount?: number;
  exchangeRate?: number;
}

export type VoucherListResult = PaginatedResult<Voucher>;
