'use client';
import { useTranslations } from 'next-intl';
import { Info, AlertTriangle, CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type AlertVariant = 'info' | 'warning' | 'success' | 'danger';

const variantMap: Record<AlertVariant, { icon: typeof Info; className: string }> = {
  info: {
    icon: Info,
    className: 'border-info/25 bg-info/10 text-foreground',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-warning/30 bg-warning/12 text-foreground',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-success/25 bg-success/10 text-foreground',
  },
  danger: {
    icon: XCircle,
    className: 'border-destructive/25 bg-destructive/10 text-foreground',
  },
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

export function Alert({ variant = 'info', title, children, className, onClose }: AlertProps) {
  const t = useTranslations('common');
  const { icon: Icon, className: variantClass } = variantMap[variant];
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md border px-4 py-3 text-sm',
        variantClass,
        className
      )}
      role="alert"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex-1 space-y-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children}
      </div>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="-me-2 -mt-1 h-6 w-6"
          onClick={onClose}
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
