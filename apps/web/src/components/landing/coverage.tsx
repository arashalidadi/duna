import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { Reveal } from './reveal';
import { Eyebrow } from './section';

interface CoverageGroup {
  region: string;
  role: string;
  ports: string[];
}

/**
 * Coverage — the ports and destinations Duna Shipping actually trades to,
 * grouped by role in the lane (origin hub / Gulf destinations / free zones).
 * Presented over the dark network image so the section reads as the network view.
 */
export function Coverage() {
  const t = useTranslations('home');
  const groups = (t.raw('coverage.groups') as CoverageGroup[] | undefined) ?? [];

  return (
    <section
      id="coverage"
      className="landing-section relative isolate overflow-hidden bg-brand-950 text-white"
    >
      <div className="absolute inset-0 -z-10">
        <Image
          src="/images/operations-network.jpg"
          alt={t('coverage.imageAlt')}
          fill
          sizes="100vw"
          className="object-cover opacity-45"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-brand-950/90 via-brand-950/85 to-brand-950"
        />
      </div>

      <div className="mx-auto w-full max-w-[80rem] px-5 py-20 sm:px-8 sm:py-24 lg:py-28">
        <Reveal className="max-w-3xl">
          <Eyebrow tone="dark">{t('coverage.eyebrow')}</Eyebrow>
          <h2 className="display-tight display-balance mt-5 text-3xl font-semibold leading-[1.14] tracking-tight sm:text-4xl">
            {t('coverage.title')}
          </h2>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-brand-200">
            {t('coverage.intro')}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {groups.map((group, index) => (
            <Reveal key={group.region} delay={index * 90}>
              <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md transition-colors duration-300 hover:border-brass-400/35">
                <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-4">
                  <h3 className="text-base font-semibold text-white">{group.region}</h3>
                  <span className="shrink-0 text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-brass-300 rtl:tracking-normal">
                    {group.role}
                  </span>
                </div>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {group.ports.map((port) => (
                    <li
                      key={port}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-brand-900/60 px-3 py-1.5 text-[0.8125rem] font-medium text-brand-100"
                    >
                      <Icon name="map-pin" className="h-3.5 w-3.5 text-brass-400" />
                      {port}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <p className="mt-10 max-w-3xl text-[0.8125rem] leading-relaxed text-brand-300">
            {t('coverage.note')}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
