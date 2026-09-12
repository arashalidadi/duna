import { defineRouting } from 'next-intl/routing';

/** Locales supported by the app. `fa` is the default (client is Persian-first). */
export const locales = ['fa', 'en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'fa',
  localePrefix: 'always',
});

/** Direction per locale — used for `dir` on <html> and logical layout flips. */
export function dirFor(locale: string): 'rtl' | 'ltr' {
  return locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr';
}
