import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from './icons';
import { Reveal } from './reveal';

/**
 * Section shell — the shared rhythm for every landing section.
 *
 * `tone` switches between the light canvas, a tinted band and the deep navy
 * band used by the process and coverage sections.
 */
export function Section({
  id,
  children,
  className,
  tone = 'light',
  size = 'default',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: 'light' | 'tinted' | 'dark' | 'plain';
  size?: 'default' | 'compact';
}) {
  const tones: Record<'light' | 'tinted' | 'dark' | 'plain', string> = {
    light: 'bg-white text-brand-900',
    tinted: 'bg-brand-50 text-brand-900',
    dark: 'bg-brand-950 text-white',
    plain: '',
  };

  return (
    <section id={id} className={cn('landing-section relative', tones[tone], className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-[80rem] px-5 sm:px-8',
          size === 'compact' ? 'py-14 sm:py-16' : 'py-20 sm:py-24 lg:py-28'
        )}
      >
        {children}
      </div>
    </section>
  );
}

/**
 * Section heading: eyebrow rule + title + optional introduction.
 * `align` moves the whole block; `split` puts the intro in a second column,
 * which gives long sections an editorial, magazine-like opening.
 */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  tone = 'light',
  align = 'start',
  split = false,
  className,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  tone?: 'light' | 'dark';
  align?: 'start' | 'center';
  split?: boolean;
  className?: string;
}) {
  const isDark = tone === 'dark';
  const centered = align === 'center';

  const heading = (
    <div className={cn(centered && 'mx-auto max-w-3xl text-center')}>
      <Eyebrow tone={tone} centered={centered}>
        {eyebrow}
      </Eyebrow>
      <h2
        className={cn(
          'display-tight display-balance mt-5 text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]',
          isDark ? 'text-white' : 'text-brand-900'
        )}
      >
        {title}
      </h2>
    </div>
  );

  if (split && intro) {
    return (
      <Reveal className={className}>
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="lg:col-span-7">{heading}</div>
          <p
            className={cn(
              'text-base leading-relaxed lg:col-span-5 lg:pb-1.5',
              isDark ? 'text-brand-200' : 'text-brand-600'
            )}
          >
            {intro}
          </p>
        </div>
      </Reveal>
    );
  }

  return (
    <Reveal className={className}>
      {heading}
      {intro ? (
        <p
          className={cn(
            'mt-6 text-base leading-relaxed',
            centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl',
            isDark ? 'text-brand-200' : 'text-brand-600'
          )}
        >
          {intro}
        </p>
      ) : null}
    </Reveal>
  );
}

/** Eyebrow: a brass rule + micro-label, the recurring "kicker" of the design. */
export function Eyebrow({
  children,
  tone = 'light',
  centered = false,
  className,
}: {
  children: React.ReactNode;
  tone?: 'light' | 'dark';
  centered?: boolean;
  className?: string;
}) {
  const isDark = tone === 'dark';
  return (
    <p
      className={cn(
        'flex items-center gap-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] rtl:tracking-normal',
        centered && 'justify-center',
        isDark ? 'text-brass-400' : 'text-brass-600',
        className
      )}
    >
      <span
        className={cn('h-px w-8 shrink-0', isDark ? 'bg-brass-400/60' : 'bg-brass-500/60')}
        aria-hidden="true"
      />
      {children}
    </p>
  );
}

/**
 * Primary landing CTA. Deliberately a real link (`<a>`/`<Link>`) so it is
 * crawlable, keyboard reachable and works without JavaScript.
 */
export function CtaLink({
  children,
  href,
  variant = 'brass',
  className,
  icon = 'arrow-right',
  external = false,
  ...rest
}: {
  children: React.ReactNode;
  href: string;
  variant?: 'brass' | 'navy' | 'outline' | 'ghost-light' | 'ghost-dark';
  className?: string;
  icon?: string | null;
  external?: boolean;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const variants: Record<string, string> = {
    brass:
      'bg-brass-500 text-brand-950 hover:bg-brass-400 shadow-[0_10px_30px_-12px_rgba(180,130,50,0.65)]',
    navy: 'bg-brand-900 text-white hover:bg-brand-800 shadow-[0_10px_30px_-14px_rgba(11,28,45,0.75)]',
    outline:
      'border border-brand-200 bg-white text-brand-800 hover:border-brand-300 hover:bg-brand-50',
    'ghost-light':
      'border border-white/25 bg-white/5 text-white backdrop-blur hover:border-white/40 hover:bg-white/10',
    'ghost-dark': 'border border-brand-200 text-brand-800 hover:bg-brand-50',
  };

  // Buttons that sit on the dark bands need a light focus ring, the ones on the
  // light canvas a navy one.
  const onDark = variant === 'brass' || variant === 'ghost-light';

  return (
    <a
      href={href}
      className={cn(
        'group inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        onDark
          ? 'focus-visible:ring-brass-400 focus-visible:ring-offset-brand-950'
          : 'focus-visible:ring-brand-500 focus-visible:ring-offset-white',
        variants[variant],
        className
      )}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
      {...rest}
    >
      {children}
      {icon ? (
        <Icon
          name={icon}
          className={cn(
            'h-4 w-4',
            // Only the "onward" arrow drifts; a scroll chevron stays put.
            icon === 'arrow-right' &&
              'transition-transform duration-200 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5'
          )}
        />
      ) : null}
    </a>
  );
}
