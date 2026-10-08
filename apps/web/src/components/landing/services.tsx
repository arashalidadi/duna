import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { Reveal } from './reveal';
import { Section, SectionHeading } from './section';

interface Service {
  icon: string;
  title: string;
  description: string;
  tags?: string[];
}

/**
 * Services — the six things a customer actually buys. Cards are deliberately
 * plain white with a hairline ring, a brass top rule on hover, and no icon
 * theatre: the density of the copy should carry the section.
 */
export function Services() {
  const t = useTranslations('home');
  const items = (t.raw('services.items') as Service[] | undefined) ?? [];

  return (
    <Section id="services" tone="tinted">
      <SectionHeading
        eyebrow={t('services.eyebrow')}
        title={t('services.title')}
        intro={t('services.intro')}
        split
        className="mb-14"
      />

      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((service, index) => (
          <Reveal as="li" key={service.title} delay={index * 60} className="h-full">
            <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brass-200 hover:shadow-[0_28px_50px_-30px_rgba(11,28,45,0.4)]">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-brass-500 to-brass-200 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right"
              />
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-900 text-brass-300 transition-colors duration-300 group-hover:bg-brand-800">
                <Icon name={service.icon} className="h-[1.35rem] w-[1.35rem]" strokeWidth={1.6} />
              </span>

              <h3 className="mt-5 text-base font-semibold leading-snug text-brand-900">
                {service.title}
              </h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-brand-600">
                {service.description}
              </p>

              {service.tags && service.tags.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-1.5 border-t border-brand-100 pt-4">
                  {service.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-md bg-brand-50 px-2.5 py-1 text-[0.6875rem] font-medium text-brand-700"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
