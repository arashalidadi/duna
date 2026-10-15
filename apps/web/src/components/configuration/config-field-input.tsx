'use client';

import { Input } from '@/components/ui/input';

export type ConfigOption = { id: string; code: string; label: string; isActive: boolean };
export type ConfigFieldInput = { key: string; label: string; kind: string; required: boolean;
  options: ConfigOption[]; rules?: { min?: number; max?: number; minLength?: number; maxLength?: number } };

/** Managed options use IDs, never browser-supplied labels. The server validates
 * them again on save and keeps the historical label in a separate snapshot. */
export function ConfigFieldControl({ field, value, onChange, disabled, historicalOptions = [] }: {
  field: ConfigFieldInput; value: unknown; onChange: (value: unknown) => void;
  disabled?: boolean; historicalOptions?: ConfigOption[];
}) {
  const options = [...field.options];
  const selected = Array.isArray(value) ? value as string[] : typeof value === 'string' ? [value] : [];
  for (const option of historicalOptions) {
    if (!selected.includes(option.id)) continue;
    const index = options.findIndex((o) => o.id === option.id);
    if (index === -1) options.push(option);
    else options[index] = { ...options[index], label: option.label }; // saved, not today's renamed label
  }
  const id = `config-${field.key}`;
  const inputStyle = 'h-9 w-full rounded-md border border-input bg-card px-3 text-sm';
  const cleared = value && typeof value === 'object' && !Array.isArray(value) &&
    (value as { cleared?: boolean }).cleared;
  if (field.kind === 'SINGLE_SELECT') return <select id={id} className={inputStyle}
    value={cleared ? '' : typeof value === 'string' ? value : ''} disabled={disabled}
    onChange={(e) => onChange(e.target.value || null)}>
      <option value="">—</option>
      {options.map((option) => <option key={option.id} value={option.id} disabled={!option.isActive}>
        {option.label}{option.isActive ? '' : ' · inactive'}
      </option>)}
    </select>;
  if (field.kind === 'MULTI_SELECT') {
    return <div id={id} className="flex flex-wrap gap-3 rounded-md border border-input p-2">
      {options.map((option) => <label key={option.id} className="flex items-center gap-1.5 text-sm">
        <input type="checkbox" checked={selected.includes(option.id)} disabled={disabled || !option.isActive}
          onChange={(e) => onChange(e.target.checked ? [...selected, option.id] : selected.filter((v) => v !== option.id))} />
        {option.label}{!option.isActive && ' · inactive'}
      </label>)}
      {!options.length && <span className="text-muted-foreground">—</span>}
    </div>;
  }
  if (field.kind === 'BOOLEAN') return <input id={id} type="checkbox" checked={value === true}
    disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
  return <Input id={id} disabled={disabled} type={field.kind === 'NUMBER' ? 'number' :
    field.kind === 'DATE' ? 'date' : 'text'} step={field.kind === 'NUMBER' ? 'any' : undefined}
    min={field.kind === 'NUMBER' ? field.rules?.min : undefined}
    max={field.kind === 'NUMBER' ? field.rules?.max : undefined}
    minLength={field.kind === 'TEXT' ? field.rules?.minLength : undefined}
    maxLength={field.kind === 'TEXT' ? field.rules?.maxLength : undefined}
    value={cleared || value == null ? '' : String(value)}
    onChange={(e) => onChange(field.kind === 'NUMBER' ?
      e.target.value === '' ? null : Number(e.target.value) : e.target.value || null)} />;
}
