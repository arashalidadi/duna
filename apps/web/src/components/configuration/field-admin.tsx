'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OptionList } from './option-list-admin';

const CORE = ['Customer', 'Cargo', 'Job', 'BillOfLading', 'Invoice', 'ReleaseOrder'];
const KINDS = ['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT'];
type Field = { id: string; scope: string; key: string; label: string; kind: string;
  required: boolean; rules: { min?: number; max?: number; minLength?: number; maxLength?: number; format?: string };
  optionListId: string | null; displayLocation: string; sortOrder: number;
  visibility: { roles?: string[]; statuses?: string[] }; viewPermission: string | null;
  editPermission: string | null; searchable: boolean; filterable: boolean; reportable: boolean;
  exportable: boolean; effectiveFrom: string; effectiveUntil: string | null; isActive: boolean; version: number };
type DocumentTypes = { customTypes: { code: string }[] };
type Draft = { key: string; label: string; kind: string; required: boolean; optionListId: string;
  displayLocation: string; sortOrder: string; roles: string; statuses: string;
  viewPermission: string; editPermission: string; searchable: boolean; filterable: boolean;
  reportable: boolean; exportable: boolean; effectiveFrom: string; effectiveUntil: string;
  min: string; max: string; minLength: string; maxLength: string; format: string };
const blank: Draft = { key: '', label: '', kind: 'TEXT', required: false, optionListId: '',
  displayLocation: 'detail', sortOrder: '0', roles: '', statuses: '', viewPermission: '',
  editPermission: '', searchable: false, filterable: false, reportable: false, exportable: false,
  effectiveFrom: '', effectiveUntil: '', min: '', max: '', minLength: '', maxLength: '', format: '' };
const split = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export function FieldAdmin() {
  const t = useTranslations('phase9');
  const [scope, setScope] = useState(CORE[0]);
  const [scopes, setScopes] = useState(CORE);
  const [lists, setLists] = useState<OptionList[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [editing, setEditing] = useState<Field | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [history, setHistory] = useState<{ id: string; version: number; createdAt: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const [defs, options, docs] = await Promise.all([
      api.get<Field[]>(`/configuration/field-definitions/${encodeURIComponent(scope)}`),
      api.get<OptionList[]>('/configuration/option-lists'),
      api.get<DocumentTypes>('/configuration/document-types'),
    ]);
    setFields(defs); setLists(options); setScopes([...CORE, ...docs.customTypes.map((d) => `CUSTOM:${d.code}`)]);
  }, [scope]);
  useEffect(() => { void reload().catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed'))); }, [reload, t]);
  function edit(field: Field) {
    setEditing(field); setHistory([]);
    setDraft({ key: field.key, label: field.label, kind: field.kind, required: field.required,
      optionListId: field.optionListId ?? '', displayLocation: field.displayLocation,
      sortOrder: String(field.sortOrder), roles: (field.visibility.roles ?? []).join(', '),
      statuses: (field.visibility.statuses ?? []).join(', '),
      viewPermission: field.viewPermission ?? '', editPermission: field.editPermission ?? '',
      searchable: field.searchable, filterable: field.filterable, reportable: field.reportable,
      exportable: field.exportable, effectiveFrom: field.effectiveFrom.slice(0, 10),
      effectiveUntil: field.effectiveUntil?.slice(0, 10) ?? '',
      min: String(field.rules.min ?? ''), max: String(field.rules.max ?? ''),
      minLength: String(field.rules.minLength ?? ''), maxLength: String(field.rules.maxLength ?? ''),
      format: field.rules.format ?? '' });
    void api.get<typeof history>(`/configuration/field-definitions/${field.id}/history`).then(setHistory)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed')));
  }
  const set = <K extends keyof Draft>(name: K, value: Draft[K]) => setDraft((old) => ({ ...old, [name]: value }));
  const rules: Record<string, unknown> = {};
  if (draft.kind === 'TEXT') {
    if (draft.minLength) rules.minLength = Number(draft.minLength);
    if (draft.maxLength) rules.maxLength = Number(draft.maxLength);
    if (draft.format) rules.format = draft.format;
  }
  if (draft.kind === 'NUMBER') {
    if (draft.min) rules.min = Number(draft.min);
    if (draft.max) rules.max = Number(draft.max);
  }
  const payload = { label: draft.label.trim(), required: draft.required, rules,
    displayLocation: draft.displayLocation, sortOrder: Number(draft.sortOrder),
    visibility: { roles: split(draft.roles), statuses: split(draft.statuses) },
    viewPermission: draft.viewPermission.trim() || null,
    editPermission: draft.editPermission.trim() || null,
    searchable: draft.searchable, filterable: draft.filterable, reportable: draft.reportable,
    exportable: draft.exportable,
    ...(draft.effectiveFrom && (!editing || draft.effectiveFrom !== editing.effectiveFrom.slice(0, 10))
      ? { effectiveFrom: draft.effectiveFrom } : {}),
    ...(!editing || draft.effectiveUntil !== editing.effectiveUntil?.slice(0, 10)
      ? { effectiveUntil: draft.effectiveUntil || null } : {}) };
  async function save() {
    setBusy(true); setError('');
    try {
      if (editing) await api.patch(`/configuration/field-definitions/${editing.id}`, payload);
      else await api.post('/configuration/field-definitions', { ...payload, scope,
        key: draft.key.trim(), kind: draft.kind, optionListId: draft.optionListId || null });
      await reload(); setEditing(null); setDraft(blank); setHistory([]);
    } catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  async function toggle(field: Field) {
    setBusy(true); setError('');
    try { await api.patch(`/configuration/field-definitions/${field.id}`, { isActive: !field.isActive });
      await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-4 xl:grid-cols-2">
    <Card><CardHeader><CardTitle>{t('customFields')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Label htmlFor="field-scope">{t('recordScope')}</Label>
        <select id="field-scope" className="h-9 w-full rounded-md border bg-card px-2" value={scope}
          onChange={(e) => { setScope(e.target.value); setEditing(null); setDraft(blank); }}>
          {scopes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {fields.map((field) => <div key={field.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
          <div className="flex-1"><strong>{field.label}</strong> <span className="font-mono text-xs text-muted-foreground">
            {field.key} · {field.kind} · v{field.version}</span>
            {!field.isActive && <span className="ms-2 text-xs">{t('inactive')}</span>}</div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => edit(field)}>{t('edit')}</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle(field)}>
            {field.isActive ? t('deactivate') : t('reactivate')}</Button>
        </div>)}
        {!fields.length && <p className="text-sm text-muted-foreground">{t('noFields')}</p>}
      </CardContent></Card>
    <Card><CardHeader><CardTitle>{editing ? t('editField') : t('addField')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t('fieldHistoryNotice')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="cf-key">{t('key')}</Label><Input id="cf-key" disabled={!!editing}
            value={draft.key} onChange={(e) => set('key', e.target.value.toLowerCase())} /></div>
          <div><Label htmlFor="cf-label">{t('displayName')}</Label><Input id="cf-label"
            value={draft.label} onChange={(e) => set('label', e.target.value)} /></div>
          <div><Label htmlFor="cf-kind">{t('dataType')}</Label><select id="cf-kind" disabled={!!editing}
            className="h-9 w-full rounded-md border bg-card px-2" value={draft.kind}
            onChange={(e) => set('kind', e.target.value)}>
            {KINDS.map((k) => <option key={k}>{k}</option>)}
          </select></div>
          <div><Label htmlFor="cf-list">{t('optionList')}</Label><select id="cf-list" disabled={!!editing || !draft.kind.includes('SELECT')}
            className="h-9 w-full rounded-md border bg-card px-2" value={draft.optionListId}
            onChange={(e) => set('optionListId', e.target.value)}>
            <option value="">—</option>{lists.filter((l) => l.isActive || l.id === draft.optionListId)
              .map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </select></div>
          <div><Label htmlFor="cf-place">{t('placement')}</Label><select id="cf-place"
            className="h-9 w-full rounded-md border bg-card px-2" value={draft.displayLocation}
            onChange={(e) => set('displayLocation', e.target.value)}>
            {['detail', 'form', 'list'].map((s) => <option key={s}>{s}</option>)}
          </select></div>
          <div><Label htmlFor="cf-sort">{t('order')}</Label><Input id="cf-sort" type="number"
            value={draft.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></div>
          {draft.kind === 'TEXT' && <>
            <div><Label htmlFor="cf-minl">{t('minimumLength')}</Label><Input id="cf-minl" type="number"
              value={draft.minLength} onChange={(e) => set('minLength', e.target.value)} /></div>
            <div><Label htmlFor="cf-maxl">{t('maximumLength')}</Label><Input id="cf-maxl" type="number"
              value={draft.maxLength} onChange={(e) => set('maxLength', e.target.value)} /></div>
            <div><Label htmlFor="cf-format">{t('format')}</Label><select id="cf-format" value={draft.format}
              className="h-9 w-full rounded-md border bg-card px-2" onChange={(e) => set('format', e.target.value)}>
              {['', 'EMAIL', 'CODE'].map((x) => <option key={x} value={x}>{x || '—'}</option>)}
            </select></div>
          </>}
          {draft.kind === 'NUMBER' && <>
            <div><Label htmlFor="cf-min">{t('minimum')}</Label><Input id="cf-min" type="number" step="any"
              value={draft.min} onChange={(e) => set('min', e.target.value)} /></div>
            <div><Label htmlFor="cf-max">{t('maximum')}</Label><Input id="cf-max" type="number" step="any"
              value={draft.max} onChange={(e) => set('max', e.target.value)} /></div>
          </>}
          <div><Label htmlFor="cf-from">{t('effectiveFrom')}</Label><Input id="cf-from" type="date"
            value={draft.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} /></div>
          <div><Label htmlFor="cf-until">{t('effectiveUntil')}</Label><Input id="cf-until" type="date"
            value={draft.effectiveUntil} onChange={(e) => set('effectiveUntil', e.target.value)} /></div>
          <div><Label htmlFor="cf-roles">{t('visibleRoles')}</Label><Input id="cf-roles" value={draft.roles}
            onChange={(e) => set('roles', e.target.value)} placeholder="OPERATIONS, ADMIN" /></div>
          <div><Label htmlFor="cf-status">{t('visibleStatuses')}</Label><Input id="cf-status" value={draft.statuses}
            onChange={(e) => set('statuses', e.target.value)} placeholder="DRAFT, FINAL" /></div>
          <div><Label htmlFor="cf-view">{t('viewPermission')}</Label><Input id="cf-view"
            value={draft.viewPermission} onChange={(e) => set('viewPermission', e.target.value)} /></div>
          <div><Label htmlFor="cf-edit">{t('editPermission')}</Label><Input id="cf-edit"
            value={draft.editPermission} onChange={(e) => set('editPermission', e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {(['required', 'searchable', 'filterable', 'reportable', 'exportable'] as const).map((flag) =>
            <label key={flag} className="flex items-center gap-1.5"><input type="checkbox" checked={draft[flag]}
              onChange={(e) => set(flag, e.target.checked)} />{t(flag)}</label>)}
        </div>
        <div className="flex gap-2"><Button disabled={busy || !draft.label.trim() || !editing && !draft.key.trim()}
          onClick={() => void save()}>{editing ? t('saveVersion') : t('addField')}</Button>
          {editing && <Button variant="outline" onClick={() => { setEditing(null); setDraft(blank); setHistory([]); }}>
            {t('cancel')}</Button>}</div>
        {history.length > 0 && <div className="text-xs text-muted-foreground">
          {t('versions')}: {history.map((h) => `v${h.version} · ${new Date(h.createdAt).toLocaleDateString()}`).join(' | ')}
        </div>}
      </CardContent></Card>
  </div>;
}
