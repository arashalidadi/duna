'use client';
import { containDialogFocus } from './dialog-focus';

import { useEffect, useId, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Native top-layer dialog: focus containment, background inertness and focus restoration.
 * The opening effect deliberately depends ONLY on open, never a caller's inline callback.
 * Re-focusing on callback identity changes caused inputs to lose focus on every keystroke.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const t = useTranslations('common');
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      onKeyDown={containDialogFocus}
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      className="app-dialog m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border bg-card p-0 text-card-foreground shadow-2xl"
      onCancel={(e) => {
        e.preventDefault();
        onOpenChange(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onOpenChange(false);
        }
      }}
    >
      {open && (
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-5 sm:px-7">
            <div className="min-w-0 space-y-1.5">
              <h2 id={`${id}-title`} className="text-lg font-semibold">
                {title ?? t('details')}
              </h2>
              {description && (
                <p
                  id={`${id}-description`}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label={t('close')}
              className="shrink-0"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </header>
          <div className="scrollbar-thin min-h-0 overflow-y-auto overscroll-contain px-5 py-6 sm:px-7">
            {children}
          </div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t bg-muted/20 px-5 py-4 sm:px-7">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
export interface ConfirmDialogProps {
  error?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  loading,
  error,
}: ConfirmDialogProps) {
  const t = useTranslations('common');
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!loading) onOpenChange(value);
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('confirm')}
          </Button>
        </>
      }
    >
      {error && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
    </Dialog>
  );
}
