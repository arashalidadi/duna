'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-reveal wrapper.
 *
 * Content is server-rendered (good for SEO and first paint) and simply starts
 * hidden via the `.reveal` class in globals.css. Once the element enters the
 * viewport the observer flips `data-visible` and the element animates in. The
 * observer disconnects after the first reveal — no scroll listeners.
 *
 * Reduced motion is honoured in CSS, and `@media (scripting: none)` keeps the
 * content visible when JavaScript never runs.
 */
export function Reveal({
  children,
  /** Stagger in milliseconds for lists of revealed siblings. */
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'li' | 'section' | 'article';
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      data-visible={visible ? 'true' : undefined}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
      className={cn('reveal', className)}
    >
      {children}
    </Tag>
  );
}
