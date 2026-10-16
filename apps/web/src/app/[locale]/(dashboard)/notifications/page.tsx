'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { NotificationInboxItem, NotificationTrigger } from '@shipping/shared';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageLoader } from '@/components/ui/loading';

const ROUTE: Record<NotificationTrigger, '/invoices' | '/configuration' | '/jobs' | '/release-orders' | '/cargo'> = {
  OVERDUE_INVOICE: '/invoices', PENDING_APPROVAL: '/configuration',
  JOB_STATUS_CHANGED: '/jobs', UNPAID_RELEASE: '/release-orders',
  CARGO_DOCUMENT_PENDING: '/cargo',
};

export default function NotificationsPage() {
  const t = useTranslations('phase10');
  const { hasPermission } = useAuth();
  const allowed = hasPermission('notification:read');
  const [rows, setRows] = useState<NotificationInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api.get<NotificationInboxItem[]>('/notifications')); setError(null); }
    catch (err) { setError(err instanceof ApiError ? err.message : t('loadFailed')); }
    finally { setLoading(false); }
  }, [t]);
  useEffect(() => { if (allowed) void load(); }, [allowed, load]);

  async function mark(row: NotificationInboxItem, dismiss: boolean) {
    setBusy(row.id);
    try {
      await api.patch(`/notifications/${row.id}/${dismiss ? 'dismiss' : 'read'}`, {});
      setRows((items) => dismiss ? items.filter((i) => i.id !== row.id)
        : items.map((i) => i.id === row.id ? { ...i, readAt: new Date().toISOString() } : i));
      setError(null);
    } catch (err) { setError(err instanceof ApiError ? err.message : t('saveFailed')); }
    finally { setBusy(null); }
  }

  if (!allowed) return <p>{t('noAccess')}</p>;
  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: t('inbox') }]} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{t('inbox')}</h1>
        <p className="text-sm text-muted-foreground">{t('inboxHint')}</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()}>{t('refresh')}</Button>
    </div>
    {error && <ErrorState message={error} onRetry={() => void load()} />}
    {loading ? <PageLoader /> : rows.length === 0 ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">{t('noNotifications')}</p>
      : <div className="space-y-3">{rows.map((row) => <Card key={row.id} className={row.readAt ? '' : 'border-primary/40'}>
        <CardHeader className="pb-2"><CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {row.rule.name} {!row.readAt && <Badge>{t('unread')}</Badge>}
          {row.stage > 0 && <Badge variant="warning">{t('escalation')}</Badge>}
        </CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="space-y-1"><p>{t(`trigger.${row.rule.trigger}`)}</p>
            <p className="text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString()} · {t('occurrence', { number: row.cycle + 1 })}</p>
            <Link className="text-primary underline-offset-2 hover:underline" href={row.event.eventKey.startsWith('correction:') ? '/invoices' : ROUTE[row.rule.trigger]}>{t('openSource')}</Link>
          </div>
          <div className="flex gap-2">
            {!row.readAt && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void mark(row, false)}>{t('markRead')}</Button>}
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void mark(row, true)}>{t('dismiss')}</Button>
          </div>
        </CardContent></Card>)}</div>}
  </div>;
}
