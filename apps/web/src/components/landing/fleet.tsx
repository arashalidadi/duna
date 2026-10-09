import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Reveal } from './reveal';
import { Section, SectionHeading } from './section';

interface FleetItem {
  title: string;
  description: string;
  alt: string;
}

const FLEET_IMAGES = [
  '/images/tug-barge-sea.jpg',
  '/images/heavy-lift.jpg',
  '/images/port-warehouse.jpg',
];

/**
 * Fleet & facilities — photographic proof of the operation: the tug-and-barge
 * combination, lifting capability, and the yard. The middle card is offset on
 * wide screens so the row reads as a composition rather than a table.
 */
export function Fleet() {
  const t = useTranslations('home');
  const items = (t.raw('fleet.items') as FleetItem[] | undefined) ?? [];

  return (
    <Section id="fleet" tone="light">
      <SectionHeading
        eyebrow={t('fleet.eyebrow')}
        title={t('fleet.title')}
        intro={t('fleet.intro')}
        split
        className="mb-14"
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
        {items.map((item, index) => (
          <Reveal
            key={item.title}
            delay={index * 80}
            className={cn('h-full', index === 1 && 'lg:mt-10')}
          >
            <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-[0_18px_40px_-34px_rgba(11,28,45,0.5)]">
              <div className="relative aspect-[4/3] overflow-hidden bg-brand-100">
                <Image
                  src={FLEET_IMAGES[index] ?? FLEET_IMAGES[0]}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 1024px) 26rem, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-base font-semibold leading-snug text-brand-900">
                  {item.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-brand-600">{item.description}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
