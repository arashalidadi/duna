// ─── Phase 15: Quotation shared types ─────────────────────────────────────────
// A quotation answers a customer inquiry with a binding-until-expiry price.
// Same line/totals math as Invoice/Proforma. Accepted quotations convert ONCE
// into a DRAFT proforma, completing the chain Quote -> Proforma -> Invoice.

export type QuotationStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

/** Quotation line = description x quantity x unitPrice -> amount (server-side). */
export interface QuotationItem {
  id: string;
  quotationId: string;
  sequence: number;
  description: string | null;
  quantity: number;
  unitPrice: string;
  amount: string;
}

/** Serialized quotation header (Decimals as strings over the wire). */
export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customer?: { id: string; name: string } | null;
  status: QuotationStatus;
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
  linkedProformaId: string | null;
  proforma?: { id: string; proformaNumber: string; status: string } | null;
  rejectReason: string | null;
  cancelReason: string | null;
  notes: string | null;
  items?: QuotationItem[];
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
}

export interface QuotationListResult {
  data: Quotation[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Payload shape returned by POST /quotations/:id/convert. */
export interface QuotationConvertResult {
  quotation: Quotation;
  proforma: {
    id: string;
    proformaNumber: string;
    status: string;
    totalAmount: string;
  };
}
