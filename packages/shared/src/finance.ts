/** Phase 6 accounting payloads. Money and rates are decimal strings. */
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';

export interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isActive: boolean;
}

export interface JournalLine {
  id: string;
  accountId: string;
  customerId: string | null;
  debit: string;
  credit: string;
  baseDebit: string;
  baseCredit: string;
  memo: string | null;
  account: Pick<AccountingAccount, 'code' | 'name' | 'type'>;
}

export interface GeneralJournal {
  id: string;
  journalNumber: string;
  journalDate: string;
  kind: 'GENERAL' | 'OFFICE_EXPENSE';
  description: string;
  currencyCode: string;
  baseCurrencyCode: string;
  exchangeRate: string;
  rateEffectiveAt: string;
  rateSource: string;
  reversalOfId: string | null;
  reversedAt: string | null;
  lines: JournalLine[];
}

export interface ManagedRate {
  id: string;
  currencyCode: string;
  baseCurrencyCode: string;
  rate: string;
  effectiveAt: string;
  source: string;
  status: 'DRAFT' | 'APPROVED';
  approvedAt: string | null;
}

export interface AccountEntries {
  account: AccountingAccount;
  entries: (JournalLine & { journal: Pick<GeneralJournal, 'journalNumber' | 'journalDate' | 'description' | 'currencyCode' | 'baseCurrencyCode' | 'exchangeRate' | 'rateEffectiveAt' | 'rateSource' | 'reversedAt' | 'reversalOfId'> })[];
  totals: { currencyCode: string; debit: string; credit: string; balance: string }[];
}
