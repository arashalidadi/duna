import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Icon } from './icons';
import { Reveal } from './reveal';
import { Section, SectionHeading } from './section';

interface PhoneEntry {
  label: string;
  value: string;
  href: string;
}

interface Enquiry {
  title: string;
  text: string;
  items: string[];
  cta: string;
  secondary: string;
}

/**
 * Contact — the commercial close: where the office is, how to reach the
 * operations team, and what an enquiry should contain so it can be quoted.
 */
export function Contact() {
  const t = useTranslations('home');
  const phones = (t.raw('contact.phones') as PhoneEntry[] | undefined) ?? [];
  const enquiry = t.raw('contact.enquiry') as Enquiry | undefined;

  return (
    <Section id="contact" tone="light">
      <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-6">
          <SectionHeading
            eyebrow={t('contact.eyebrow')}
            title={t('contact.title')}
            intro={t('contact.intro')}
            className="mb-10"
          />

          <dl className="divide-y divide-brand-100 border-y border-brand-100">
            <ContactRow icon="building" label={t('contact.addressLabel')}>
              <span className="text-brand-900">{t('contact.address')}</span>
              <span className="mt-1 block text-[0.8125rem] text-brand-500">
                {t('contact.poBoxLabel')}: {t('contact.poBox')}
              </span>
            </ContactRow>

            <ContactRow icon="phone" label={t('contact.phoneLabel')}>
              <span className="flex flex-wrap gap-x-6 gap-y-1">
                {phones.map((phone) => (
                  <a
                    key={phone.href}
                    href={phone.href}
                    className="inline-flex items-center gap-2 text-brand-900 transition-colors hover:text-brass-600"
                  >
                    <span className="text-[0.8125rem] text-brand-500">{phone.label}:</span>
                    <span dir="ltr" className="font-medium tabular-nums nums">
                      {phone.value}
                    </span>
                  </a>
                ))}
              </span>
            </ContactRow>

            <ContactRow icon="mail" label={t('contact.emailLabel')}>
              <a
                href={`mailto:${t('contact.email')}`}
                dir="ltr"
                className="font-medium text-brand-900 transition-colors hover:text-brass-600"
              >
                {t('contact.email')}
              </a>
            </ContactRow>

            <ContactRow icon="globe" label={t('contact.webLabel')}>
              <a
                href={t('contact.webHref')}
                target="_blank"
                rel="noreferrer noopener"
                dir="ltr"
                className="inline-flex items-center gap-2 font-medium text-brand-900 transition-colors hover:text-brass-600"
              >
                {t('contact.web')}
                <Icon name="external-link" className="h-3.5 w-3.5 text-brand-400" />
              </a>
            </ContactRow>
          </dl>

          <p className="mt-6 flex items-center gap-2 text-[0.8125rem] text-brand-500">
            <Icon name="map-pin" className="h-4 w-4 text-brass-500" />
            {t('contact.mapNote')}
          </p>
        </div>

        {enquiry ? (
          <Reveal delay={120} className="lg:col-span-6">
            <div className="relative h-full overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 p-7 sm:p-9">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brass-500/70 via-brass-300/40 to-transparent"
              />
              <h3 className="text-xl font-semibold tracking-tight text-brand-900">
                {enquiry.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-600">{enquiry.text}</p>

              <ul className="mt-7 space-y-3.5">
                {enquiry.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[0.9375rem] text-brand-800">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass-100 text-brass-600">
                      <Icon name="check" className="h-3 w-3" strokeWidth={2.4} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`mailto:${t('contact.email')}?subject=${encodeURIComponent(t('contact.ctaSubject'))}`}
                  className={cn(
                    'group inline-flex items-center justify-center gap-2.5 rounded-lg bg-brand-900 px-6 py-3.5 text-sm font-semibold text-white transition-all duration-200',
                    'hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'
                  )}
                >
                  <Icon name="mail" className="h-4 w-4" />
                  {enquiry.cta}
                </a>
                <Link
                  href="/login"
                  className="group inline-flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-white px-6 py-3.5 text-sm font-semibold text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
                >
                  <Icon name="activity" className="h-4 w-4" />
                  {enquiry.secondary}
                  <Icon
                    name="arrow-right"
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </Reveal>
        ) : null}
      </div>
    </Section>
  );
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-5">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100">
        <Icon name={icon} className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <dt className="text-[0.625rem] font-semibold uppercase tracking-[0.16em] text-brand-500 rtl:tracking-normal">
          {label}
        </dt>
        <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-brand-800">{children}</dd>
      </div>
    </div>
  );
}
