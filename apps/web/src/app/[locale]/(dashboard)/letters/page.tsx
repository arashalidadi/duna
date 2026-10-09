'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import type { Letter, LetterListResult, LetterStatus, LetterDirection } from '@shipping/shared';
import { api, ApiError } from '@/lib/api/client';
import { formatDateTime, formatDateShort } from '@/lib/date';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import {
  Eye,
  Pencil,
  Trash2,
  Plus,
  Send,
  Archive,
  Reply,
  Inbox,
  SendHorizontal,
} from 'lucide-react';

const PAGE_SIZE = 20;

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring';

const LETTER_STATUSES: LetterStatus[] = ['DRAFT', 'SENT', 'RECEIVED', 'ARCHIVED'];
const LETTER_DIRECTIONS: LetterDirection[] = ['INCOMING', 'OUTGOING'];

function statusVariant(s: LetterStatus): 'info' | 'success' | 'danger' | 'outline' {
  if (s === 'SENT') return 'info';
  if (s === 'RECEIVED') return 'success';
  if (s === 'ARCHIVED') return 'danger';
  return 'outline';
}

function dateShort(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

const emptyForm = {
  direction: 'OUTGOING' as LetterDirection,
  letterDate: new Date().toISOString().slice(0, 10),
  subject: '',
  body: '',
  refNumber: '',
  fromContact: '',
  toContact: '',
  notes: '',
  replyToId: '',
};

export default function LettersPage() {
  const t = useTranslations('letters');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [rows, setRows] = useState<Letter[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: PAGE_SIZE, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Letter | null>(null);
  const [replyTo, setReplyTo] = useState<Letter | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<Letter | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Letter | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (directionFilter !== 'ALL') params.set('direction', directionFilter);
      const res = await api.get<LetterListResult>(`/letters?${params.toString()}`);
      setRows(res.data);
      setMeta(res.meta);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, directionFilter, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── create / edit / reply ─────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setReplyTo(null);
    setForm({ ...emptyForm, letterDate: new Date().toISOString().slice(0, 10) });
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (l: Letter) => {
    setEditing(l);
    setReplyTo(null);
    setForm({
      direction: l.direction,
      letterDate: dateShort(l.letterDate),
      subject: l.subject,
      body: l.body ?? '',
      refNumber: l.refNumber ?? '',
      fromContact: l.fromContact ?? '',
      toContact: l.toContact ?? '',
      notes: l.notes ?? '',
      replyToId: l.replyToId ?? '',
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const openReply = (l: Letter) => {
    setEditing(null);
    setReplyTo(l);
    setForm({
      ...emptyForm,
      letterDate: new Date().toISOString().slice(0, 10),
      subject: l.subject.startsWith('Re: ') ? l.subject : `Re: ${l.subject}`,
      toContact: l.fromContact ?? '',
      refNumber: l.refNumber ?? '',
      replyToId: l.id,
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const submit = async () => {
    if (!form.subject.trim()) {
      setFormError(t('form.errors.subjectRequired'));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        direction: form.direction,
        letterDate: form.letterDate,
        subject: form.subject.trim(),
        body: form.body || undefined,
        refNumber: form.refNumber || undefined,
        fromContact: form.fromContact || undefined,
        toContact: form.toContact || undefined,
        notes: form.notes || undefined,
        replyToId: form.replyToId || undefined,
      };
      if (editing) await api.patch(`/letters/${editing.id}`, payload);
      else await api.post('/letters', payload);
      setCreateOpen(false);
      setPage(1);
      void load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : tc('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  // ── actions ────────────────────────────────────────────────────────────────

  const act = async (fn: () => Promise<unknown>) => {
    setActing(true);
    try {
      await fn();
      if (detail) await openDetail(detail.id);
      else void load();
    } catch {
      void load();
    } finally {
      setActing(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      setDetail(await api.get<Letter>(`/letters/${id}`));
    } catch {
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('page.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('page.description')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="me-1.5 h-4 w-4" />
          {t('actions.create')}
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
            }}
          >
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('list.search')}
              className="w-56"
            />
            <Button type="submit" variant="outline" size="sm">
              {tc('actions.search')}
            </Button>
          </form>
          <select
            className={SELECT_CLASS}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">{t('list.allStatuses')}</option>
            {LETTER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS}
            value={directionFilter}
            onChange={(e) => {
              setDirectionFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">{t('list.allDirections')}</option>
            {LETTER_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {t(`direction.${d}`)}
              </option>
            ))}
          </select>
          <span className="ms-auto text-sm text-muted-foreground">
            {tc('list.total')}: {meta.totalItems}
          </span>
        </CardContent>
      </Card>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t('list.empty.title')} description={t('list.empty.description')} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <TableScroll className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-muted-foreground">
                    <th className="p-3 text-start">{t('fields.number')}</th>
                    <th className="p-3 text-start">{t('fields.direction')}</th>
                    <th className="p-3 text-start">{t('fields.subject')}</th>
                    <th className="p-3 text-start">{t('fields.date')}</th>
                    <th className="p-3 text-start">{t('fields.contact')}</th>
                    <th className="p-3 text-start">{t('fields.status')}</th>
                    <th className="p-3 text-end">{tc('actions.title')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="p-3 font-mono text-xs">
                        {l.letterNumber}
                        {l.replyToId ? <span className="ms-1 text-muted-foreground">↩</span> : null}
                        {l.repliesCount ? (
                          <span className="ms-1 text-muted-foreground">({l.repliesCount})</span>
                        ) : null}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5">
                          {l.direction === 'INCOMING' ? (
                            <Inbox className="h-3.5 w-3.5" />
                          ) : (
                            <SendHorizontal className="h-3.5 w-3.5" />
                          )}
                          {t(`direction.${l.direction}`)}
                        </span>
                      </td>
                      <td className="max-w-[280px] truncate p-3" title={l.subject}>
                        {l.subject}
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {formatDateShort(l.letterDate, locale)}
                      </td>
                      <td className="max-w-[180px] truncate p-3">
                        {l.direction === 'INCOMING' ? (l.fromContact ?? '—') : (l.toContact ?? '—')}
                      </td>
                      <td className="p-3">
                        <Badge variant={statusVariant(l.status)}>{t(`status.${l.status}`)}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('actions.view')}
                            onClick={() => void openDetail(l.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {l.status === 'DRAFT' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t('actions.edit')}
                                onClick={() => openEdit(l)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={t('actions.send')}
                                onClick={() => void act(() => api.post(`/letters/${l.id}/send`))}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title={tc('actions.delete')}
                                onClick={() => setDeleteTarget(l)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {(l.status === 'SENT' || l.status === 'RECEIVED') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('actions.archive')}
                              onClick={() => void act(() => api.post(`/letters/${l.id}/archive`))}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <div className="p-3">
              <Pagination
                page={meta.page}
                pageSize={meta.pageSize}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* create / edit / reply dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          if (!saving) setCreateOpen(o);
        }}
        title={editing ? t('form.editTitle') : replyTo ? t('form.replyTitle') : t('form.title')}
        description={replyTo ? t('form.replyDescription') : t('form.description')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              {tc('actions.cancel')}
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? tc('actions.saving') : tc('actions.save')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {formError && <p className="text-sm text-destructive">{formError}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.direction')}</Label>
              <select
                className={SELECT_CLASS + ' w-full'}
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as LetterDirection })}
                disabled={!!editing}
              >
                {LETTER_DIRECTIONS.map((d) => (
                  <option key={d} value={d}>
                    {t(`direction.${d}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.date')}</Label>
              <Input
                type="date"
                value={form.letterDate}
                onChange={(e) => setForm({ ...form, letterDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.subject')}</Label>
            <Input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('fields.fromContact')}</Label>
              <Input
                value={form.fromContact}
                onChange={(e) => setForm({ ...form, fromContact: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('fields.toContact')}</Label>
              <Input
                value={form.toContact}
                onChange={(e) => setForm({ ...form, toContact: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.refNumber')}</Label>
            <Input
              value={form.refNumber}
              onChange={(e) => setForm({ ...form, refNumber: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.body')}</Label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={5}
              className="w-full rounded-md border border-input bg-card p-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fields.notes')}</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      </Dialog>

      {/* detail dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setDetail(null);
        }}
        title={detail ? detail.letterNumber : t('detail.title')}
      >
        {detailLoading || !detail ? (
          <PageLoader />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detail.status)}>{t(`status.${detail.status}`)}</Badge>
              <span className="inline-flex items-center gap-1.5 text-sm">
                {detail.direction === 'INCOMING' ? (
                  <Inbox className="h-3.5 w-3.5" />
                ) : (
                  <SendHorizontal className="h-3.5 w-3.5" />
                )}
                {t(`direction.${detail.direction}`)}
              </span>
            </div>
            <p className="font-medium">{detail.subject}</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">{t('fields.date')}: </span>
                {formatDateShort(detail.letterDate, locale)}
              </div>
              <div>
                <span className="text-muted-foreground">{t('fields.refNumber')}: </span>
                {detail.refNumber ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">{t('fields.fromContact')}: </span>
                {detail.fromContact ?? '—'}
              </div>
              <div>
                <span className="text-muted-foreground">{t('fields.toContact')}: </span>
                {detail.toContact ?? '—'}
              </div>
            </div>
            {detail.customer && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('fields.customer')}: </span>
                {detail.customer.name} ({detail.customer.code})
              </div>
            )}
            {detail.replyTo && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <span className="text-muted-foreground">{t('detail.inReplyTo')}: </span>
                <span className="font-mono">{detail.replyTo.letterNumber}</span> —{' '}
                {detail.replyTo.subject}
              </div>
            )}
            {detail.body && (
              <div className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm">
                {detail.body}
              </div>
            )}
            {detail.notes && <p className="text-xs text-muted-foreground">{detail.notes}</p>}
            <div className="text-xs text-muted-foreground">
              {detail.sentAt && (
                <div>
                  {t('detail.sentOn')}: {formatDateTime(detail.sentAt, locale)}
                </div>
              )}
              {detail.archivedAt && (
                <div>
                  {t('detail.archivedOn')}: {formatDateTime(detail.archivedAt, locale)}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {detail.status === 'DRAFT' && (
                <>
                  <Button variant="outline" onClick={() => openEdit(detail)} disabled={acting}>
                    <Pencil className="me-1.5 h-4 w-4" />
                    {t('actions.edit')}
                  </Button>
                  <Button
                    onClick={() => void act(() => api.post(`/letters/${detail.id}/send`))}
                    disabled={acting}
                  >
                    <Send className="me-1.5 h-4 w-4" />
                    {t('actions.send')}
                  </Button>
                </>
              )}
              {(detail.status === 'SENT' || detail.status === 'RECEIVED') && (
                <Button
                  variant="outline"
                  onClick={() => void act(() => api.post(`/letters/${detail.id}/archive`))}
                  disabled={acting}
                >
                  <Archive className="me-1.5 h-4 w-4" />
                  {t('actions.archive')}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setDetailOpen(false);
                  openReply(detail);
                }}
              >
                <Reply className="me-1.5 h-4 w-4" />
                {t('actions.reply')}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={t('confirm.delete.title')}
        description={
          deleteTarget ? t('confirm.delete.description', { number: deleteTarget.letterNumber }) : ''
        }
        confirmLabel={tc('actions.delete')}
        loading={acting}
        onConfirm={() =>
          void (async () => {
            const target = deleteTarget;
            setDeleteTarget(null);
            await act(() => api.del(`/letters/${target?.id}`));
          })()
        }
        error={formError}
      />
    </div>
  );
}
