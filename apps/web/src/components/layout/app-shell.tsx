'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { dirFor } from '@/i18n/routing';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { Sheet } from '@/components/ui/sheet';
export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const locale = useLocale();
  const path = usePathname();
  const t = useTranslations('workspaceUi');
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('duna-sidebar') === 'collapsed');
    } catch {
      /* optional */
    }
  }, []);
  useEffect(() => setMobileOpen(false), [path]);
  useEffect(() => {
    const media = matchMedia('(min-width: 1024px)');
    const close = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, []);
  return (
    <div className="workspace flex min-h-dvh">
      <a
        href="#workspace-main"
        className="sr-only fixed start-4 top-4 z-50 rounded-lg bg-primary p-3 text-primary-foreground focus:not-sr-only"
      >
        {t('skipContent')}
      </a>
      <div className="sticky top-0 hidden h-dvh shrink-0 lg:block">
        <Sidebar
          collapsed={collapsed}
          onToggle={() => {
            setCollapsed(!collapsed);
            try {
              localStorage.setItem('duna-sidebar', collapsed ? 'expanded' : 'collapsed');
            } catch {
              /* optional */
            }
          }}
        />
      </div>
      <Sheet
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side={dirFor(locale) === 'rtl' ? 'right' : 'left'}
        title={t('navigation')}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main id="workspace-main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          <div className="workspace-page mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
