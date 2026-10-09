import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  loading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  outline: 'border border-input bg-card hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
  icon: 'h-10 w-10',
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'default', size = 'default', loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,box-shadow,transform] duration-150 active:translate-y-px',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && (
          <span
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
