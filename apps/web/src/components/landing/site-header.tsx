'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { BrandLockup } from './brand';
import { Icon } from './icons';
import { LanguageSwitcher } from './language-switcher';

interface NavItem {
  /** Section id on the page. */
  id: string;
  label: string;
}

/**
 * Sticky landing header.
 *
 * The bar is transparent over the hero and turns into a solid navy bar once the
 * page scrolls, so the hero photograph is never cut in half by a chrome band.
 * Section links are highlighted while their section is in view.
 */
export function SiteHeader() {
  const t = useTranslations('home');
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string>('');

  const items: NavItem[] = [
    { id: 'about', label: t('header.nav.about') },
    { id: 'services', label: t('header.nav.services') },
    { id: 'operations', label: t('header.nav.operations') },
    { id: 'fleet', label: t('header.nav.fleet') },
    { id: 'coverage', label: t('header.nav.coverage') },
    { id: 'platform', label: t('header.nav.platform') },
    { id: 'contact', label: t('header.nav.contact') },
  ];

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight the section currently occupying the middle of the viewport.
  React.useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
    // `items` is derived from translations, which are stable for a given locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lock body scroll while the mobile panel is open.
  React.useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        solid
          ? 'border-b border-white/10 bg-brand-950/95 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl'
          : 'border-b border-transparent bg-gradient-to-b from-brand-950/70 to-transparent'
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[80rem] items-center justify-between gap-4 px-5 sm:h-[4.5rem] sm:px-8">
        <Link
          href="/"
          aria-label={t('header.brand')}
          className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950"
        >
          <BrandLockup brand={t('header.brand')} descriptor={t('header.brandSub')} tone="light" />
        </Link>

        <nav aria-label={t('a11y.primaryNav')} className="hidden items-center gap-0.5 xl:flex">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={activeId === item.id ? 'true' : undefined}
              className={cn(
                'relative rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                activeId === item.id ? 'text-white' : 'text-brand-200 hover:text-white'
              )}
            >
              {item.label}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-3 -bottom-0.5 h-px origin-center bg-brass-400 transition-transform duration-300',
                  activeId === item.id ? 'scale-x-100' : 'scale-x-0'
                )}
              />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher
            tone="light"
            label={t('a11y.languageMenu')}
            className="hidden sm:block"
          />

          <Link
            href="/login"
            aria-label={t('a11y.dashboard')}
            className={cn(
              'group inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[0.8125rem] font-semibold transition-all duration-200',
              'bg-brass-500 text-brand-950 hover:bg-brass-400',
              'shadow-[0_10px_30px_-14px_rgba(180,130,50,0.75)]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'
            )}
          >
            <Icon name="activity" className="h-4 w-4" strokeWidth={1.9} />
            <span className="hidden sm:inline">{t('header.dashboard')}</span>
            <span className="sm:hidden">ERP</span>
          </Link>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-controls="site-header-menu"
            aria-label={menuOpen ? t('a11y.closeMenu') : t('a11y.openMenu')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 xl:hidden"
          >
            <Icon name={menuOpen ? 'x' : 'menu'} className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Mobile / tablet panel */}
      <div
        id="site-header-menu"
        className={cn(
          'overflow-hidden border-t border-white/10 bg-brand-950/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 xl:hidden',
          menuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
        )}
        aria-hidden={!menuOpen}
      >
        <nav
          aria-label={t('a11y.primaryNav')}
          className="mx-auto grid w-full max-w-[80rem] gap-1 px-5 py-5 sm:grid-cols-2 sm:px-8"
        >
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-medium text-brand-100 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
              <Icon name="arrow-right" className="h-4 w-4 text-brand-400" />
            </a>
          ))}
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-4 sm:col-span-2">
            <Link
              href="/login"
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-brass-500 px-4 py-2.5 text-sm font-semibold text-brand-950"
            >
              <Icon name="activity" className="h-4 w-4" />
              {t('header.dashboard')}
            </Link>
            <span className="text-xs text-brand-300">{t('header.dashboardNote')}</span>
          </div>
          <div className="pt-2 sm:col-span-2">
            <LanguageSwitcher tone="light" label={t('a11y.languageMenu')} />
          </div>
        </nav>
      </div>
    </header>
  );
}
