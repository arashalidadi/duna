import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { BrandLockup } from './brand';
import { Icon } from './icons';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
};

/**
 * Site footer.
 *
 * Locale links are plain links rendered on the server — switching language from
 * the footer needs no JavaScript at all.
 */
export function SiteFooter() {
  const t = useTranslations('home');
  const locale = useLocale();
  const year = new Date().getFullYear();

  const groups: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.links.about'), href: '#about' },
        { label: t('footer.links.operations'), href: '#operations' },
        { label: t('footer.links.fleet'), href: '#fleet' },
        { label: t('footer.links.coverage'), href: '#coverage' },
      ],
    },
    {
      title: t('footer.services'),
      links: [
        { label: t('footer.links.services'), href: '#services' },
        { label: t('footer.links.quotation'), href: '#contact' },
      ],
    },
    {
      title: t('footer.platform'),
      links: [
        { label: t('footer.links.platform'), href: '#platform' },
        { label: t('footer.links.dashboard'), href: '/login' },
      ],
    },
    {
      title: t('footer.contact'),
      links: [{ label: t('footer.links.contact'), href: '#contact' }],
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-brand-950 text-white">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brass-500/40 to-transparent"
      />
      <div className="mx-auto w-full max-w-[80rem] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <BrandLockup brand={t('footer.brand')} tone="light" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-brand-300">
              {t('footer.tagline')}
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-brand-200">
              <li className="flex items-start gap-2.5">
                <Icon name="map-pin" className="mt-0.5 h-4 w-4 shrink-0 text-brass-400" />
                {t('footer.location')}
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="mail" className="h-4 w-4 shrink-0 text-brass-400" />
                <a
                  href={`mailto:${t('contact.email')}`}
                  dir="ltr"
                  className="transition-colors hover:text-white"
                >
                  {t('contact.email')}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Icon name="phone" className="h-4 w-4 shrink-0 text-brass-400" />
                <a
                  href="tel:+97142527707"
                  dir="ltr"
                  className="tabular-nums nums transition-colors hover:text-white"
                >
                  +971 4 252 7707
                </a>
              </li>
            </ul>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-4">
            {groups.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-400 rtl:tracking-normal">
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((link) =>
                    link.href.startsWith('#') ? (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-brand-200 transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="inline-flex items-center gap-1.5 text-sm text-brand-200 transition-colors hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </li>
                    )
                  )}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          {/* `{year}` is an ICU argument — pass it so each locale formats it natively. */}
          <p className="text-xs text-brand-400">{t('footer.rights', { year })}</p>

          <nav aria-label={t('a11y.languageMenu')} className="flex flex-wrap items-center gap-1">
            {routing.locales.map((code) => {
              const active = code === locale;
              return (
                <Link
                  key={code}
                  href="/"
                  locale={code}
                  hrefLang={code}
                  aria-current={active ? 'true' : undefined}
                  className={
                    active
                      ? 'rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold text-white'
                      : 'rounded-md px-3 py-1.5 text-xs font-medium text-brand-300 transition-colors hover:bg-white/5 hover:text-white'
                  }
                >
                  {LANGUAGE_LABELS[code] ?? code}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </footer>
  );
}
