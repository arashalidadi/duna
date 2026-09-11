'use client';

import { useEffect, useState } from 'react';
import type { HealthStatus } from '@shipping/shared';
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

function classifyError(e: unknown): DashboardError {
  if (e instanceof ApiError) {
    if (e.status === 503) {
      return {
        title: 'Database unavailable',
        message: 'The API is reachable but its database health check failed.',
      };
    }
    return {
      title: 'API error',
      message: `The API returned an error (${e.status}): ${e.message}`,
    };
  }
  return {
    title: 'API unreachable',
    message:
      'Unable to reach the API. Check that the API is running and reachable from the browser.',
  };
}

const allNavItems = NAV_SECTIONS.flatMap((section) => section.items);
const implementedModules = allNavItems.filter((item) => item.status === 'implemented').length;
const plannedModules = allNavItems.filter((item) => item.status === 'planned').length;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);

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
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader loading={loading} health={data.health} onRefresh={load} />

      {loading ? (
        <PageLoader label="Checking system status…" />
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
  const ok = health?.status === 'ok' && health?.database.status === 'up';
  const lastChecked = health
    ? new Date(health.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-2">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Foundation overview · live system and module registry status
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant={ok ? 'success' : loading ? 'neutral' : 'danger'} dot>
          {loading ? 'Checking…' : ok ? 'System operational' : 'System issue'}
        </Badge>
        {lastChecked && (
          <span className="text-xs tabular-nums text-muted-foreground">updated {lastChecked}</span>
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
  return (
    <div className="space-y-6">
      {/* Metric tiles — real health data */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          tone="ok"
          icon={<BadgeCheck className="h-5 w-5" aria-hidden="true" />}
          label="Application"
          value={
            <span className="text-lg font-semibold capitalize tabular-nums">{health.status}</span>
          }
          status={{
            label: health.status === 'ok' ? 'Operational' : 'Issue',
            good: health.status === 'ok',
          }}
        />
        <MetricTile
          tone="ok"
          icon={<Database className="h-5 w-5" aria-hidden="true" />}
          label="Database"
          value={<span className="text-lg font-semibold">PostgreSQL</span>}
          status={{
            label: health.database.status === 'up' ? 'Connected' : 'Down',
            good: health.database.status === 'up',
          }}
        />
        <MetricTile
          icon={<Globe className="h-5 w-5" aria-hidden="true" />}
          label="Environment"
          value={
            <span className="text-lg font-medium capitalize text-foreground">
              {health.app.environment}
            </span>
          }
        />
        <MetricTile
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          label="Uptime"
          value={
            <span className="text-lg font-semibold tabular-nums">
              {formatUptime(health.app.uptimeSeconds)}
            </span>
          }
        />
      </div>

      {/* Module registry — real data from navigation registry */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Module Registry</CardTitle>
            <CardDescription>
              Foundation scope · populated from the navigation registry
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>
              {implementedModules} implemented
            </Badge>
            <Badge variant="outline" dot>
              {plannedModules} planned
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="micro-label border-b border-border text-muted-foreground">
                  <th className="px-4 py-2 font-medium" scope="col">
                    Module
                  </th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell" scope="col">
                    Section
                  </th>
                  <th className="px-4 py-2 font-medium" scope="col">
                    Status
                  </th>
                  <th className="hidden px-4 py-2 font-medium lg:table-cell" scope="col">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {allNavItems.map((item) => (
                  <tr
                    key={item.label}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{item.label}</td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                      {item.href ? 'Implemented' : 'Planned'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={item.href ? 'success' : 'outline'} dot>
                        {item.href ? 'Implemented' : 'Planned'}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                      {item.description}
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
            <CardTitle>System Status</CardTitle>
            <CardDescription>Live platform health from the API</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
            <Stat
              label="API"
              value={`v${health.app.version}`}
              icon={<Server className="h-4 w-4" aria-hidden="true" />}
            />
            <Stat
              label="Environment"
              value={health.app.environment}
              icon={<Globe className="h-4 w-4" aria-hidden="true" />}
            />
            <Stat
              label="Database"
              value={health.database.status}
              icon={<Database className="h-4 w-4" aria-hidden="true" />}
              good={health.database.status === 'up'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scope</CardTitle>
            <CardDescription>Current build overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScopeRow label="API style" value="REST · /api/v1" />
            <ScopeRow label="Timezone" value="Asia/Dubai" />
            <ScopeRow label="Currencies" value="USD, AED" />
            <ScopeRow
              label="Modules"
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

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
