'use client';

import { useEffect, useState } from 'react';
import type { HealthStatus } from '@shipping/shared';
import { useLocale, useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api/client';
import { NAV_SECTIONS } from '@/lib/navigation/nav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { BadgeCheck, Database, Globe, Clock, Activity, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardError {
  title: string;
  message: string;
}

interface DashboardData {
  health?: HealthStatus;
  error?: DashboardError;
}

const allNavItems = NAV_SECTIONS.flatMap((section) => section.items);
const implementedModules = allNavItems.filter((item) => item.status === 'implemented').length;
const plannedModules = allNavItems.filter((item) => item.status === 'planned').length;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const t = useTranslations('dashboard');
  const tSystem = useTranslations('system');
  const tNav = useTranslations('nav');

  const classifyError = (e: unknown): DashboardError => {
    if (e instanceof ApiError) {
      if (e.status === 503) {
        return { title: t('dbUnavailable'), message: t('dbUnavailableDesc') };
      }
      return {
        title: t('apiError'),
        message: `API ${e.status}: ${e.message}`,
      };
    }
    return { title: t('apiUnreachable'), message: t('apiUnreachableDesc') };
  };

  const load = async () => {
    setLoading(true);
    setData({});
    try {
      const health = await api.getHealth();
      setData({ health });
    } catch (e) {
      setData({ error: classifyError(e) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader loading={loading} health={data.health} onRefresh={load} />

      {loading ? (
        <PageLoader label={tSystem('checking')} />
      ) : data.error ? (
        <ErrorState title={data.error.title} message={data.error.message} onRetry={load} />
      ) : (
        data.health && <DashboardContent health={data.health} />
      )}
    </div>
  );
}

function PageHeader({
  loading,
  health,
  onRefresh,
}: {
  loading: boolean;
  health?: HealthStatus;
  onRefresh: () => void;
}) {
  const t = useTranslations('dashboard');
  const tSystem = useTranslations('system');
  const locale = useLocale();
  const ok = health?.status === 'ok' && health?.database.status === 'up';
  const lastChecked = health
    ? new Date(health.timestamp).toLocaleTimeString(locale === 'fa' ? 'fa-IR' : [], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={[{ label: t('title') }]} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={ok ? 'success' : loading ? 'neutral' : 'danger'} dot>
          {loading ? tSystem('checking') : ok ? tSystem('operational') : tSystem('issue')}
        </Badge>
        {lastChecked && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {tSystem('checkedAt', { time: lastChecked })}
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </button>
      </div>
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  status,
  tone = 'slate',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  status?: { label: string; good: boolean };
  tone?: 'slate' | 'ok';
}) {
  return (
    <Card className="overflow-hidden">
      <div
        className={cn('h-0.5 w-full', tone === 'ok' ? 'bg-primary' : 'bg-border')}
        aria-hidden="true"
      />
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            tone === 'ok' ? 'bg-primary/10 text-primary' : 'bg-muted text-foreground/70'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className="micro-label text-muted-foreground">{label}</p>
          <div className="flex items-center gap-2">{value}</div>
          {status && (
            <Badge variant={status.good ? 'success' : 'danger'} dot>
              {status.label}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent({ health }: { health: HealthStatus }) {
  const t = useTranslations('dashboard');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  return (
    <div className="space-y-6">
      {/* Metric tiles — real health data */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          tone="ok"
          icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />}
          label={t('apiStatus')}
          value={
            <span className="text-lg font-semibold capitalize tabular-nums">{health.status}</span>
          }
          status={{
            label: health.status === 'ok' ? t('health') : t('apiError'),
            good: health.status === 'ok',
          }}
        />
        <MetricTile
          tone="ok"
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          label={t('database')}
          value={<span className="text-lg font-semibold">PostgreSQL</span>}
          status={{
            label: health.database.status === 'up' ? 'Connected' : 'Down',
            good: health.database.status === 'up',
          }}
        />
        <MetricTile
          icon={<Globe className="h-5 w-5" aria-hidden="true" />}
          label={t('environment')}
          value={
            <span className="text-lg font-medium capitalize text-foreground">
              {health.app.environment}
            </span>
          }
        />
        <MetricTile
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          label={t('uptime')}
          value={
            <span className="text-lg font-semibold tabular-nums">
              {formatUptime(health.app.uptimeSeconds, locale)}
            </span>
          }
        />
      </div>

      {/* Module registry — real data from navigation registry */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('implementedModules')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>
              {implementedModules} {t('implementedModules')}
            </Badge>
            <Badge variant="outline" dot>
              {plannedModules} {t('plannedModules')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-[13px]">
              <thead>
                <tr className="micro-label border-b border-border text-muted-foreground">
                  <th className="px-4 py-2 font-medium" scope="col">
                    {tNav('overview')}
                  </th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell" scope="col">
                    {t('apiStatus')}
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    {t('health')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {allNavItems.map((item) => (
                  <tr
                    key={item.labelKey}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {tNav(item.labelKey)}
                    </td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                      {item.href ? '✓' : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={item.href ? 'success' : 'outline'} dot>
                        {item.href ? t('implementedModules') : t('plannedModules')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* System status — real health fields */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('health')}</CardTitle>
            <CardDescription>{t('apiStatus')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <Stat
              label="API"
              value={`v${health.app.version}`}
              icon={<Server className="h-4 w-4" aria-hidden="true" />}
            />
            <Stat
              label={t('environment')}
              value={health.app.environment}
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            />
            <Stat
              label={t('database')}
              value={health.database.status}
              icon={<Database className="h-4 w-4" aria-hidden="true" />}
              good={health.database.status === 'up'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('version')}</CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScopeRow label="API" value="REST · /api/v1" />
            <ScopeRow label={t('database')} value="PostgreSQL" />
            <ScopeRow label={t('version')} value={`v${health.app.version}`} />
            <ScopeRow
              label={t('implementedModules')}
              value={`${implementedModules} / ${implementedModules + plannedModules}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  good,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  good?: boolean;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold capitalize tabular-nums text-foreground">
        {value}
        {good !== undefined && (
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              good ? 'bg-success' : 'bg-destructive'
            )}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function ScopeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number, locale: string): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
