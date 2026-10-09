'use client';
import { useTranslations } from 'next-intl';
/** Presentation only. Never translate enum values sent to the API or business record names. */
export function DomainLabel({ value }: { value: string }) {
  const t = useTranslations('domainLabels');
  const key = value.toUpperCase().replace(/[\s/-]+/g, '_');
  return <>{t.has(key) ? t(key) : value}</>;
}
