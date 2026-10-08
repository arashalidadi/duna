import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Icon } from './icons';
import { Reveal } from './reveal';
import { Section, SectionHeading } from './section';

interface Feature {
  icon: string;
  title: string;
  text: string;
}

interface Panel {
  title: string;
  text: string;
  roles: string[];
  cta: string;
  secondaryCta: string;
  note: string;
}

/**
 * Platform — what the in-house operations system does for customers, and the
 * dashboard entrance. The dashboard card is the visual anchor of the section:
 * it is the one place on the page that asks for a sign-in.
 */
export function Platform() {
  const t = useTranslations('home');
  const features = (t.raw('platform.features') as Feature[] | undefined) ?? [];
  const panel = t.raw('platform.panel') as Panel | undefined;

  return (
    <Section id="platform" tone="tinted">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <SectionHeading
            eyebrow={t('platform.eyebrow')}
            title={t('platform.title')}
            intro={t('platform.intro')}
            className="mb-12"
          />

          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {features.map((feature, index) => (
              <Reveal as="li" key={feature.title} delay={index * 60}>
                <div className="flex gap-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-white text-brand-700 shadow-[0_10px_20px_-18px_rgba(11,28,45,0.6)]">
                    <Icon name={feature.icon} className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <div>
                    <h3 className="text-[0.9375rem] font-semibold text-brand-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-brand-600">{feature.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        {panel ? (
          <Reveal delay={120} className="lg:col-span-5">
            <div className="relative h-full overflow-hidden rounded-2xl border border-brand-900/10 bg-brand-950 p-7 text-white shadow-[0_36px_70px_-40px_rgba(11,28,45,0.85)] sm:p-8">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brass-500/80 via-brass-300/40 to-transparent"
              />
              <span
                aria-hidden="true"
                className="absolute -end-16 -top-20 h-56 w-56 rounded-full bg-brass-500/10 blur-3xl"
              />

              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-brass-300">
                <Icon name="activity" className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.7} />
              </span>

              <h3 className="mt-5 text-xl font-semibold tracking-tight">{panel.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-200">{panel.text}</p>

              <ul className="mt-6 flex flex-wrap gap-2">
                {panel.roles.map((role) => (
                  <li
                    key={role}
                    className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.6875rem] font-medium text-brand-100"
                  >
                    {role}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3">
                <Link
                  href="/login"
                  className={cn(
                    'group inline-flex items-center justify-center gap-2.5 rounded-lg bg-brass-500 px-6 py-3.5 text-sm font-semibold text-brand-950 transition-all duration-200',
                    'hover:bg-brass-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-950'
                  )}
                >
                  <Icon name="activity" className="h-4 w-4" strokeWidth={1.9} />
                  {panel.cta}
                  <Icon
                    name="arrow-right"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  />
                </Link>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/40 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <Icon name="mail" className="h-4 w-4" />
                  {panel.secondaryCta}
                </a>
              </div>

              <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-brand-300">
                <Icon name="shield-check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-400" />
                {panel.note}
              </p>
            </div>
          </Reveal>
        ) : null}
      </div>
    </Section>
  );
}
