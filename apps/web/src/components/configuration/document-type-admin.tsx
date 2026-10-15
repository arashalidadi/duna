'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Spec = { name: string; category: string; description: string | null;
  numbering?: { prefix: string; padding: number; period: 'NONE' | 'YYYY' | 'YYYYMM' };
  permissions?: Record<string, string | null>; relationships?: string[];
  reporting?: { searchable: boolean; exportable: boolean }; layout?: { title: string; note: string | null;
    fields: string[]; logoAssetId?: string | null; letterheadAssetId?: string | null;
    stampAssetId?: string | null; signatureAssetId?: string | null } };
type Version = { id: string; version: number; definition: Spec };
type DocType = { id: string; code: string; isCore: boolean; isActive: boolean;
  currentVersionId: string | null; versions: Version[] };
type Catalogue = { coreCatalogue: { code: string; configured: DocType | null }[]; customTypes: DocType[] };
type Draft = { name: string; category: string; description: string; prefix: string; padding: string;
  period: 'NONE' | 'YYYY' | 'YYYYMM'; relationships: string[]; searchable: boolean;
  exportable: boolean; title: string; note: string; fields: string;
  permissions: Record<string, string>; assets: Record<string, string> };
const relations = ['Customer', 'Cargo', 'Job', 'BillOfLading', 'Voyage', 'Manifest'];
const permissionActions = ['read', 'create', 'update', 'transition', 'approve'];
const artwork = ['logoAssetId', 'letterheadAssetId', 'stampAssetId', 'signatureAssetId'];
const empty = (): Draft => ({ name: '', category: '', description: '', prefix: '', padding: '5',
  period: 'YYYY', relationships: [], searchable: false, exportable: false, title: '', note: '',
  fields: '', permissions: {}, assets: {} });

export function DocumentTypeAdmin() {
  const t = useTranslations('phase9');
  const [catalogue, setCatalogue] = useState<Catalogue>({ coreCatalogue: [], customTypes: [] });
  const [code, setCode] = useState('');
  const [draft, setDraft] = useState<Draft>(empty());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = catalogue.customTypes.find((x) => x.code === code) ??
    catalogue.coreCatalogue.find((x) => x.code === code)?.configured;
  const core = catalogue.coreCatalogue.some((x) => x.code === code);
  const load = useCallback(async () => setCatalogue(await api.get<Catalogue>('/configuration/document-types')), []);
  useEffect(() => { void load().catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed'))); }, [load, t]);
  function loadVersion(version: Version) {
    const s = version.definition;
    setDraft({ name: s.name, category: s.category, description: s.description ?? '',
      prefix: s.numbering?.prefix ?? '', padding: String(s.numbering?.padding ?? 5),
      period: s.numbering?.period ?? 'YYYY', relationships: s.relationships ?? [],
      searchable: s.reporting?.searchable ?? false, exportable: s.reporting?.exportable ?? false,
      title: s.layout?.title ?? s.name, note: s.layout?.note ?? '', fields: s.layout?.fields.join(', ') ?? '',
      permissions: Object.fromEntries(permissionActions.map((action) => [action, s.permissions?.[action] ?? ''])),
      assets: Object.fromEntries(artwork.map((kind) => [kind, s.layout?.[kind as keyof typeof s.layout] ?? ''])) as Record<string, string> });
  }
  function select(next: string) {
    setCode(next);
    const row = catalogue.customTypes.find((x) => x.code === next) ??
      catalogue.coreCatalogue.find((x) => x.code === next)?.configured;
    if (row?.versions.length) loadVersion(row.versions[0]);
    else setDraft({ ...empty(), name: next.replaceAll('-', ' ') });
  }
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => setDraft((old) => ({ ...old, [field]: value }));
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  function spec(): Spec {
    const base = { name: draft.name.trim(), category: draft.category.trim(), description: draft.description.trim() || null };
    if (core) return base;
    return { ...base, numbering: { prefix: draft.prefix.trim().toUpperCase(), padding: Number(draft.padding), period: draft.period },
      permissions: Object.fromEntries(permissionActions.map((action) => [action, draft.permissions[action]?.trim() || null])),
      relationships: draft.relationships, reporting: { searchable: draft.searchable, exportable: draft.exportable },
      layout: { title: draft.title.trim(), note: draft.note.trim() || null,
        fields: draft.fields.split(',').map((f) => f.trim()).filter(Boolean),
        ...Object.fromEntries(artwork.map((kind) => [kind, draft.assets[kind]?.trim() || null])) } };
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>{t('documentTypes')}</CardTitle></CardHeader><CardContent className="space-y-3">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-sm text-muted-foreground">{t('coreMetadataNotice')}</p>
      <Label htmlFor="doc-select">{t('selectType')}</Label>
      <select id="doc-select" value={code} onChange={(e) => select(e.target.value)}
        className="h-9 w-full rounded-md border bg-card px-2">
        <option value="">{t('newCustomType')}</option>
        {catalogue.coreCatalogue.map((x) => <option key={x.code} value={x.code}>{x.code} · {t('coreType')}</option>)}
        {catalogue.customTypes.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.isActive ? t('active') : t('inactive')}</option>)}
      </select>
      {!selected && !core && <div><Label htmlFor="doc-code">{t('code')}</Label>
        <Input id="doc-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CERTIFICATE" maxLength={40} /></div>}
      {!!selected && <div className="space-y-2 text-sm">
        <p>{t('versions')}: {selected.versions.map((v) => `v${v.version}`).join(', ')}</p>
        <Label htmlFor="doc-version">{t('activeVersion')}</Label>
        <select id="doc-version" className="h-9 w-full rounded-md border bg-card px-2"
          value={selected.currentVersionId ?? ''} onChange={(e) => void act(() =>
            api.post(`/configuration/document-types/${encodeURIComponent(code)}/activate`, {
              versionId: e.target.value, isActive: selected.isActive }))}>
          <option value="">{t('selectVersion')}</option>
          {selected.versions.map((v) => <option key={v.id} value={v.id}>v{v.version}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !selected.currentVersionId}
            onClick={() => void act(() => api.post(`/configuration/document-types/${encodeURIComponent(code)}/activate`, {
              isActive: !selected.isActive }))}>{selected.isActive ? t('deactivate') : t('activate')}</Button>
          <Button variant="outline" onClick={() => loadVersion(selected.versions[0])}>{t('loadLatestVersion')}</Button>
        </div>
      </div>}
      <p className="text-xs text-muted-foreground">{t('activationHelp')}</p>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{selected ? t('newTypeVersion') : t('newCustomType')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="doc-name">{t('displayName')}</Label><Input id="doc-name"
            value={draft.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><Label htmlFor="doc-category">{t('category')}</Label><Input id="doc-category"
            value={draft.category} onChange={(e) => set('category', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label htmlFor="doc-description">{t('description')}</Label>
            <Input id="doc-description" value={draft.description} onChange={(e) => set('description', e.target.value)} /></div>
          {!core && <>
            <div><Label htmlFor="doc-prefix">{t('numberPrefix')}</Label><Input id="doc-prefix"
              value={draft.prefix} onChange={(e) => set('prefix', e.target.value.toUpperCase())} maxLength={12} /></div>
            <div><Label htmlFor="doc-padding">{t('numberPadding')}</Label><Input id="doc-padding" type="number"
              min={2} max={12} value={draft.padding} onChange={(e) => set('padding', e.target.value)} /></div>
            <div><Label htmlFor="doc-period">{t('numberPeriod')}</Label><select id="doc-period"
              className="h-9 w-full rounded-md border bg-card px-2" value={draft.period}
              onChange={(e) => set('period', e.target.value as Draft['period'])}>
              {['NONE', 'YYYY', 'YYYYMM'].map((x) => <option key={x}>{x}</option>)}
            </select></div>
            <div><Label htmlFor="doc-layout-title">{t('outputTitle')}</Label><Input id="doc-layout-title"
              value={draft.title} onChange={(e) => set('title', e.target.value)} /></div>
            <div><Label htmlFor="doc-layout-fields">{t('outputFields')}</Label><Input id="doc-layout-fields"
              value={draft.fields} onChange={(e) => set('fields', e.target.value)} placeholder="reference, weight" /></div>
            <div><Label htmlFor="doc-layout-note">{t('outputNote')}</Label><Input id="doc-layout-note"
              value={draft.note} onChange={(e) => set('note', e.target.value)} /></div>
            {artwork.map((kind) => <div key={kind}><Label htmlFor={`asset-${kind}`}>{kind}</Label>
              <Input id={`asset-${kind}`} value={draft.assets[kind] ?? ''} placeholder={t('approvedAssetId')}
                onChange={(e) => set('assets', { ...draft.assets, [kind]: e.target.value })} /></div>)}
            {permissionActions.map((action) => <div key={action}><Label htmlFor={`doc-perm-${action}`}>
              {action} · {t('extraPermission')}</Label><Input id={`doc-perm-${action}`}
                value={draft.permissions[action] ?? ''}
                onChange={(e) => set('permissions', { ...draft.permissions, [action]: e.target.value })} /></div>)}
            <div className="sm:col-span-2"><Label>{t('relationships')}</Label><div className="flex flex-wrap gap-3">
              {relations.map((name) => <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.relationships.includes(name)} onChange={(e) => set('relationships',
                  e.target.checked ? [...draft.relationships, name] : draft.relationships.filter((n) => n !== name))} />
                {name}</label>)}
            </div></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.searchable}
              onChange={(e) => set('searchable', e.target.checked)} />{t('searchable')}</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.exportable}
              onChange={(e) => set('exportable', e.target.checked)} />{t('exportable')}</label>
          </>}
        </div>
        <Button disabled={busy || !code.trim() || !draft.name.trim() || !draft.category.trim()}
          onClick={() => void act(() => api.post(`/configuration/document-types/${encodeURIComponent(code)}` +
            (selected ? '/versions' : ''), spec()))}>{selected ? t('saveVersion') : t('createType')}</Button>
        <p className="text-xs text-muted-foreground">{t('genericTemplateNotice')}</p>
      </CardContent></Card>
  </div>;
}
