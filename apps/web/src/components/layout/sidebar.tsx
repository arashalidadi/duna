'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Ship, ChevronDown, PanelLeftClose, PanelLeftOpen, Search, LogOut } from 'lucide-react';
import { NAV_SECTIONS, NAV_SECTION_ORDER, type NavItem } from '@/lib/navigation/nav';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const common = useTranslations('common');
  const active = !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  const Icon = item.icon;
  const classes = cn(
    'nav-link relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    collapsed && 'justify-center px-0',
    active
      ? 'bg-primary/10 text-primary shadow-sm'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
  );
  return item.href ? (
    <Link
      href={item.href}
      className={classes}
      onClick={onNavigate}
      title={t(item.labelKey)}
      aria-label={collapsed ? t(item.labelKey) : undefined}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <span className="absolute inset-y-3 start-0 w-0.5 rounded-full bg-primary" aria-hidden />
      )}
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
    </Link>
  ) : (
    <button
      type="button"
      disabled
      className={cn(classes, 'w-full opacity-50')}
      title={`${t(item.labelKey)} · ${common('soon')}`}
      aria-label={collapsed ? t(item.labelKey) : undefined}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="truncate">{t(item.labelKey)}</span>
          <span className="ms-auto rounded border px-1.5 py-0.5 text-[10px]">{common('soon')}</span>
        </>
      )}
    </button>
  );
}
function NavGroup({
  titleKey,
  items,
  collapsed,
  searching,
  onNavigate,
}: {
  titleKey: string;
  items: NavItem[];
  collapsed: boolean;
  searching: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('nav');
  const path = usePathname();
  const id = useId();
  const active = items.some((item) => item.href === path);
  const [open, setOpen] = useState(active || titleKey === 'overview');
  useEffect(() => {
    if (active) setOpen(true);
  }, [active, path]);
  const expanded = open || collapsed || searching;
  return (
    <section className={cn('py-1', collapsed && 'border-b last:border-0')}>
      {!collapsed && (
        <button
          type="button"
          className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-start text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(!open)}
          aria-expanded={expanded}
          aria-controls={id}
        >
          <span className="flex-1">{t(titleKey)}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform duration-200',
              !expanded && '-rotate-90 rtl:rotate-90'
            )}
            aria-hidden
          />
        </button>
      )}
      <div id={id} className="nav-accordion" data-expanded={expanded}>
        <div
          className="min-h-0 overflow-hidden"
          style={{ visibility: expanded ? 'visible' : 'hidden' }}
          {...{ 'aria-hidden': !expanded }}
        >
          <div className="space-y-1">
            {items.map((item) => (
              <NavRow
                key={item.labelKey}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
export function Sidebar({
  collapsed = false,
  onToggle,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const { user, hasPermission, logout } = useAuth();
  const t = useTranslations('workspaceUi');
  const app = useTranslations('app');
  const common = useTranslations('common');
  const nav = useTranslations('nav');
  const [query, setQuery] = useState('');
  const path = usePathname();
  useEffect(() => setQuery(''), [path]);
  const order = NAV_SECTION_ORDER;
  const implementedLabels = new Set(
    NAV_SECTIONS.flatMap((s) => s.items)
      .filter((i) => i.href)
      .map((i) => i.labelKey)
  );
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        (!item.requiredPermission || hasPermission(item.requiredPermission)) &&
        (item.href || !implementedLabels.has(item.labelKey)) &&
        (collapsed || nav(item.labelKey).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    ),
  }))
    .filter((s) => s.items.length)
    .sort((a, b) => order.indexOf(a.titleKey) - order.indexOf(b.titleKey));
  return (
    <aside
      className={cn(
        'flex h-full w-full flex-col border-e bg-card transition-[width] duration-200',
        collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'
      )}
    >
      <div
        className={cn(
          'flex h-[76px] shrink-0 items-center gap-3 border-b px-5',
          collapsed && 'justify-center px-0'
        )}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-900 text-brass-300 shadow-sm"
          aria-label={app('name')}
        >
          <Ship className="h-6 w-6" aria-hidden />
        </Link>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-base font-semibold">
              Duna<span className="text-primary">.</span>
            </p>
            <p className="truncate text-[11px] text-muted-foreground">{app('tagline')}</p>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="relative mx-3 mt-4">
          <Search
            className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('findModule')}
            aria-label={t('findModule')}
            className="bg-background ps-9"
          />
        </div>
      )}
      <nav
        aria-label={t('navigation')}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      >
        {sections.map((section) => (
          <NavGroup
            key={section.titleKey}
            {...section}
            collapsed={collapsed}
            searching={!!query && !collapsed}
            onNavigate={onNavigate}
          />
        ))}
        {!sections.length && <p className="p-3 text-sm text-muted-foreground">{t('noModules')}</p>}
      </nav>
      <div className="shrink-0 space-y-2 border-t p-3">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {user?.fullName?.[0] ?? '?'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">{user?.fullName}</p>
              <p dir="ltr" className="truncate text-start text-[10px] text-muted-foreground">
                {user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => logout()}
              aria-label={common('signOut')}
              title={common('signOut')}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
        {onToggle && (
          <Button
            variant="ghost"
            className="w-full justify-center text-muted-foreground"
            onClick={onToggle}
            aria-label={t(collapsed ? 'expandSidebar' : 'collapseSidebar')}
            title={t(collapsed ? 'expandSidebar' : 'collapseSidebar')}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 rtl:rotate-180" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 rtl:rotate-180" aria-hidden />
                <span className="text-xs">{t('collapseSidebar')}</span>
              </>
            )}
          </Button>
        )}
      </div>
    </aside>
  );
}
