'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations, useFormatter } from 'next-intl';
import type { HealthStatus } from '@shipping/shared';
import { ArrowUpRight, Database, Clock, Activity, RefreshCw, LayoutGrid } from 'lucide-react';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { NAV_SECTIONS, NAV_SECTION_ORDER } from '@/lib/navigation/nav';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDate } from '@/lib/date';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const t = useTranslations('workspaceUi');
  const nav = useTranslations('nav');
  const dash = useTranslations('dashboard');
  const locale = useLocale();
  const format = useFormatter();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setHealth(await api.getHealth());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter(
      (i) =>
        i.href &&
        i.href !== '/dashboard' &&
        (!i.requiredPermission || hasPermission(i.requiredPermission))
    ),
  }))
    .filter((s) => s.items.length)
    .sort((a, b) => NAV_SECTION_ORDER.indexOf(a.titleKey) - NAV_SECTION_ORDER.indexOf(b.titleKey));
  const count = sections.reduce((sum, s) => sum + s.items.length, 0);
  const seconds = health?.app.uptimeSeconds ?? 0;
  const ok = health?.status === 'ok' && health?.database.status === 'up';
  const metrics = health
    ? [
        { label: t('healthStatus'), value: t(ok ? 'connected' : 'disconnected'), icon: Activity },
        {
          label: dash('database'),
          value: t(health.database.status === 'up' ? 'connected' : 'disconnected'),
          icon: Database,
        },
        {
          label: t('uptime'),
          value: t('uptimeValue', {
            days: Math.floor(seconds / 86400),
            hours: Math.floor((seconds % 86400) / 3600),
            minutes: Math.floor((seconds % 3600) / 60),
          }),
          icon: Clock,
        },
        { label: t('modulesAvailable'), value: format.number(count), icon: LayoutGrid },
      ]
    : [];
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t('workspace')} / {nav('overview')}
          </p>
          <h1 className="font-semibold">{nav('dashboard')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {user?.fullName} <span aria-hidden>·</span> {formatDate(new Date(), locale)}
          </p>
        </div>
        <Button variant="outline" onClick={load} loading={loading}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t('refresh')}
        </Button>
      </div>
      {loading ? (
        <div
          role="status"
          aria-label={t('liveStatus')}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {[0, 1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title={t('serviceUnavailable')}
          message={t('serviceUnavailableDescription')}
          onRetry={load}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                </div>
                <p className="text-xl font-semibold tabular-nums">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">{t('quickAccess')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('quickAccessDescription')}</p>
        </div>
        {!sections.length ? (
          <EmptyState title={t('noAccess')} />
        ) : (
          <div className="columns-1 gap-5 lg:columns-2 2xl:columns-3">
            {sections.map((section) => (
              <Card key={section.titleKey} className="mb-5 break-inside-avoid">
                <CardHeader>
                  <CardTitle>{nav(section.titleKey)}</CardTitle>
                  <Badge variant="outline">{format.number(section.items.length)}</Badge>
                </CardHeader>
                <CardContent className="grid gap-1 p-2 sm:grid-cols-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        href={item.href!}
                        key={item.labelKey}
                        className="group flex min-h-16 items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background text-primary">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-medium">
                          {nav(item.labelKey)}
                        </span>
                        <ArrowUpRight
                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 rtl:-rotate-90"
                          aria-hidden
                        />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      {health && !error && !loading && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('liveStatus')}</CardTitle>
              <CardDescription>{t('statusDescription')}</CardDescription>
            </div>
            <Badge variant={ok ? 'success' : 'danger'} dot>
              {t(ok ? 'connected' : 'disconnected')}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted-foreground">
            <span>API · v{health.app.version}</span>
            <span>{dash('database')} · PostgreSQL</span>
            <span>
              {dash('environment')} · {health.app.environment}
            </span>
            <time dateTime={health.timestamp}>
              {format.dateTime(new Date(health.timestamp), { hour: '2-digit', minute: '2-digit' })}
            </time>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
