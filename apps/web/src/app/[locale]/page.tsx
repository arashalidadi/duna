'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale, useMessages } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Icon } from '@/components/home/icons';
import { cn } from '@/lib/utils';

type ServiceItem = { name: string; desc: string; icon: string };
type CapabilityItem = { title: string; desc: string; icon: string };

/* ---------- shared sectioning helpers ---------- */

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-12">
      <p className="micro-label text-muted-foreground animate-fade-in">
        {eyebrow}
      </p>
      <h2 className="mt-2 animate-fade-in animate-delay-100 text-2xl font-bold text-foreground">
        {title}
      </h2>
    </div>
  );
}

/* ---------- navbar ---------- */

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('home');
  return (
    <div
      className={cn(
        'absolute right-4 left-4 top-16 z-40 overflow-hidden rounded-lg border bg-card shadow-lg transition-all duration-200',
        open ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
      )}
    >
      <div className="flex flex-col gap-1 p-4">
        <Link
          href="#about"
          className="rounded-md px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          {t('nav.about')}
        </Link>
        <Link
          href="#services"
          className="rounded-md px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          {t('nav.services')}
        </Link>
        <Link
          href="#capabilities"
          className="rounded-md px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          {t('capabilities.title')}
        </Link>
        <Link
          href="#coverage"
          className="rounded-md px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          {t('coverage.title')}
        </Link>
        <Link
          href="#contact"
          className="rounded-md px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
          onClick={onClose}
        >
          {t('nav.contact')}
        </Link>
        <div className="mt-4 pt-4 border-t">
          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="arrow-right" className="h-4 w-4" />
            {t('nav.login')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const tHomeNav = useTranslations('home');

  const locales: { code: string; label: string }[] = [
    { code: 'fa', label: tHomeNav('nav.switchToPersian') },
    { code: 'en', label: tHomeNav('nav.switchToEnglish') },
    { code: 'ar', label: tHomeNav('nav.switchToArabic') },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
      {locales.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => router.push('/', { locale: code })}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            locale === code
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={`Switch to ${label}`}
          aria-current={locale === code ? 'true' : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Navbar() {
  const t = useTranslations('home');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-3 sm:px-6">
        {/* brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-foreground transition-colors hover:text-primary"
        >
          <svg
            className="h-8 w-8 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 20l5-5 3 3 8-9 6 7-3 3-6-5-5 6-1 1-9 1 3-5z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <span className="hidden sm:block text-lg font-semibold tracking-tight">
            {t('nav.brand')}
          </span>
          <span className="sm:hidden text-lg font-semibold tracking-tight">د</span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 sm:gap-2 sm:flex">
          <NavLink href="#about" label={t('nav.about')} />
          <NavLink href="#services" label={t('nav.services')} />
          <NavLink href="#capabilities" label={t('capabilities.title')} />
          <NavLink href="#coverage" label={t('coverage.title')} />
        </nav>

        {/* right: lang switcher + login */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            href="/login"
            className="hidden items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            <Icon name="arrow-right" className="h-4 w-4" />
            {t('nav.login')}
          </Link>
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted sm:hidden"
            aria-label="منوی موبایل"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <Icon name="x" className="h-5 w-5" /> : <Icon name="menu" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </Link>
  );
}

/* ---------- hero ---------- */

function Hero() {
  const t = useTranslations('home');

  return (
    <section className="relative overflow-hidden bg-[#0A1628] text-white">
      {/* background gradient + subtle pattern */}
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -10%, hsla(217,91%,55%,0.18) 0%, transparent 60%),
              radial-gradient(ellipse 60% 40% at 80% 80%, hsla(217,24%,93%,0.08) 0%, transparent 60%)
            `,
          }}
        />
        {/* horizon line motif */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          viewBox="0 0 1200 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M0,100 C200,40 400,160 600,100 C800,40 1000,160 1200,100 L1200,200 L0,200 Z"
          />
        </svg>
      </div>

      {/* grid lines for depth */}
      <div className="absolute inset-0 -z-10 bg-[length:40px_40px] bg-[linear-gradient(to_right,hsla(0,0%,100%,0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsla(0,0%,100%,0.03)_1px,transparent_1px)]" />

      <div className="relative mx-auto max-w-[1440px] px-4 py-20 sm:py-28 lg:py-36">
        <div className="mx-auto max-w-3xl">
          {/* eyebrow */}
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-sm text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t('hero.tag')}
          </span>

          {/* headline */}
          <h1 className="mx-auto mb-6 max-w-3xl text-center sm:text-left text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            {t('hero.title').split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/70 text-center sm:text-left">
            {t('hero.subtitle')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-xl hover:-translate-y-0.5"
            >
              <Icon name="arrow-right" className="h-5 w-5" />
              {t('hero.ctaPrimary')}
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-white/5 px-7 py-3.5 text-base font-medium text-white transition-all hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:justify-start"
            >
              <Icon name="arrow-right" className="h-5 w-5 rotate-180" />
              {t('hero.ctaSecondary')}
            </a>
          </div>

          {/* stats row */}
          <div className="mt-14 flex flex-wrap justify-center gap-8 sm:justify-between text-center sm:text-left">
            {([
              { label: t('hero.stats.years'), value: '10+' },
              { label: t('hero.stats.destinations'), value: '12+' },
              { label: t('hero.stats.shipments'), value: '500+' },
            ] as const).map((stat) => (
              <div key={stat.label} className="flex flex-col">
                <span className="text-2xl font-bold text-white">{stat.value}</span>
                <span className="text-sm text-white/60">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right visual: abstract ship/route illustration */}
        <div className="relative mt-16 hidden lg:block">
          <div className="mx-auto h-80 w-full max-w-lg">
            {/* concentric route arcs */}
            <svg
              className="absolute inset-0 h-full w-full text-primary/20"
              viewBox="0 0 400 300"
              aria-hidden="true"
            >
              <circle cx="200" cy="150" r="120" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
              <circle cx="200" cy="150" r="80" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5" />
              <circle cx="200" cy="150" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 4" />
              <path d="M200 30 L200 270 M30 150 L370 150" stroke="currentColor" strokeWidth="1" strokeDasharray="2 8" />
              <circle cx="200" cy="150" r="4" fill="currentColor" />
              <circle cx="300" cy="100" r="3" fill="currentColor" />
              <circle cx="100" cy="200" r="3" fill="currentColor" />
              <circle cx="280" cy="220" r="2.5" fill="currentColor" />
              {([
                [320, 120],
                [80, 80],
                [340, 200],
                [60, 220],
              ] as const).map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="2" fill="currentColor" opacity="0.6" />
              ))}
            </svg>
            {/* ship icon, large, subtle */}
            <div className="absolute right-4 bottom-8 text-primary/40">
              <Icon name="ship" className="h-20 w-20" />
            </div>
            {/* globe accent */}
            <div className="absolute left-6 top-6 text-primary/30">
              <Icon name="globe" className="h-16 w-16" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- about ---------- */

function About() {
  const t = useTranslations('home');

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={t('about.eyebrow')} title={t('about.title')} />

        <div className="mx-auto grid max-w-4xl gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <p className="text-base leading-relaxed text-muted-foreground">
              {t('about.paragraph')}
            </p>
          </div>
          <div className="order-1 lg:order-2 grid grid-cols-2 gap-4">
            {Object.entries(t('about.values')).map(([key, value]) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon name="check" className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- services ---------- */

function Services() {
  const t = useTranslations('home.services');
  const raw = (useMessages() as unknown as Record<string, unknown>)['home']?.['services']?.['services'];
  const services: ServiceItem[] = Array.isArray(raw) ? raw : [];
  const eyebrow = t('eyebrow');
  const title = t('title');

  return (
    <section className="border-t bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} />

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => (
            <article
              key={service.name}
              className="group relative rounded-lg border bg-card p-6 shadow-sm transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-1"
            >
              {/* icon */}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon name={service.icon as 'warehouse'} className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-foreground">{service.name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{service.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- capabilities ---------- */

function Capabilities() {
  const t = useTranslations('home.capabilities');
  const allMessages = useMessages() as unknown as Record<string, unknown>;
  const raw = allMessages['home']?.['capabilities']?.['items'];
  const items: CapabilityItem[] = Array.isArray(raw) ? raw : [];
  const eyebrow = t('eyebrow');
  const title = t('title');

  return (
    <section className="border-t bg-muted/20">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} />

        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-sm"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-info/10 text-info">
                <Icon name={item.icon as 'globe'} className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- coverage ---------- */

function Coverage() {
  const t = useTranslations('home.coverage');
  const allMessages = useMessages();
  const raw = allMessages['home']?.['coverage']?.['ports'];
  const ports: string[] = Array.isArray(raw) ? raw : [];
  const coverageTitle = t('title');
  const coverageEyebrow = t('eyebrow');

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={coverageEyebrow} title={coverageTitle} />

        <p className="mx-auto mb-10 max-w-2xl text-center text-base leading-relaxed text-muted-foreground">
          {t('intro')}
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          {ports.map((port) => (
            <span
              key={port}
              className="rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary"
            >
              {port}
            </span>
          ))}
        </div>

        {/* route map abstract */}
        <div className="mt-12 relative overflow-hidden rounded-lg border bg-background p-6 sm:p-8">
          <div className="mb-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Icon name="map-pin" className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {coverageEyebrow}
            </span>
          </div>
          <svg
            className="mx-auto h-48 w-full max-w-md text-muted-foreground"
            viewBox="0 0 600 200"
            aria-hidden="true"
          >
            {/* route lines */}
            <path
              d="M50 150 Q150 50 300 100 T550 120"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="6 4"
              opacity="0.4"
            />
            <path
              d="M50 150 Q200 120 350 80 T550 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 5"
              opacity="0.3"
            />
            {/* port dots */}
            {([
              [50, 150],
              [150, 90],
              [300, 100],
              [400, 70],
              [550, 120],
            ] as const).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r="5" fill="currentColor" />
            ))}
            {/* labels */}
            <text x={50} y={170} fontSize="10" fill="currentColor" opacity="0.6">
              {ports[0]}
            </text>
            <text x={150} y={110} fontSize="10" fill="currentColor" opacity="0.6">
              {ports[1]}
            </text>
            <text x={300} y={120} fontSize="10" fill="currentColor" opacity="0.6">
              {ports[2]}
            </text>
            <text x={400} y={90} fontSize="10" fill="currentColor" opacity="0.6">
              {ports[3]}
            </text>
            <text x={550} y={140} fontSize="10" fill="currentColor" opacity="0.6">
              {ports[4]}
            </text>
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ---------- CTA ---------- */

function CTA() {
  const t = useTranslations('home');

  return (
    <section className="border-t bg-[#0A1628] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1 text-sm text-white/80">
            <Icon name="arrow-right" className="h-4 w-4" />
            {t('cta.title')}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">
            {t('cta.subtitle')}
          </h2>
          <p className="mt-4 text-base text-white/60">
            دسترسی به فضای کاری کامل دونا — بارگیری، بارنامه، مانیفست، فاکتور و حسابداری — از یکجا.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:shadow-xl"
            >
              <Icon name="arrow-right" className="h-5 w-5" />
              {t('cta.button')}
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 bg-transparent px-8 py-3.5 text-base font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon name="mail" className="h-5 w-4" />
              تماس با ما
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- footer ---------- */

function Footer() {
  const t = useTranslations('home');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 20l5-5 3 3 8-9 6 7-3 3-6-5-5 6-1 1-9 1 3-5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-semibold text-foreground">{t('footer.brand')}</span>
          </div>
          <p className="text-center text-[0.8125rem] text-muted-foreground sm:text-right">
            {t('footer.legal').replace('{year}', String(year))}
          </p>
          <nav className="flex flex-wrap justify-center gap-4 sm:justify-end">
            <NavLink href="#about" label={t('footer.links.about')} />
            <NavLink href="#services" label={t('footer.links.services')} />
            <NavLink href="#contact" label={t('footer.links.contact')} />
            <NavLink href="/login" label={t('footer.links.login')} />
          </nav>
        </div>
      </div>
    </footer>
  );
}

/* ---------- page ---------- */

export default function LandingPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden="true"
        />
        <span className="sr-only">در حال بارگذاری…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <About />
      <Services />
      <Capabilities />
      <Coverage />
      <CTA />
      <Footer />
    </div>
  );
}
