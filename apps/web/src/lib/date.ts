/**
 * Jalali (Persian) date utilities — zero-dependency, built on Intl with the
 * Persian calendar. Node >= 14 (full-icu) and all modern browsers support this.
 */

const FA_LOCALE = 'fa-IR-u-ca-persian';
const EN_LOCALE = 'en-GB';

/** Full Jalali date, e.g. "۱۴۰۵/۶/۲۰" / "20 Shahrivar 1405" */
export function formatDate(date: Date | string | number, locale: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? FA_LOCALE : EN_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

/** Short numeric Jalali date, e.g. "۱۴۰۵/۰۶/۲۰" */
export function formatDateShort(date: Date | string | number, locale: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? FA_LOCALE : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Time of day, e.g. "۱۴:۳۲:۰۵" */
export function formatTime(date: Date | string | number, locale: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

/** Date + time together. */
export function formatDateTime(date: Date | string | number, locale: string): string {
  return `${formatDate(date, locale)} · ${formatTime(date, locale)}`;
}

/** ISO-like Jalali key for table sorting, e.g. "1405-06-20". */
export function jalaliDateKey(date: Date | string | number, locale: string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat(locale === 'fa' ? FA_LOCALE : 'en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
