'use client';
import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
  type ReactElement,
} from 'react';
import { Label } from './label';
/** Stable field identity: labels and inputs remain associated across form updates. */
export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  const generated = useId();
  const child = Children.only(children);
  const input = isValidElement(child)
    ? (child as ReactElement<{ id?: string; required?: boolean }>)
    : null;
  const id = input?.props.id ?? generated;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {input ? cloneElement(input, { id, required: input.props.required ?? required }) : children}
    </div>
  );
}
