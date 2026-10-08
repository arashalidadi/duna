import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { Reveal } from './reveal';
import { Section, SectionHeading } from './section';

interface Pillar {
  icon: string;
  title: string;
  text: string;
}

/** Company section — who Duna Shipping is, and the operating principles behind it. */
export function Company() {
  const t = useTranslations('home');
  const pillars = (t.raw('about.pillars') as Pillar[] | undefined) ?? [];

  return (
    <Section id="about" tone="light">
      <div className="grid gap-14 lg:grid-cols-12 lg:items-start lg:gap-16">
        <div className="lg:col-span-7">
          <SectionHeading eyebrow={t('about.eyebrow')} title={t('about.title')} className="mb-0" />
          <Reveal delay={80}>
            <p className="mt-6 max-w-2xl text-[0.9375rem] leading-relaxed text-brand-600 sm:text-base">
              {t('about.body')}
            </p>
          </Reveal>

          <ul className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {pillars.map((pillar, index) => (
              <Reveal as="li" key={pillar.title} delay={120 + index * 70}>
                <div className="flex gap-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon name={pillar.icon} className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <div>
                    <h3 className="text-[0.9375rem] font-semibold text-brand-900">
                      {pillar.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-brand-600">{pillar.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <Reveal delay={140} className="lg:col-span-5">
          <div className="relative">
            {/* offset frame — a quiet nod to stacked shipping documents.
                Offsets stay inside the section padding so nothing overflows. */}
            <span
              aria-hidden="true"
              className="absolute -start-3 -top-3 bottom-10 end-10 rounded-2xl border border-brass-200/70"
            />
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-100 shadow-[0_30px_60px_-35px_rgba(11,28,45,0.55)] sm:aspect-[5/5]">
              <Image
                src="/images/cargo-yard.jpg"
                alt={t('about.imageAlt')}
                fill
                sizes="(min-width: 1024px) 34rem, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent"
              />
              <div className="absolute inset-x-5 bottom-5 flex items-center gap-4 rounded-xl border border-white/15 bg-brand-950/80 px-5 py-4 backdrop-blur-md">
                <span className="text-2xl font-semibold text-brass-300">
                  {t('about.badge.value')}
                </span>
                <span className="text-[0.8125rem] font-medium leading-snug text-brand-100">
                  {t('about.badge.label')}
                </span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
