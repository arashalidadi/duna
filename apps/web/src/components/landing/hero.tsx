import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Icon } from './icons';
import { CtaLink } from './section';

interface HeroFact {
  icon: string;
  label: string;
  value: string;
}

/**
 * Hero — full-bleed port photograph, one clear proposition, and the dashboard
 * entrance. The only above-the-fold animation (`hero-rise`) is pure CSS so the
 * headline never waits for JavaScript.
 */
export function Hero() {
  const t = useTranslations('home');
  const facts = (t.raw('hero.facts') as HeroFact[] | undefined) ?? [];

  return (
    <>
      <section
        id="hero"
        className="landing-section relative isolate overflow-hidden bg-brand-950 text-white"
      >
        <div className="absolute inset-0 -z-10">
          <Image
            src="/images/hero-port-dusk.jpg"
            alt={t('hero.imageAlt')}
            fill
            priority
            sizes="100vw"
            quality={78}
            className="hero-pan object-cover object-center"
          />
          <div className="hero-scrim-bottom absolute inset-0" aria-hidden="true" />
          <div className="hero-scrim-side absolute inset-0 hidden lg:block" aria-hidden="true" />
        </div>

        <div className="mx-auto flex min-h-[36rem] w-full max-w-[80rem] flex-col justify-end px-5 pt-32 pb-32 sm:min-h-[40rem] sm:px-8 sm:pb-36 lg:min-h-[46rem] lg:pb-44">
          <div className="hero-rise max-w-3xl">
            <p className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-brand-100 backdrop-blur rtl:tracking-normal">
              <span
                className="h-1.5 w-1.5 rounded-full bg-brass-400 soft-pulse"
                aria-hidden="true"
              />
              {t('hero.eyebrow')}
            </p>

            <h1 className="display-tight display-balance mt-6 text-[2.15rem] font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.75rem]">
              <span className="block text-white">{t('hero.titleTop')}</span>
              <span className="mt-2 block text-brass-300">{t('hero.titleAccent')}</span>
            </h1>

            <p className="mt-7 max-w-2xl text-[0.9375rem] leading-relaxed text-brand-100/85 sm:text-lg">
              {t('hero.subtitle')}
            </p>

            <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/login"
                className={cn(
                  'group inline-flex items-center justify-center gap-2.5 rounded-lg bg-brass-500 px-7 py-4 text-sm font-semibold text-brand-950 transition-all duration-200',
                  'shadow-[0_18px_40px_-18px_rgba(180,130,50,0.85)] hover:bg-brass-400',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'
                )}
              >
                <Icon name="activity" className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.9} />
                {t('hero.primaryCta')}
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                />
              </Link>

              <CtaLink href="#services" variant="ghost-light" icon="chevron-down">
                {t('hero.secondaryCta')}
              </CtaLink>
            </div>

            <p className="mt-4 text-xs text-brand-200/80">{t('hero.primaryCtaNote')}</p>
          </div>
        </div>
      </section>

      {/* Capability strip — floats over the seam between the hero and the page. */}
      <div className="relative z-20 mx-auto -mt-24 w-full max-w-[80rem] px-5 sm:-mt-28 sm:px-8 lg:-mt-32">
        <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/15 bg-brand-950/90 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:grid-cols-2 lg:grid-cols-4">
          {facts.map((fact, index) => (
            <div
              key={fact.value}
              className={cn(
                'flex items-start gap-4 px-6 py-5 lg:py-6',
                // Dividers per breakpoint: 1 column on mobile, 2 on tablet, 4 on desktop.
                [
                  '',
                  'border-t border-white/10 sm:border-t-0 sm:border-s',
                  'border-t border-white/10 lg:border-t-0 lg:border-s',
                  'border-t border-white/10 sm:border-s lg:border-t-0',
                ][index]
              )}
            >
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brass-400/25 bg-brass-400/10 text-brass-300">
                <Icon name={fact.icon} className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-brand-300 rtl:tracking-normal">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 text-sm font-medium leading-snug text-white">{fact.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
