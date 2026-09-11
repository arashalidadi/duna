'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: 'left' | 'right';
  title?: string;
  children?: React.ReactNode;
  className?: string;
  labelledBy?: string;
}

export function Sheet({
  open,
  onOpenChange,
  side = 'right',
  title,
  children,
  className,
  labelledBy,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        ref={panelRef}
        className={cn(
          'absolute top-0 flex h-full flex-col bg-card shadow-lg outline-none',
          'transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-ring',
          side === 'left' ? 'left-0 w-72 border-r' : 'right-0 w-80 border-l',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? 'sheet-title' : undefined)}
        tabIndex={-1}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id="sheet-title" className="text-sm font-semibold">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export const SheetContent = Sheet;
