'use client';
import { containDialogFocus } from './dialog-focus';
import { useEffect, useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
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
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const t = useTranslations('common');
  useEffect(() => {
    const dialog = ref.current;
    if (open) dialog?.showModal();
    else dialog?.close();
    return () => dialog?.close();
  }, [open]);
  return (
    <dialog
      onKeyDown={containDialogFocus}
      ref={ref}
      aria-labelledby={labelledBy ?? id}
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right) onOpenChange(false);
        }
      }}
      className={cn(
        'app-sheet fixed inset-y-0 m-0 h-dvh max-h-none w-80 max-w-[90vw] border-0 bg-card p-0 text-card-foreground shadow-2xl',
        side === 'left' ? 'left-0 right-auto' : 'right-0 left-auto',
        className
      )}
      data-side={side}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
            <h2 id={id} className="text-sm font-semibold">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label={t('close')}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      )}
    </dialog>
  );
}
export const SheetContent = Sheet;
