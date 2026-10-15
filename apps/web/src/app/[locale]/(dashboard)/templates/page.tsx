'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { DocumentOutputActions } from '@/components/document-output/document-output-actions';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TYPES = [
  'loading-list', 'bill', 'manifest', 'invoice', 'delivery-order', 'release-order',
  'salary-slip', 'voucher', 'payment', 'receipt', 'ledger',
] as const;
type Version = { id: string; version: number; label: string | null; isActive: boolean; contentHash: string | null };
type Template = { id: string; name: string; documentType: string; description: string | null;
  isActive: boolean; currentVersionId: string | null; versions: Version[] };
type Asset = { id: string; kind: string; name: string; isApproved: boolean; deactivatedAt: string | null;
  sha256: string };

function draftLayout(type: string) {
  return JSON.stringify({ title: type.replaceAll('-', ' '), pageSize: 'A4', orientation: 'portrait',
    margin: 42, fontSize: 10, fields: ['number', 'date', 'status', 'party', 'reference',
      'vessel', 'voyage', 'origin', 'destination', 'port', 'currency', 'subtotal', 'tax',
      'taxNumber', 'amount', 'paymentState', 'period', 'notes'],
    columns: ['reference', 'description', 'shipper', 'consignee', 'quantity', 'units', 'packages', 'weight', 'unitPrice',
      'amount', 'tax', 'currency', 'debit', 'credit', 'balance'],
    note: 'Generic layout — not an official company template.' }, null, 2);
}

export default function TemplatesPage() {
  const t = useTranslations('documentOutput');
  const { hasPermission } = useAuth();
  const canManage = hasPermission('document:manage');
  const canApprove = hasPermission('document:approve');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [type, setType] = useState<string>('invoice');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [layout, setLayout] = useState(draftLayout('invoice'));
  const [label, setLabel] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [assetKind, setAssetKind] = useState('LOGO');
  const [assetName, setAssetName] = useState('');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => templates.find((item) => item.id === selectedId), [templates, selectedId]);

  const refresh = useCallback(async () => {
    try {
      const [list, artwork] = await Promise.all([
        api.get<Template[]>('/infrastructure/templates/catalogue'),
        api.get<Asset[]>('/documents/assets'),
      ]);
      setTemplates(list); setAssets(artwork);
    } catch (e) { setError(e instanceof ApiError ? e.message : t('manageError')); }
  }, [t]);
  useEffect(() => { if (canManage) void refresh(); }, [canManage, refresh]);

  useEffect(() => {
    if (!selected) return;
    const newest = selected.versions[0];
    if (!newest) { setLayout(draftLayout(selected.documentType)); return; }
    let active = true;
    api.get<unknown>(`/infrastructure/templates/${selected.id}/versions/${newest.version}/layout`)
      .then((body) => { if (active) setLayout(JSON.stringify(body, null, 2)); })
      .catch((e: unknown) => { if (active) setError(e instanceof ApiError ? e.message : t('manageError')); });
    return () => { active = false; };
  }, [selected?.id, selected?.versions[0]?.id, t]); // eslint-disable-line react-hooks/exhaustive-deps

  async function perform(fn: () => Promise<void>) {
    setWorking(true); setError('');
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t('manageError')); }
    finally { setWorking(false); }
  }

  return <div className="space-y-6">
    <Breadcrumbs items={[{ label: t('templates') }]} />
    <div>
      <h1 className="text-2xl font-bold">{t('templates')}</h1>
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <p className="mt-2 text-sm text-warning-foreground">{t('fidelity')}</p>
      <p className="text-sm text-muted-foreground">{t('explainModes')}</p>
    </div>
    {!canManage ? <p>{t('manageError')}</p> : <>
      {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Card><CardHeader><CardTitle>{t('newTemplate')}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div><Label htmlFor="template-type">{t('type')}</Label>
            <select id="template-type" className="h-10 rounded-md border border-input bg-card px-3"
              value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((key) => <option key={key} value={key}>{key}</option>)}
            </select></div>
          <div><Label htmlFor="template-name">{t('name')}</Label>
            <Input id="template-name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label htmlFor="template-description">{t('descriptionField')}</Label>
            <Input id="template-description" maxLength={500} value={description}
              onChange={(e) => setDescription(e.target.value)} /></div>
          <Button disabled={working || !name.trim()} onClick={() => void perform(async () => {
            const saved = await api.post<Template>('/infrastructure/templates', { documentType: type,
              name: name.trim(), description: description.trim() || undefined });
            setSelectedId(saved.id); setName(''); setDescription(''); setLayout(draftLayout(type));
          })}>{t('create')}</Button>
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>{t('templates')}</CardTitle>
        <CardDescription>{templates.length ? t('select') : t('noTemplates')}</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <select aria-label={t('select')} className="h-10 w-full rounded-md border border-input bg-card px-3"
            value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">{t('select')}</option>
            {templates.map((item) => <option key={item.id} value={item.id}>
              {item.documentType} · {item.name}{item.isActive ? ' ✓' : ''}</option>)}
          </select>
          {selected && <>
            <div className="space-y-2">
              <Label htmlFor="layout-json">{t('layout')}</Label>
              <textarea id="layout-json" dir="ltr" spellCheck={false} value={layout}
                onChange={(e) => setLayout(e.target.value)} className="min-h-[320px] w-full rounded-md border border-input bg-card p-3 font-mono text-xs" />
              <Label htmlFor="layout-file">{t('uploadLayout')}</Label>
              <Input id="layout-file" type="file" accept=".json,application/json" onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 128 * 1024) { setError('JSON file exceeds 128 KiB'); return; }
                void file.text().then((text) => setLayout(text));
              }} />
              <Input placeholder={t('version')} maxLength={100} value={label}
                onChange={(e) => setLabel(e.target.value)} />
              <Button disabled={working} onClick={() => void perform(async () => {
                await api.post(`/infrastructure/templates/${selected.id}/versions`,
                  { label: label.trim() || undefined, layout: JSON.parse(layout) }); setLabel('');
              })}>{t('saveVersion')}</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selected.versions.map((v) => <div key={v.id} className="flex items-center gap-2 rounded-md border border-input p-2">
                <span>{t('version')} {v.version}{v.isActive ? ' ✓' : ''}</span>
                {canApprove && <Button variant="outline" size="sm" disabled={working || v.isActive || !v.contentHash}
                  onClick={() => void perform(async () => {
                    await api.post(`/infrastructure/templates/${selected.id}/versions/${v.version}/assign`);
                  })}>{t('assign')}</Button>}
              </div>)}
              {canApprove && selected.isActive && <Button variant="outline" size="sm" disabled={working}
                onClick={() => void perform(async () => { await api.post(`/infrastructure/templates/${selected.id}/deactivate`); })}>
                {t('deactivate')}</Button>}
            </div>
            <div className="space-y-2"><Label htmlFor="preview-record">{t('preview')}</Label>
              <Input id="preview-record" value={previewId} placeholder={t('recordId')}
                onChange={(e) => setPreviewId(e.target.value)} />
              {previewId && selected.versions[0] && <DocumentOutputActions type={selected.documentType}
                id={previewId} filters={{ previewVersionId: selected.versions[0].id }} />}
            </div>
          </>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>{t('assets')}</CardTitle>
        <CardDescription>{assets.length ? t('explainModes') : t('noAssets')}</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label htmlFor="asset-kind">{t('assetKind')}</Label>
              <select id="asset-kind" className="h-10 rounded-md border border-input bg-card px-3"
                value={assetKind} onChange={(e) => setAssetKind(e.target.value)}>
                {['LOGO', 'LETTERHEAD', 'STAMP', 'SIGNATURE'].map((key) => <option key={key} value={key}>{key}</option>)}
              </select></div>
            <div><Label htmlFor="asset-name">{t('assetName')}</Label>
              <Input id="asset-name" maxLength={100} value={assetName} onChange={(e) => setAssetName(e.target.value)} /></div>
            <Input aria-label={t('uploadAsset')} type="file" accept="image/png,image/jpeg"
              onChange={(e) => setAssetFile(e.target.files?.[0] ?? null)} />
            <Button disabled={working || !assetName.trim() || !assetFile}
              onClick={() => void perform(async () => {
                const form = new FormData(); form.set('name', assetName); form.set('kind', assetKind);
                form.set('file', assetFile!); await api.postForm('/documents/assets', form);
                setAssetName(''); setAssetFile(null);
              })}>{t('uploadAsset')}</Button>
          </div>
          {assets.map((asset) => <div key={asset.id} className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm">
            <span>{asset.kind} · {asset.name} · {asset.id} {asset.isApproved ? ' ✓' : ''}</span>
            {canApprove && !asset.isApproved && !asset.deactivatedAt && <Button size="sm" variant="outline"
              disabled={working} onClick={() => void perform(async () => {
                await api.post(`/documents/assets/${asset.id}/approve`);
              })}>{t('approveAsset')}</Button>}
            {canApprove && !asset.deactivatedAt && <Button size="sm" variant="outline"
              disabled={working} onClick={() => void perform(async () => {
                await api.post(`/documents/assets/${asset.id}/retire`);
              })}>{t('retireAsset')}</Button>}
          </div>)}
        </CardContent>
      </Card>
    </>}
  </div>;
}
