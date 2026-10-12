import type { PaginatedResult } from './api';

/** Invoice lifecycle status. PAID is derived by Phase 12 (Fin vouchers), not stored here. */
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

export interface InvoiceItem {
  /** Phase 3 (REQ-144): line VAT percentage and line VAT amount. Null on pre-Phase-3 issued lines. */
  taxRate?: string | null;
  taxAmount?: string | null;
  id: string;
  invoiceId: string;
  sequence: number;
  description: string;
  quantity: number;
  /** Money Decimal(18,2) serialized as string over the API (ADR-023). */
  unitPrice: string;
  /** Line total = quantity x unitPrice, maintained server-side. */
  amount: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  /** Phase 3 (REQ-147): Tax Registration Number, snapshotted on the invoice. */
  trn?: string | null;
  /** Phase 3 (DEC-071, DEC-105): Jobs and B/Ls this invoice covers. */
  jobLinks?: InvoiceJobLink[];
  billLinks?: InvoiceBillLink[];
  /** Phase 3 (DEC-020/021): correction links, seen from either side. */
  correctionAsReplacement?: InvoiceCorrectionRef | null;
  correctionsAsOriginal?: InvoiceCorrectionRef[];
  id: string;
  invoiceNumber: string;
  /** Bill-to party (legacy invoices.user_id was the CREATOR; the new model separates customer vs createdById). */
  customerId: string;
  status: InvoiceStatus;
  title: string | null;
  /** Legacy `todescr` — free-text addressee/description line. */
  description: string | null;
  /** Money Decimal(18,2) serialized as string (ADR-023). */
  subtotal: string;
  /** Percent 0-100, Decimal(5,2) as string. */
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  /** Updated by Phase 12 (Fin/payment vouchers). Zero until payments exist. */
  paidAmount: string;
  currencyCode: string;
  issueDate: string | null;
  dueDate: string | null;
  /** Legacy invoices.bl_id — optional link to the B/L this bills for. */
  billOfLadingId: string | null;
  /** Legacy invoices.manifest_id — optional link to the Manifest. */
  manifestId: string | null;
  /** Voyage denormalized from bill/manifest for fast list joins. */
  voyageId: string | null;
  cancelReason: string | null;
  notes: string | null;
  createdById: string | null;
  issuedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  cancelledAt: string | null;
  deletedAt: string | null;
  customer?: { id: string; code: string; name: string; shortName: string | null };
  billOfLading?: { id: string; billNumber: string } | null;
  manifest?: { id: string; manifestNumber: string } | null;
  items?: InvoiceItem[];
  createdBy?: { id: string; email: string; fullName: string };
  issuedBy?: { id: string; email: string; fullName: string } | null;
  cancelledBy?: { id: string; email: string; fullName: string } | null;
  _count?: { items: number };
}

export interface InvoiceJobLink {
  jobId: string;
  job: { id: string; jobNumber: string; title: string; status: string };
}

export interface InvoiceBillLink {
  billOfLadingId: string;
  billOfLading: { id: string; billNumber: string };
}

export type InvoiceCorrectionStatus = 'PENDING_APPROVAL' | 'APPLIED' | 'REJECTED';

export interface InvoiceCorrectionRef {
  id: string;
  originalInvoiceId?: string;
  replacementInvoiceId?: string | null;
  status: InvoiceCorrectionStatus;
  reason: string;
  requestedAt?: string;
  appliedAt?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
}

export interface PaginatedInvoiceResult {
  data: Invoice[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ListInvoiceQueryDto {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: InvoiceStatus;
  customerId?: string;
  voyageId?: string;
  /** Overdue = ISSUED && dueDate < now && unpaid. */
  overdue?: boolean;
  /** Unpaid = ISSUED && paidAmount < totalAmount. */
  unpaid?: boolean;
  createdFrom?: string;
  createdTo?: string;
  sort?: 'invoiceNumber' | 'status' | 'totalAmount' | 'issueDate' | 'dueDate' | 'createdAt';
  order?: 'asc' | 'desc';
}

export interface CreateInvoiceDto {
  customerId: string;
  title?: string;
  description?: string;
  taxRate?: string | number;
  discountAmount?: string | number;
  currencyCode?: string;
  issueDate?: string;
  dueDate?: string;
  billOfLadingId?: string;
  manifestId?: string;
  notes?: string;
}

export interface UpdateInvoiceDto {
  customerId?: string;
  title?: string | null;
  description?: string | null;
  taxRate?: string | number | null;
  discountAmount?: string | number | null;
  currencyCode?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  billOfLadingId?: string | null;
  manifestId?: string | null;
  notes?: string | null;
}

export interface AddInvoiceItemDto {
  description: string;
  unitPrice: string | number;
  quantity?: string | number;
  notes?: string;
}

export interface UpdateInvoiceItemDto {
  description?: string;
  unitPrice?: string | number;
  quantity?: string | number;
  notes?: string | null;
}

export interface CancelInvoiceDto {
  cancelReason: string;
}

export interface InvoiceApiResult {
  success: boolean;
  data: Invoice | InvoiceDetail | Invoice[] | PaginatedResult<Invoice>;
  meta?: { timestamp: string };
}
