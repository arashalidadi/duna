import * as React from 'react';
import { cn } from '@/lib/utils';

/*
 * Status badges — design-system MASTER §2.2. Status is NEVER conveyed by colour alone:
 * the text label is always present; dot is optional. Colours are semantic tokens only.
 */
export type BadgeVariant =
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'outline';

const colorMap: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/12 text-success border-success/25',
  warning: 'bg-warning/12 text-warning border-warning/25',
  danger: 'bg-destructive/10 text-destructive border-destructive/25',
  info: 'bg-info/12 text-info border-info/25',
  neutral: 'bg-muted text-muted-foreground border-border',
  outline: 'bg-transparent text-foreground border-border',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ className, variant = 'default', dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        colorMap[variant],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
