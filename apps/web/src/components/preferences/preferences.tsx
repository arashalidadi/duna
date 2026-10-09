'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, Languages, Monitor, Moon, Sun } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useTheme, type Theme } from './theme-provider';

function PreferenceMenu({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const focusLast = useRef(false);
  useEffect(() => {
    if (!open) return;
    const items = root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    items?.[focusLast.current ? items.length - 1 : 0]?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        if (
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          (open && (e.key === 'Home' || e.key === 'End'))
        ) {
          e.preventDefault();
          if (!open) {
            focusLast.current = e.key === 'ArrowUp';
            setOpen(true);
            return;
          }
          const buttons = Array.from(
            root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []
          );
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? buttons.length - 1
                : (current + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length;
          buttons[next]?.focus();
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Button
        ref={trigger}
        variant="ghost"
        onClick={() => {
          focusLast.current = false;
          setOpen(!open);
        }}
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="menu"
        className="gap-2 px-2.5"
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="h-3 w-3" aria-hidden />
      </Button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className="preference-popover absolute end-0 top-full z-40 mt-2 w-44 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl"
        >
          {children(() => {
            setOpen(false);
            trigger.current?.focus();
          })}
        </div>
      )}
    </div>
  );
}
const menuClass =
  'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('workspaceUi');
  return (
    <PreferenceMenu label={t('language')} icon={<Languages className="h-4 w-4" aria-hidden />}>
      {(close) =>
        (['en', 'fa', 'ar'] as const).map((code) => (
          <button
            type="button"
            key={code}
            role="menuitemradio"
            tabIndex={-1}
            aria-checked={locale === code}
            lang={code}
            className={menuClass}
            onClick={() => {
              close();
              router.replace(`${pathname}${window.location.search}${window.location.hash}`, {
                locale: code,
              });
            }}
          >
            <span className="flex-1">{{ en: 'English', fa: 'فارسی', ar: 'العربية' }[code]}</span>
            {locale === code && <Check className="h-4 w-4 text-primary" aria-hidden />}
          </button>
        ))
      }
    </PreferenceMenu>
  );
}
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('workspaceUi');
  const icons = { light: Sun, dark: Moon, system: Monitor };
  const Icon = icons[theme];
  return (
    <PreferenceMenu label={t('appearance')} icon={<Icon className="h-4 w-4" aria-hidden />}>
      {(close) =>
        (['light', 'dark', 'system'] as Theme[]).map((value) => {
          const OptionIcon = icons[value];
          return (
            <button
              type="button"
              key={value}
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={theme === value}
              className={menuClass}
              onClick={() => {
                setTheme(value);
                close();
              }}
            >
              <OptionIcon className="h-4 w-4" aria-hidden />
              <span className="flex-1">{t(value)}</span>
              {theme === value && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </button>
          );
        })
      }
    </PreferenceMenu>
  );
}
