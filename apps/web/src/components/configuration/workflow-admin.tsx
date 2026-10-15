'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = { code: string; label: string; terminal: boolean; issued: boolean };
type Transition = { from: string; to: string; permission: string;
  conditions?: unknown[]; approval?: { permission: string; distinctRequester: boolean } | null;
  exception?: { permission: string; reasonRequired: true } | null };
type Version = { id: string; version: number; definition: { statuses: Status[]; transitions: Transition[] } };
type Workflow = { id: string; scope: string; isActive: boolean; currentVersionId: string | null; versions: Version[] };
type Approval = { id: string; scope: string; recordId: string; status: string;
  requestedAt: string; requestedById: string; context: { outstanding?: string; reason?: string; payment_state?: string } };
type TransitionDraft = { from: string; to: string; permission: string; approval: boolean;
  approvalPermission: string; exceptionPermission: string; conditions: string };
const emptyStatus = (): Status => ({ code: '', label: '', terminal: false, issued: false });
const emptyTransition = (): TransitionDraft => ({ from: '', to: '', permission: '', approval: false,
  approvalPermission: '', exceptionPermission: '', conditions: '[]' });
function coreDraft(scope: string): { statuses: Status[]; transitions: TransitionDraft[] } {
  if (scope === 'release-exception' || scope === 'invoice-correction') {
    const first = scope === 'release-exception' ? 'REQUESTED' : 'PENDING_APPROVAL';
    const approved = scope === 'release-exception' ? 'APPROVED' : 'APPLIED';
    const grant = scope === 'release-exception' ? 'release:override' : 'invoice:approve_correction';
    return { statuses: [first, approved, 'REJECTED'].map((code) => ({ code, label: '', terminal: code !== first, issued: false })),
      transitions: [{ ...emptyTransition(), from: first, to: approved, permission: grant,
        approval: true, approvalPermission: grant },
        { ...emptyTransition(), from: first, to: 'REJECTED', permission: grant }] };
  }
  return { statuses: [emptyStatus()], transitions: [emptyTransition()] };
}

export function WorkflowAdmin() {
  const t = useTranslations('phase9');
  const { hasPermission } = useAuth();
  const [flows, setFlows] = useState<Workflow[]>([]);
  const [scope, setScope] = useState('');
  const [statusRows, setStatusRows] = useState<Status[]>([emptyStatus()]);
  const [transitionRows, setTransitionRows] = useState<TransitionDraft[]>([emptyTransition()]);
  const [pending, setPending] = useState<Approval[]>([]);
  const [billLabels, setBillLabels] = useState<{ code: string; label: string; technicalFallback: boolean }[]>([]);
  const [labelEdits, setLabelEdits] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const existing = flows.find((f) => f.scope === scope);
  const load = useCallback(async () => {
    const rows = await api.get<Workflow[]>('/configuration/workflows');
    setFlows(rows);
    if (hasPermission('bill:read')) {
      const labels = await api.get<typeof billLabels>('/configuration/core/bill-labels');
      setBillLabels(labels);
      setLabelEdits(Object.fromEntries(labels.map((row) => [row.code, row.label])));
    }
    if (hasPermission('workflow:approve') && hasPermission('release:override')) {
      setPending(await api.get<Approval[]>('/configuration/approvals/pending/release-exception'));
    }
  }, [hasPermission]);
  useEffect(() => { void load().catch((e: unknown) => setError(e instanceof Error ? e.message : t('loadFailed'))); }, [load, t]);
  function changeScope(value: string) {
    setScope(value);
    const draft = coreDraft(value); setStatusRows(draft.statuses); setTransitionRows(draft.transitions);
  }
  function loadVersion(v: Version) {
    setStatusRows(v.definition.statuses.map((s) => ({ ...s })));
    setTransitionRows(v.definition.transitions.map((r) => ({ ...r,
      approval: !!r.approval, approvalPermission: r.approval?.permission ?? '',
      exceptionPermission: r.exception?.permission ?? '', conditions: JSON.stringify(r.conditions ?? [], null, 2) })));
  }
  const setStatus = (i: number, changes: Partial<Status>) =>
    setStatusRows((old) => old.map((row, index) => index === i ? { ...row, ...changes } : row));
  const setTransition = (i: number, changes: Partial<TransitionDraft>) =>
    setTransitionRows((old) => old.map((row, index) => index === i ? { ...row, ...changes } : row));
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('saveFailed')); }
    finally { setBusy(false); }
  }
  async function saveVersion() {
    if (!scope) { setError(t('scopeRequired')); return; }
    let body: { statuses: Status[]; transitions: Transition[] };
    try { body = { statuses: statusRows.map((s) => ({ ...s, code: s.code.toUpperCase(), label: s.label.trim() })),
      transitions: transitionRows.map((r) => ({ from: r.from.toUpperCase(), to: r.to.toUpperCase(),
        permission: r.permission.trim(), conditions: JSON.parse(r.conditions) as unknown[],
        ...(r.approval ? { approval: { permission: r.approvalPermission.trim(), distinctRequester: true } } : {}),
        ...(r.exceptionPermission ? { exception: { permission: r.exceptionPermission.trim(), reasonRequired: true as const } } : {}) })) }; }
    catch { setError(t('invalidConditions')); return; }
    await act(() => api.post(`/configuration/workflows/${encodeURIComponent(scope)}${existing ? '/versions' : ''}`, body));
  }
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <Card><CardHeader><CardTitle>{t('workflows')}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('workflowSafety')}</p>
        <Label htmlFor="flow-scope">{t('workflowScope')}</Label>
        <div className="flex flex-wrap gap-2"><Input id="flow-scope" className="max-w-xs" value={scope}
          onChange={(e) => changeScope(e.target.value)} placeholder="CUSTOM:CERTIFICATE" />
          {['release-exception', 'invoice-correction'].map((s) =>
            <Button size="sm" variant="outline" key={s} onClick={() => changeScope(s)}>{s}</Button>)}
        </div>
        {!!flows.length && <div className="flex flex-wrap gap-2">
          {flows.map((flow) => <Button size="sm" variant="outline" key={flow.id}
            onClick={() => { changeScope(flow.scope); loadVersion(flow.versions[0]); }}>
            {flow.scope} · {flow.isActive ? t('active') : t('inactive')}</Button>)}
        </div>}
        {existing && <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="flow-version">{t('versions')}</Label>
          <select id="flow-version" className="h-9 rounded-md border bg-card px-2" value={existing.currentVersionId ?? ''}
            onChange={(e) => void act(() => api.post(`/configuration/workflows/${encodeURIComponent(scope)}/activate`, {
              versionId: e.target.value, isActive: existing.isActive }))}>
            <option value="">{t('selectVersion')}</option>
            {existing.versions.map((v) => <option key={v.id} value={v.id}>v{v.version}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={busy || !existing.currentVersionId}
            onClick={() => void act(() => api.post(`/configuration/workflows/${encodeURIComponent(scope)}/activate`, {
              isActive: !existing.isActive }))}>
            {existing.isActive ? t('deactivate') : t('activate')}</Button>
          <Button size="sm" variant="outline" onClick={() => loadVersion(existing.versions[0])}>{t('loadLatestVersion')}</Button>
        </div>}
      </CardContent></Card>
    {!!billLabels.length && <Card><CardHeader><CardTitle>{t('billLabels')}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t('billLabelNotice')}</p>
        {billLabels.map((row) => <div key={row.code} className="flex flex-wrap items-end gap-2">
          <span className="min-w-24 font-mono text-xs">{row.code}</span>
          <Input className="max-w-xs" aria-label={`${row.code} ${t('displayName')}`}
            value={labelEdits[row.code] ?? row.label} onChange={(e) =>
              setLabelEdits((old) => ({ ...old, [row.code]: e.target.value }))} />
          <Button size="sm" variant="outline" disabled={busy || !labelEdits[row.code]?.trim() ||
            labelEdits[row.code] === row.label} onClick={() => void act(() =>
              api.patch(`/configuration/core/bill-labels/${row.code}`, { label: labelEdits[row.code] }))}>
              {t('save')}</Button>
          {row.technicalFallback && <span className="text-xs text-muted-foreground">{t('technicalFallback')}</span>}
        </div>)}
      </CardContent></Card>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>{t('statuses')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('unverifiedLabels')}</p>
          {statusRows.map((status, i) => <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            <div><Label htmlFor={`status-code-${i}`}>{t('code')}</Label><Input id={`status-code-${i}`}
              value={status.code} onChange={(e) => setStatus(i, { code: e.target.value.toUpperCase() })} /></div>
            <div><Label htmlFor={`status-label-${i}`}>{t('displayName')}</Label><Input id={`status-label-${i}`}
              value={status.label} onChange={(e) => setStatus(i, { label: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={status.terminal}
              onChange={(e) => setStatus(i, { terminal: e.target.checked })} />{t('terminal')}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={status.issued}
              onChange={(e) => setStatus(i, { issued: e.target.checked })} />{t('issued')}</label>
            <Button size="sm" variant="outline" disabled={statusRows.length < 2}
              onClick={() => setStatusRows((rows) => rows.filter((_, n) => n !== i))}>{t('remove')}</Button>
          </div>)}
          <Button variant="outline" onClick={() => setStatusRows((rows) => [...rows, emptyStatus()])}>{t('addStatus')}</Button>
        </CardContent></Card>
      <Card><CardHeader><CardTitle>{t('transitions')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {transitionRows.map((row, i) => <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            {(['from', 'to'] as const).map((part) => <div key={part}><Label htmlFor={`${part}-${i}`}>{t(part)}</Label>
              <select id={`${part}-${i}`} className="h-9 w-full rounded-md border bg-card px-2" value={row[part]}
                onChange={(e) => setTransition(i, { [part]: e.target.value })}>
                <option value="">—</option>{statusRows.filter((s) => s.code).map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
              </select></div>)}
            <div><Label htmlFor={`rule-perm-${i}`}>{t('transitionPermission')}</Label><Input id={`rule-perm-${i}`}
              value={row.permission} onChange={(e) => setTransition(i, { permission: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.approval}
              onChange={(e) => setTransition(i, { approval: e.target.checked })} />{t('requiresApproval')}</label>
            {row.approval && <div><Label htmlFor={`appr-perm-${i}`}>{t('approvalPermission')}</Label>
              <Input id={`appr-perm-${i}`} value={row.approvalPermission}
                onChange={(e) => setTransition(i, { approvalPermission: e.target.value })} /></div>}
            <div><Label htmlFor={`exc-perm-${i}`}>{t('exceptionPermission')}</Label>
              <Input id={`exc-perm-${i}`} value={row.exceptionPermission}
                onChange={(e) => setTransition(i, { exceptionPermission: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label htmlFor={`condition-${i}`}>{t('conditionsJson')}</Label>
              <textarea id={`condition-${i}`} rows={2} className="w-full rounded-md border bg-card p-2 font-mono text-xs"
                value={row.conditions} onChange={(e) => setTransition(i, { conditions: e.target.value })} />
              <p className="text-xs text-muted-foreground">{t('conditionHelp')}</p></div>
            <Button size="sm" variant="outline" disabled={transitionRows.length < 2}
              onClick={() => setTransitionRows((rows) => rows.filter((_, n) => n !== i))}>{t('remove')}</Button>
          </div>)}
          <div className="flex flex-wrap gap-2"><Button variant="outline"
            onClick={() => setTransitionRows((rows) => [...rows, emptyTransition()])}>{t('addTransition')}</Button>
            <Button disabled={busy || !scope || statusRows.some((s) => !s.label.trim())}
              onClick={() => void saveVersion()}>{existing ? t('saveVersion') : t('addWorkflow')}</Button></div>
        </CardContent></Card>
    </div>
    {hasPermission('workflow:approve') && hasPermission('release:override') && <Card>
      <CardHeader><CardTitle>{t('pendingReleaseExceptions')}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {pending.map((r) => <div key={r.id} className="rounded-md border p-3 text-sm">
          <p>{t('billId')}: {r.recordId} · {t('outstanding')}: {r.context.outstanding}</p>
          <p>{t('reason')}: {r.context.reason} · {t('paymentState')}: {r.context.payment_state}</p>
          <p className="text-xs text-muted-foreground">{t('requestedBy')}: {r.requestedById}</p>
          <div className="mt-2 flex flex-wrap gap-2"><Input className="max-w-xs" value={note}
            onChange={(e) => setNote(e.target.value)} placeholder={t('decisionNote')} />
            <Button size="sm" disabled={busy} onClick={() => void act(() =>
              api.post(`/configuration/approvals/${r.id}/decide`, { approve: true, note }))}>{t('approve')}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act(() =>
              api.post(`/configuration/approvals/${r.id}/decide`, { approve: false, note }))}>{t('reject')}</Button>
          </div>
        </div>)}
        {!pending.length && <p className="text-sm text-muted-foreground">{t('noPending')}</p>}
      </CardContent></Card>}
  </div>;
}
