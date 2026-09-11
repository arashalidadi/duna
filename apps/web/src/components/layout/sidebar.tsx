'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ship, Activity, LogOut } from 'lucide-react';
import type { HealthStatus } from '@shipping/shared';
import { api } from '@/lib/api/client';
import { NAV_SECTIONS, type NavItem } from '@/lib/navigation/nav';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function NavRow({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = !!item.href && pathname === item.href;
  const Icon = item.icon;

  return (
    <>
      {item.href ? (
        <Link
          href={item.href}
          className={cn(
            'group relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
            isActive
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-foreground hover:bg-accent hover:text-accent-foreground'
          )}
          title={item.description}
          aria-current={isActive ? 'page' : undefined}
        >
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r bg-primary"
              aria-hidden="true"
            />
          )}
          <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
          <span className="flex-1 truncate">{item.label}</span>
        </Link>
      ) : (
        <button
          type="button"
          className="flex h-8 w-full cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 text-[13px] text-muted-foreground"
          disabled
          title={item.description}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
          <span className="flex-1 truncate">{item.label}</span>
          <Badge variant="outline" className="text-[10px] font-normal">
            Soon
          </Badge>
        </button>
      )}
    </>
  );
}

function NavGroup({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="mb-1">
      <div className="micro-label px-2.5 pb-1 pt-2 text-muted-foreground">{title}</div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function SystemStatus() {
  const [status, setStatus] = useState<'ok' | 'down' | 'loading'>('loading');
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getHealth()
      .then((h: HealthStatus) => {
        if (cancelled) return;
        setStatus(h.status === 'ok' && h.database.status === 'up' ? 'ok' : 'down');
        setCheckedAt(
          new Date(h.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      })
      .catch(() => {
        if (!cancelled) setStatus('down');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <Activity
        className={cn(
          'h-3.5 w-3.5',
          status === 'ok' && 'text-success',
          status === 'down' && 'text-destructive',
          status === 'loading' && 'animate-pulse text-muted-foreground'
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium leading-tight text-foreground">
          System {status === 'ok' ? 'Operational' : status === 'down' ? 'Issue' : 'Checking…'}
        </div>
        {checkedAt && (
          <div className="text-[10px] leading-tight text-muted-foreground">checked {checkedAt}</div>
        )}
      </div>
    </div>
  );
}

function SidebarContent() {
  const { user, hasPermission, logout } = useAuth();

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.requiredPermission || hasPermission(item.requiredPermission)
    ),
  })).filter((section) => section.items.length > 0);

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:h-screen">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary shadow-sm">
          <Ship className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
          <span className="sr-only">Shipping ERP</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight tracking-tight">
            Shipping ERP
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            Operations &amp; Accounting
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2 py-2" aria-label="Main navigation">
        {visibleSections.map((section) => (
          <NavGroup key={section.title} title={section.title} items={section.items} />
        ))}
      </nav>

      {/* System status + user */}
      <div className="space-y-2 border-t border-border px-2.5 py-3">
        <SystemStatus />
        <div className="flex items-center gap-2 px-1">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium leading-tight text-foreground">
              {user?.fullName || 'Signed in'}
            </span>
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              {user?.email}
            </span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => logout()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return <SidebarContent />;
}
