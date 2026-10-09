'use client';
import { Menu, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { NAV_SECTIONS } from '@/lib/navigation/nav';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { LanguageSelector, ThemeSelector } from '@/components/preferences/preferences';
export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const path = usePathname();
  const t = useTranslations('workspaceUi');
  const nav = useTranslations('nav');
  const common = useTranslations('common');
  const { logout } = useAuth();
  const current = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.href === path);
  return (
    <header className="sticky top-0 z-30 flex min-h-[76px] shrink-0 items-center gap-2 border-b bg-card px-3 sm:gap-4 sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 lg:hidden"
        onClick={onMenuClick}
        aria-label={t('openNavigation')}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Button>
      <div className="min-w-0">
        <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">
          {t('workspace')}
        </p>
        <p className="truncate text-sm font-semibold">
          {current ? nav(current.labelKey) : t('workspace')}
        </p>
      </div>
      <div className="ms-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <LanguageSelector />
        <ThemeSelector />
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
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
    </header>
  );
}
