'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Sheet } from '@/components/ui/sheet';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const locale = useLocale();

  // In RTL, sidebar is on the right → mobile sheet opens from right
  const sheetSide = locale === 'fa' ? 'right' : 'left';

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar />
      </div>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        side={sheetSide}
        className="w-72"
        labelledBy="mobile-nav-label"
      >
        <span className="sr-only" id="mobile-nav-label">
          Main navigation
        </span>
        <Sidebar />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="scrollbar-thin flex-1">
          <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}