import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/** Form label — design-system §9: text-xs font-medium above the field. */
function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn('text-xs font-medium text-foreground leading-none', className)}
      {...props}
    />
  );
}

export { Label };