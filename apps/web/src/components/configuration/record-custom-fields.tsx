'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ConfigFieldControl, type ConfigFieldInput, type ConfigOption } from './config-field-input';

type FieldRow = { field: ConfigFieldInput & { id: string; active: boolean; version: number };
  value: { value: unknown; fieldSnapshot?: { label?: string; options?: ConfigOption[] } } | null; editable: boolean };

/** An additive sidecar, never part of core money/status payloads. Issued core
 * documents are view-only, even when a user retains a generic edit grant. */
export function RecordCustomFields({ scope, recordId }: { scope: string; recordId: string }) {
  const t = useTranslations('phase9');
  const [rows, setRows] = useState<FieldRow[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const target = useRef(`${scope}/${recordId}`);
  target.current = `${scope}/${recordId}`;
  const load = useCallback(async () => {
    const expected = `${scope}/${recordId}`;
    const list = await api.get<FieldRow[]>(`/configuration/records/${encodeURIComponent(scope)}/${encodeURIComponent(recordId)}/fields`);
    if (target.current !== expected) return; // never show a previous record after navigation
    setRows(list); setDraft(Object.fromEntries(list.map((item) => [item.field.key, item.value?.value ?? null])));
    setReady(true);
  }, [recordId, scope]);
  useEffect(() => {
    if (!recordId) return;
    let active = true;
    setReady(false); setRows([]); setError('');
    void load().catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : t('loadFailed')); });
    return () => { active = false; };
  }, [recordId, scope, load, t]);
  if (!recordId) return null;
  const changed = rows.filter((r) => JSON.stringify(draft[r.field.key]) !== JSON.stringify(r.value?.value ?? null) && r.editable);
  async function save() {
    setBusy(true); setError('');
    try {
      await api.patch(`/configuration/records/${encodeURIComponent(scope)}/${encodeURIComponent(recordId)}/fields`, {
        values: Object.fromEntries(changed.map((r) => [r.field.key, draft[r.field.key]])),
      });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-lg border border-border p-4" aria-label={t('customFields')}>
    <h3 className="text-sm font-semibold">{t('customFields')}</h3>
    {!ready && <p className="text-xs text-muted-foreground">{t('loading')}</p>}
    {ready && !rows.length && <p className="text-xs text-muted-foreground">{t('noFields')}</p>}
    {rows.map(({ field, value, editable }) => <div key={field.key} className="space-y-1.5">
      <Label htmlFor={`config-${field.key}`}>{value?.fieldSnapshot?.label ?? field.label}{field.required ? ' *' : ''}</Label>
      <ConfigFieldControl field={field} value={draft[field.key]}
        historicalOptions={(value?.fieldSnapshot?.options ?? []).map((o) => ({ ...o,
          isActive: field.options.some((a) => a.id === o.id && a.isActive) }))}
        disabled={!editable || busy} onChange={(v) => setDraft((old) => ({ ...old, [field.key]: v }))} />
      {!field.active && <span className="text-xs text-muted-foreground">{t('historical')}</span>}
    </div>)}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    {!!changed.length && <Button size="sm" disabled={busy} onClick={() => void save()}>{t('saveFields')}</Button>}
  </section>;
}
