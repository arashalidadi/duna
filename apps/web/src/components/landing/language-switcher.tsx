'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Icon } from './icons';

/** Native names — a language is always listed in its own language. */
const LANGUAGE_LABELS: Record<string, { native: string; code: string }> = {
  en: { native: 'English', code: 'EN' },
  fa: { native: 'فارسی', code: 'FA' },
  ar: { native: 'العربية', code: 'AR' },
};

/**
 * Language switcher.
 *
 * Switching locale uses the locale-aware router, so the current path is kept and
 * only the locale segment changes (next-intl handles the `dir`/font switch on
 * the server-rendered `<html>` element).
 */
export function LanguageSwitcher({
  tone = 'light',
  label,
  className,
}: {
  /** `light` = for dark backgrounds, `dark` = for light backgrounds. */
  tone?: 'light' | 'dark';
  label: string;
  className?: string;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    if (code === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: code });
    });
  };

  const isLight = tone === 'light';

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          isLight
            ? 'border-white/20 bg-white/5 text-white hover:border-white/35 hover:bg-white/10 focus-visible:ring-white/40 focus-visible:ring-offset-brand-950'
            : 'border-brand-200 bg-white text-brand-700 hover:border-brand-300 hover:bg-brand-50 focus-visible:ring-brand-400 focus-visible:ring-offset-white',
          pending && 'opacity-70'
        )}
      >
        <Icon name="languages" className="h-4 w-4" />
        <span className="ltr:tracking-wide">
          {LANGUAGE_LABELS[locale]?.code ?? locale.toUpperCase()}
        </span>
        <Icon
          name="chevron-down"
          className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <div
        role="menu"
        aria-label={label}
        aria-hidden={!open}
        className={cn(
          'absolute end-0 top-[calc(100%+0.5rem)] z-50 w-44 origin-top overflow-hidden rounded-xl border p-1.5 shadow-xl transition-all duration-150',
          isLight
            ? 'border-white/15 bg-brand-950/95 shadow-brand-950/50 backdrop-blur-xl'
            : 'border-brand-100 bg-white shadow-brand-900/10',
          open
            ? 'pointer-events-auto scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
        )}
      >
        {routing.locales.map((code) => {
          const meta = LANGUAGE_LABELS[code];
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              tabIndex={open ? 0 : -1}
              onClick={() => select(code)}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors',
                isLight
                  ? active
                    ? 'bg-white/10 text-white'
                    : 'text-brand-200 hover:bg-white/5 hover:text-white'
                  : active
                    ? 'bg-brand-50 text-brand-900'
                    : 'text-brand-600 hover:bg-brand-50 hover:text-brand-900'
              )}
            >
              <span className="font-medium">{meta?.native ?? code}</span>
              {active ? (
                <Icon name="check" className="h-4 w-4 text-brass-500" strokeWidth={2} />
              ) : (
                <span className="text-[0.625rem] font-semibold tracking-widest opacity-60">
                  {meta?.code}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
