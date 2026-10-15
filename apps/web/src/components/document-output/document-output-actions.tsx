'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { downloadDocument, type DocumentOutputFormat } from '@/lib/api/document-download';

export const DOCUMENT_READ_PERMISSIONS: Record<string, string> = {
  'loading-list': 'load_list:read', bill: 'bill:read', manifest: 'manifest:read',
  invoice: 'invoice:read', 'delivery-order': 'delivery:read', 'release-order': 'release:read',
  'salary-slip': 'salary:read', voucher: 'voucher:read', payment: 'voucher:read',
  receipt: 'voucher:read', ledger: 'ledger:read',
};

/** Same actions on all document screens. Permission checks are repeated on the API. */
export function DocumentOutputActions({ type, id, filters }: {
  type: string; id: string;
  filters?: { fromDate?: string; toDate?: string; currencyCode?: string; previewVersionId?: string };
}) {
  const t = useTranslations('documentOutput');
  const { hasPermission } = useAuth();
  const [busy, setBusy] = useState<DocumentOutputFormat | null>(null);
  const [error, setError] = useState('');
  if (!id || !hasPermission('document:render') || !hasPermission(DOCUMENT_READ_PERMISSIONS[type] ?? 'document:invalid')) {
    return null;
  }
  async function run(format: DocumentOutputFormat) {
    setBusy(format); setError('');
    try { await downloadDocument(type, id, format, filters); }
    catch (e) { setError(e instanceof Error ? e.message : t('error')); }
    finally { setBusy(null); }
  }
  return <div className="space-y-2" aria-label={t('outputs')}>
    <div className="flex flex-wrap gap-2">
      {(['pdf', 'xlsx', 'print'] as const).map((format) =>
        <Button key={format} size="sm" variant="outline" disabled={!!busy}
          onClick={() => void run(format)}>
          {busy === format ? t('loading') : t(format)}
        </Button>)}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
