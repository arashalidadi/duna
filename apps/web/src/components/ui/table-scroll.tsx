'use client';
import type { HTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
/** Keep wide operational tables usable with touch, a mouse or keyboard scrolling. */
export function TableScroll({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations('workspaceUi');
  return (
    <div
      role="region"
      aria-label={t('dataTable')}
      tabIndex={0}
      className={cn(
        'overflow-x-auto rounded-b-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
