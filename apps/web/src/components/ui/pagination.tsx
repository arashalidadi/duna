'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Operational table pagination footer — design-system §7. */
export function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const t = useTranslations('workspaceUi');
  const format = useFormatter();
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5',
        className
      )}
    >
      <span className="text-[13px] tabular-nums text-muted-foreground">
        {t('pagination', { page, pages: totalPages || 1, count: totalItems })}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label={t('previousPage')}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <span className="px-1 text-[13px] tabular-nums text-muted-foreground">
          {format.number(page)}
          {pageSize ? ` · ${t('perPage', { count: pageSize })}` : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label={t('nextPage')}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
