'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type {
  NotificationChannel, NotificationConditions, NotificationDelivery, NotificationRecipients,
  NotificationRule, NotificationRuleInput, NotificationTrigger,
} from '@shipping/shared';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';

type Directory = { users: Array<{ id: string; email: string; fullName: string }>;
  roles: Array<{ id: string; code: string; name: string }> };
const TRIGGERS: NotificationTrigger[] = ['OVERDUE_INVOICE', 'PENDING_APPROVAL',
  'JOB_STATUS_CHANGED', 'UNPAID_RELEASE', 'CARGO_DOCUMENT_PENDING'];
const STATUSES: NonNullable<NotificationConditions['toStatuses']> = ['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED'];
const CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL'];
const emptyRecipients = (): NotificationRecipients => ({ userIds: [], roleIds: [] });
const emptyRule = (): NotificationRuleInput => ({
  name: '', trigger: 'OVERDUE_INVOICE', conditions: {}, recipients: emptyRecipients(),
  channels: ['IN_APP'], delayMinutes: 0, repeatMinutes: null, maxPerRecord: 1,
  maxPerDay: null, escalateAfterMinutes: null, escalationRecipients: emptyRecipients(),
});
const selection = <T extends string>(values: T[], value: T) =>
  values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
const errorText = (err: unknown, fallback: string) => err instanceof ApiError ? err.message : fallback;

function RecipientPicker({ value, onChange, directory, title }: {
  value: NotificationRecipients; onChange: (value: NotificationRecipients) => void;
  directory: Directory; title: string;
}) {
  const t = useTranslations('phase10');
  return <fieldset className="rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><p className="mb-1 text-xs text-muted-foreground">{t('roles')}</p>
        <div className="max-h-32 space-y-1 overflow-y-auto">{directory.roles.map((role) =>
          <label className="flex items-center gap-2 text-xs" key={role.id}>
            <input type="checkbox" checked={value.roleIds.includes(role.id)}
              onChange={() => onChange({ ...value, roleIds: selection(value.roleIds, role.id) })} />
            {role.name} ({role.code})</label>)}</div></div>
      <div><p className="mb-1 text-xs text-muted-foreground">{t('users')}</p>
        <div className="max-h-32 space-y-1 overflow-y-auto">{directory.users.map((user) =>
          <label className="flex items-center gap-2 text-xs" key={user.id}>
            <input type="checkbox" checked={value.userIds.includes(user.id)}
              onChange={() => onChange({ ...value, userIds: selection(value.userIds, user.id) })} />
            {user.fullName} ({user.email})</label>)}</div></div>
    </div>
  </fieldset>;
}

export default function NotificationRulesPage() {
  const t = useTranslations('phase10');
  const { hasPermission } = useAuth();
  const allowed = hasPermission('notification:manage');
  const canListRecipients = hasPermission('user:read') && hasPermission('role:read');
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [form, setForm] = useState<NotificationRuleInput>(emptyRule);
  const [selected, setSelected] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<NotificationDelivery[]>([]);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [list, health] = await Promise.all([
        api.get<NotificationRule[]>('/notifications/rules'),
        api.get<{ emailConfigured: boolean }>('/notifications/health'),
      ]);
      setRules(list); setEmailConfigured(health.emailConfigured); setError(null);
      if (canListRecipients) {
        try { setDirectory(await api.get<Directory>('/notifications/rules/recipients')); }
        catch (err) { setDirectory(null); setError(errorText(err, t('loadFailed'))); }
      } else {
        setDirectory(null);
        setError(t('directoryAccessRequired'));
      }
    } catch (err) { setError(errorText(err, t('loadFailed'))); }
    finally { setLoading(false); }
  }, [t, canListRecipients]);
  useEffect(() => { if (allowed) void reload(); }, [allowed, reload]);

  const loadDeliveries = useCallback(async (id: string, page: number) => {
    try { setDeliveries(await api.get<NotificationDelivery[]>(`/notifications/rules/${id}/deliveries?page=${page}`));
      setDeliveryPage(page); setError(null);
    } catch (err) { setError(errorText(err, t('loadFailed'))); }
  }, [t]);
  function choose(rule: NotificationRule | null) {
    setSelected(rule?.id ?? null);
    setForm(rule ? {
      name: rule.name, trigger: rule.trigger, conditions: rule.conditions,
      recipients: rule.recipients, channels: rule.channels, delayMinutes: rule.delayMinutes,
      repeatMinutes: rule.repeatMinutes, maxPerRecord: rule.maxPerRecord,
      maxPerDay: rule.maxPerDay, escalateAfterMinutes: rule.escalateAfterMinutes,
      escalationRecipients: rule.escalationRecipients,
    } : emptyRule());
    setDeliveries([]); setDeliveryPage(1); setMessage(null); setError(null);
    if (rule) void loadDeliveries(rule.id, 1);
  }
  const edit = <K extends keyof NotificationRuleInput>(key: K, value: NotificationRuleInput[K]) =>
    setForm((old) => ({ ...old, [key]: value }));

  async function save() {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (selected) await api.patch(`/notifications/rules/${selected}`, form);
      else await api.post('/notifications/rules', form);
      const list = await api.get<NotificationRule[]>('/notifications/rules');
      setRules(list);
      const edited = selected ? list.find((r) => r.id === selected) : list[0];
      if (edited) choose(edited);
      setMessage(edited?.isActive ? t('savedRule') : t('savedDisabled'));
    } catch (err) { setError(errorText(err, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  async function toggle(rule: NotificationRule) {
    setBusy(true); setError(null);
    try {
      await api.patch(`/notifications/rules/${rule.id}/active`, { isActive: !rule.isActive });
      const list = await api.get<NotificationRule[]>('/notifications/rules'); setRules(list);
      setMessage(!rule.isActive ? t('enabled') : t('disabled'));
    } catch (err) { setError(errorText(err, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  async function runTick() {
    setBusy(true); setError(null);
    try {
      const outcome = await api.post<{ busy?: boolean; discovered: number; processed: number; emailed: number }>('/notifications/tick', {});
      setMessage(outcome.busy ? t('workerBusy') : t('tickResult', outcome));
      if (selected) void loadDeliveries(selected, 1);
    } catch (err) { setError(errorText(err, t('saveFailed'))); }
    finally { setBusy(false); }
  }
  async function retry(id: string) {
    setBusy(true); setError(null);
    try { await api.post(`/notifications/deliveries/${id}/retry`, {});
      if (selected) await loadDeliveries(selected, deliveryPage);
    } catch (err) { setError(errorText(err, t('saveFailed'))); }
    finally { setBusy(false); }
  }

  if (!allowed) return <p>{t('noAccess')}</p>;
  if (loading && !rules.length && !error) return <PageLoader />;
  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: t('rules') }]} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div>
      <h1 className="text-2xl font-semibold">{t('rules')}</h1>
      <p className="text-sm text-muted-foreground">{t('ruleHint')}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => void reload()}>{t('refresh')}</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void runTick()}>{t('runNow')}</Button></div>
    </div>
    {!emailConfigured && <p className="rounded-lg border border-warning/40 p-3 text-sm" role="status">{t('smtpRequired')}</p>}
    {error && <ErrorState message={error} onRetry={() => void reload()} />}
    {message && <p role="status" className="text-sm text-success">{message}</p>}
    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{t('configuredRules')}</CardTitle>
      <Button size="sm" onClick={() => choose(null)}>{t('newRule')}</Button></CardHeader>
      <CardContent className="space-y-2">{rules.length === 0 && <p className="text-sm text-muted-foreground">{t('noRules')}</p>}
        {rules.map((rule) => <div key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
          <div><button className="text-start font-medium text-primary underline-offset-2 hover:underline" onClick={() => choose(rule)}>{rule.name}</button>
            <p className="text-xs text-muted-foreground">{t(`trigger.${rule.trigger}`)} · {t('eventCount', { number: rule._count.events })}</p></div>
          <div className="flex items-center gap-2"><Badge variant={rule.isActive ? 'success' : 'neutral'}>{t(rule.isActive ? 'active' : 'inactive')}</Badge>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle(rule)}>{t(rule.isActive ? 'disable' : 'enable')}</Button></div>
        </div>)}</CardContent></Card>
    {directory && <Card><CardHeader><CardTitle>{selected ? t('editRule') : t('newRule')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div><Label htmlFor="rule-name">{t('ruleName')}</Label>
          <Input id="rule-name" maxLength={160} value={form.name} onChange={(e) => edit('name', e.target.value)} /></div>
          <div><Label htmlFor="rule-trigger">{t('event')}</Label>
            <select id="rule-trigger" className="h-10 w-full rounded-md border bg-card px-2 text-sm" disabled={!!selected} value={form.trigger}
              onChange={(e) => setForm((old) => ({ ...old, trigger: e.target.value as NotificationTrigger, conditions: {} }))}>
              {TRIGGERS.map((trigger) => <option value={trigger} key={trigger}>{t(`trigger.${trigger}`)}</option>)}</select></div></div>
        {(form.trigger === 'OVERDUE_INVOICE' || form.trigger === 'UNPAID_RELEASE') && <div>
          <Label htmlFor="rule-percent">{t('minUnpaidPercent')}</Label>
          <Input id="rule-percent" type="number" min={0} max={100} step={1} placeholder={t('noThreshold')}
            value={form.conditions.minUnpaidPercent ?? ''} onChange={(e) => edit('conditions',
              e.target.value === '' ? {} : { minUnpaidPercent: Number(e.target.value) })} />
          <p className="text-xs text-muted-foreground">{t('noThresholdHint')}</p></div>}
        {form.trigger === 'JOB_STATUS_CHANGED' && <fieldset><legend className="text-sm font-medium">{t('toStatuses')}</legend>
          <p className="text-xs text-muted-foreground">{t('allStatusesHint')}</p>
          <div className="flex flex-wrap gap-3">{STATUSES.map((status) => <label className="flex items-center gap-2 text-sm" key={status}>
            <input type="checkbox" checked={!!form.conditions.toStatuses?.includes(status)}
              onChange={() => { const next = selection(form.conditions.toStatuses ?? [], status);
                edit('conditions', next.length ? { toStatuses: next } : {}); }} />{status}</label>)}</div></fieldset>}
        {form.trigger === 'PENDING_APPROVAL' && <div><Label htmlFor="rule-scopes">{t('approvalScopes')}</Label>
          <Input id="rule-scopes" placeholder="invoice-correction, release-exception, CUSTOM:..."
            value={form.conditions.approvalScopes?.join(', ') ?? ''} onChange={(e) => {
              const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              edit('conditions', next.length ? { approvalScopes: next } : {});
            }} /><p className="text-xs text-muted-foreground">{t('allScopesHint')}</p></div>}
        <RecipientPicker title={t('recipients')} value={form.recipients} directory={directory}
          onChange={(v) => edit('recipients', v)} />
        <fieldset><legend className="text-sm font-medium">{t('channels')}</legend>
          <div className="flex gap-4">{CHANNELS.map((channel) => <label className="flex items-center gap-2 text-sm" key={channel}>
            <input type="checkbox" checked={form.channels.includes(channel)}
              onChange={() => edit('channels', selection(form.channels, channel))} />{t(`channel.${channel}`)}</label>)}</div></fieldset>
        <div className="grid gap-3 sm:grid-cols-3">{(['delayMinutes', 'repeatMinutes', 'maxPerRecord', 'maxPerDay'] as const).map((key) =>
          <div key={key}><Label htmlFor={key}>{t(key)}</Label><Input id={key} type="number" min={key === 'delayMinutes' ? 0 : 1} step={1}
            value={form[key] ?? ''} placeholder={key === 'repeatMinutes' || key === 'maxPerDay' ? t('optional') : undefined}
            onChange={(e) => edit(key, e.target.value === '' && (key === 'repeatMinutes' || key === 'maxPerDay')
              ? null : Number(e.target.value))} /></div>)}</div>
        <p className="text-xs text-muted-foreground">{t('timingHint')}</p>
        <div><Label htmlFor="escalateAfterMinutes">{t('escalateAfterMinutes')}</Label>
          <Input id="escalateAfterMinutes" type="number" min={1} step={1} value={form.escalateAfterMinutes ?? ''}
            placeholder={t('optional')} onChange={(e) => edit('escalateAfterMinutes', e.target.value === '' ? null : Number(e.target.value))} />
          <p className="text-xs text-muted-foreground">{t('escalationHint')}</p></div>
        <RecipientPicker title={t('escalationRecipients')} value={form.escalationRecipients}
          directory={directory} onChange={(v) => edit('escalationRecipients', v)} />
        <Button disabled={busy || !form.name.trim() || !form.channels.length ||
          !form.recipients.userIds.length && !form.recipients.roleIds.length} loading={busy} onClick={() => void save()}>{t('saveRule')}</Button>
      </CardContent></Card>}
    {selected && <Card><CardHeader><CardTitle>{t('deliveryAudit')}</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('deliveryHint')}</p>
      {deliveries.length === 0 && <p className="text-sm">{t('noDeliveries')}</p>}
      {deliveries.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm">
        <div>{t(`channel.${row.channel}`)} · {new Date(row.createdAt).toLocaleString()} · {t('attempts', { number: row.attempts })}
          {row.lastErrorCode && <span className="ms-2 text-xs text-muted-foreground">{row.lastErrorCode}</span>}</div>
        <div className="flex items-center gap-2"><Badge variant={row.status === 'DELIVERED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'neutral'}>{row.status}</Badge>
          {row.channel === 'EMAIL' && row.status === 'FAILED' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void retry(row.id)}>{t('retry')}</Button>}</div>
      </div>)}
      <div className="flex gap-2"><Button size="sm" variant="outline" disabled={deliveryPage <= 1} onClick={() => void loadDeliveries(selected, deliveryPage - 1)}>{t('previous')}</Button>
        <Button size="sm" variant="outline" disabled={deliveries.length < 50} onClick={() => void loadDeliveries(selected, deliveryPage + 1)}>{t('next')}</Button></div>
    </CardContent></Card>}
  </div>;
}
