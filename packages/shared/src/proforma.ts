// ─── Phase 14: Proforma (quote) shared types ──────────────────────────────────
// A proforma is a pre-invoice money document: same line/totals math as Invoice
// but zero financial effect. It converts once into a real DRAFT invoice.

export type ProformaStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';

/** Proforma line = description x quantity x unitPrice -> amount (server-side). */
export interface ProformaItem {
  id: string;
  proformaId: string;
  sequence: number;
  description: string | null;
  quantity: number;
  unitPrice: string;
  amount: string;
}

/** Serialized proforma header (Decimals as strings over the wire). */
export interface Proforma {
  id: string;
  proformaNumber: string;
  customerId: string;
  customer?: { id: string; name: string } | null;
  status: ProformaStatus;
  title: string | null;
  description: string | null;
  currencyCode: string;
  issueDate: string | null;
  validUntil: string | null;
  subtotal: string;
  taxRate: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  linkedInvoiceId: string | null;
  invoice?: { id: string; invoiceNumber: string; status: string } | null;
  cancelReason: string | null;
  notes: string | null;
  items?: ProformaItem[];
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
  cancelledAt: string | null;
}

export interface ProformaListResult {
  data: Proforma[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Payload shape returned by POST /proformas/:id/convert. */
export interface ProformaConvertResult {
  proforma: Proforma;
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: string;
  };
}
