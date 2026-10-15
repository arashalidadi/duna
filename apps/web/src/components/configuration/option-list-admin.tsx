'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Option = { id: string; code: string; label: string; sortOrder: number; isActive: boolean };
export type OptionList = { id: string; code: string; label: string; isActive: boolean; options: Option[] };

export function OptionListAdmin() {
  const t = useTranslations('phase9');
  const [lists, setLists] = useState<OptionList[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [optionCode, setOptionCode] = useState('');
  const [optionLabel, setOptionLabel] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = lists.find((l) => l.id === selectedId);
  const load = useCallback(async () => {
    const rows = await api.get<OptionList[]>('/configuration/option-lists');
    setLists(rows); setSelectedId((old) => rows.some((l) => l.id === old) ? old : rows[0]?.id ?? '');
  }, []);
  useEffect(() => { void load().catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed'))); }, [load, t]);
  useEffect(() => { setEditLabel(selected?.label ?? ''); }, [selected?.id, selected?.label]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><CardTitle>{t('managedLists')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault();
          void act(async () => { await api.post('/configuration/option-lists', { code: code.trim().toUpperCase(),
            label: name.trim() }); setCode(''); setName(''); }); }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label htmlFor="list-code">{t('code')}</Label><Input id="list-code" value={code}
              required maxLength={40} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CITY" /></div>
            <div><Label htmlFor="list-name">{t('displayName')}</Label><Input id="list-name" value={name}
              required onChange={(e) => setName(e.target.value)} /></div>
          </div><Button disabled={busy} type="submit">{t('addList')}</Button>
        </form>
        <Label htmlFor="list-select">{t('selectList')}</Label>
        <select id="list-select" className="h-9 w-full rounded-md border bg-card px-2"
          value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.code} · {l.label}{l.isActive ? '' : ` · ${t('inactive')}`}</option>)}
        </select>
        {selected && <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1"><Label htmlFor="list-label">{t('displayName')}</Label>
            <Input id="list-label" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} /></div>
          <Button variant="outline" disabled={busy || !editLabel.trim() || editLabel === selected.label}
            onClick={() => void act(() => api.patch(`/configuration/option-lists/${selected.id}`, { label: editLabel }))}>
            {t('save')}</Button>
          <Button variant="outline" disabled={busy} onClick={() => void act(() =>
            api.patch(`/configuration/option-lists/${selected.id}`, { isActive: !selected.isActive }))}>
            {selected.isActive ? t('deactivate') : t('reactivate')}</Button>
        </div>}
      </CardContent></Card>
    {selected && <Card><CardHeader><CardTitle>{t('options')} · {selected.code}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault();
          void act(async () => { await api.post(`/configuration/option-lists/${selected.id}/options`, {
            code: optionCode.trim().toUpperCase(), label: optionLabel.trim() });
            setOptionCode(''); setOptionLabel(''); }); }}>
          <div className="flex-1"><Label htmlFor="option-code">{t('code')}</Label>
            <Input id="option-code" required value={optionCode} maxLength={40}
              onChange={(e) => setOptionCode(e.target.value.toUpperCase())} /></div>
          <div className="flex-1"><Label htmlFor="option-label">{t('displayName')}</Label>
            <Input id="option-label" required value={optionLabel} onChange={(e) => setOptionLabel(e.target.value)} /></div>
          <Button type="submit" disabled={!selected.isActive || busy}>{t('addOption')}</Button>
        </form>
        <p className="text-xs text-muted-foreground">{t('optionHistoryNotice')}</p>
        {selected.options.map((option) => <OptionRow key={option.id} option={option} busy={busy} t={t}
          change={(patch) => void act(() => api.patch(`/configuration/options/${option.id}`, patch))} />)}
        {!selected.options.length && <p className="text-sm text-muted-foreground">{t('noOptions')}</p>}
      </CardContent></Card>}
  </div>;
}

function OptionRow({ option, busy, t, change }: { option: Option; busy: boolean;
  t: ReturnType<typeof useTranslations<'phase9'>>; change: (patch: unknown) => void }) {
  const [label, setLabel] = useState(option.label);
  useEffect(() => { setLabel(option.label); }, [option.label]);
  return <div className="flex flex-wrap items-end gap-2 rounded-md border p-2 text-sm">
    <span className="min-w-20 font-mono text-xs">{option.code}</span>
    <div className="min-w-[9rem] flex-1"><Label htmlFor={`opt-${option.id}`}>{t('displayName')}</Label>
      <Input id={`opt-${option.id}`} value={label} onChange={(e) => setLabel(e.target.value)} /></div>
    <Button size="sm" variant="outline" disabled={busy || !label.trim() || label === option.label}
      onClick={() => change({ label })}>{t('save')}</Button>
    <Button size="sm" variant="outline" disabled={busy} onClick={() => change({ isActive: !option.isActive })}>
      {option.isActive ? t('deactivate') : t('reactivate')}</Button>
  </div>;
}
