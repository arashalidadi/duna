import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

/**
 * Single-line text/number/password input. Style per design-system §9 Forms:
 * h-9 rounded-md border-input, visible focus ring, error styling applied by the
 * caller via `aria-invalid` + error classes.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground transition-colors',
          'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-destructive/50 focus-visible:aria-invalid:ring-destructive/40',
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };