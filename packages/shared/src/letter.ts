// Letter — official correspondence register (Phase 17).
// Direction: INCOMING (received as RECEIVED) or OUTGOING (DRAFT -> SENT).
// ARCHIVED reachable from SENT|RECEIVED. Replies thread via replyToId.

export const LetterDirectionValues = ['INCOMING', 'OUTGOING'] as const;
export type LetterDirection = (typeof LetterDirectionValues)[number];

export const LetterStatusValues = ['DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED'] as const;
export type LetterStatus = (typeof LetterStatusValues)[number];

export interface LetterCustomerRef {
  id: string;
  code: string;
  name: string;
}

export interface LetterReplyRef {
  id: string;
  letterNumber: string;
  subject: string;
  status: LetterStatus;
  letterDate: string;
}

export interface Letter {
  id: string;
  letterNumber: string; // LET-YYMM-#####
  direction: LetterDirection;
  status: LetterStatus;
  letterDate: string;
  subject: string;
  body: string | null;
  refNumber: string | null;
  fromContact: string | null;
  toContact: string | null;
  customerId: string | null;
  customer?: LetterCustomerRef | null;
  replyToId: string | null;
  replyTo?: { id: string; letterNumber: string; subject: string } | null;
  repliesCount?: number;
  notes: string | null;
  sentById: string | null;
  sentAt: string | null;
  archivedById: string | null;
  archivedAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LetterListResult {
  data: Letter[];
  meta: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
