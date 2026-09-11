'use client';

import { Search, Bell, Menu, LogOut, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { locales } from '@/i18n/routing';
import { formatDateShort } from '@/lib/date';

interface TopbarProps {
  onMenuClick?: () => void;
}

function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('topbar');

  function switchTo(next: string) {
    router.replace(pathname, { locale: next });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2 text-xs"
      onClick={() => switchTo(locale === 'fa' ? 'en' : 'fa')}
      aria-label={t('language')}
      title={locale === 'fa' ? t('switchToEnglish') : t('switchToPersian')}
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span>{locale === 'fa' ? 'EN' : 'فا'}</span>
    </Button>
  );
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const locale = useLocale();
  const { user, logout } = useAuth();
  const t = useTranslations('common');
  const tTopbar = useTranslations('topbar');

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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
          aria-label={tTopbar('openNav')}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}

      {/* Workspace / active context */}
      <div className="hidden items-center gap-2 md:flex">
        <span className="micro-label text-muted-foreground">{t('workspace')}</span>
        <span className="text-sm font-medium text-foreground">Foundation</span>
      </div>

      {/* Global search */}
      <div className="relative hidden max-w-xs flex-1 sm:flex lg:max-w-sm">
        <Search
          className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          placeholder={t('search')}
          className="h-9 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled
        />
      </div>

      <div className="ms-auto flex items-center gap-1.5">
        {/* Language switcher */}
        <LanguageSwitcher />
        {/* Jalali date chip (Persian locale only) */}
        {locale === 'fa' && (
          <span className="hidden text-xs tabular-nums text-muted-foreground lg:inline px-2 py-0.5 rounded bg-muted">
            {formatDateShort(new Date(), locale)}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${t('notifications')} (coming soon)`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span
            className="absolute end-2 top-2 h-2 w-2 rounded-full bg-destructive"
            aria-hidden="true"
          />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {initials}
          </div>
          <div className="hidden text-start sm:block">
            <div className="text-xs font-medium leading-tight text-foreground">
              {user?.fullName || tTopbar('signedIn')}
            </div>
            <div className="flex items-center gap-1 text-[10px] leading-tight text-muted-foreground">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
              {t('active')}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => logout()}
            aria-label={t('signOut')}
            title={t('signOut')}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}