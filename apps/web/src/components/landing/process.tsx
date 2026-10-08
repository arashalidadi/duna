import { useTranslations } from 'next-intl';
import { Reveal } from './reveal';
import { Eyebrow } from './section';

interface Step {
  title: string;
  description: string;
}

/**
 * Operations — the six controlled stages of a shipment.
 *
 * Laid out as a two-column editorial spread: the heading stays with the reader
 * while the stages scroll, joined by a hairline spine with numbered nodes.
 */
export function Process() {
  const t = useTranslations('home');
  const steps = (t.raw('operations.steps') as Step[] | undefined) ?? [];

  return (
    <section
      id="operations"
      className="landing-section relative overflow-hidden bg-brand-950 text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="mx-auto grid w-full max-w-[80rem] gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-12 lg:gap-16 lg:py-28">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <Reveal>
              <Eyebrow tone="dark">{t('operations.eyebrow')}</Eyebrow>
              <h2 className="display-tight display-balance mt-5 text-3xl font-semibold leading-[1.14] tracking-tight sm:text-4xl">
                {t('operations.title')}
              </h2>
              <p className="mt-6 text-[0.9375rem] leading-relaxed text-brand-200">
                {t('operations.intro')}
              </p>
            </Reveal>
          </div>
        </div>

        <ol className="relative lg:col-span-8">
          {/* spine */}
          <span
            aria-hidden="true"
            className="absolute bottom-3 top-3 start-[0.9375rem] w-px bg-gradient-to-b from-brass-500/70 via-white/15 to-transparent"
          />
          {steps.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 50}>
              <div className="group relative flex gap-6 pb-9 last:pb-0">
                <span className="relative z-10 mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-brand-900 text-[0.6875rem] font-semibold tabular-nums text-brass-300 transition-colors duration-300 group-hover:border-brass-400/60">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 border-b border-white/10 pb-9 transition-colors duration-300 group-hover:border-white/20 last:border-0 last:pb-0">
                  <h3 className="text-lg font-semibold leading-snug text-white">{step.title}</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-200">
                    {step.description}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
