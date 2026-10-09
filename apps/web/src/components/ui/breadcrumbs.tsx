'use client';

import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const t = useTranslations('nav');
  return (
    <nav
      aria-label={t('overview')}
      className={cn('flex flex-wrap items-center gap-1 text-sm text-muted-foreground', className)}
    >
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">{t('dashboard')}</span>
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 rtl:rotate-180" />
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
