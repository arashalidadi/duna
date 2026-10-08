import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/i18n/routing';
import { AuthGate } from '@/components/landing/auth-gate';
import { SiteHeader } from '@/components/landing/site-header';
import { Hero } from '@/components/landing/hero';
import { Company } from '@/components/landing/company';
import { Services } from '@/components/landing/services';
import { Process } from '@/components/landing/process';
import { Fleet } from '@/components/landing/fleet';
import { Coverage } from '@/components/landing/coverage';
import { Platform } from '@/components/landing/platform';
import { Contact } from '@/components/landing/contact';
import { SiteFooter } from '@/components/landing/site-footer';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  const title = t('title');
  const description = t('description');

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((code) => [code, `/${code}`])),
    },
    openGraph: {
      type: 'website',
      siteName: 'Duna Shipping',
      locale,
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * Public landing page.
 *
 * A server component: the whole page is rendered per locale (English, Persian
 * and Arabic, with `dir` set on `<html>` by the locale layout) and is static
 * apart from the header interactions and the scroll reveals.
 */
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'home' });

  return (
    <div className="min-h-screen bg-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-950 focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-brass-400"
      >
        {t('a11y.skipToContent')}
      </a>

      <AuthGate />
      <SiteHeader />

      <main id="main">
        <Hero />
        <Company />
        <Services />
        <Process />
        <Fleet />
        <Coverage />
        <Platform />
        <Contact />
      </main>

      <SiteFooter />
    </div>
  );
}
