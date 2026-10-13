'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Download, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { formatDateTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';

/** Must match the API policy (apps/api attachment-policy.ts). The server enforces it again. */
const CATEGORIES = ['ID_FRONT', 'ID_BACK', 'SIGNATURE'] as const;
type Category = (typeof CATEGORIES)[number];
const ACCEPT_MIME = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_BYTES = 10 * 1024 * 1024;

interface AttachmentItem {
  id: string;
  category: Category;
  filename: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

interface AttachmentList {
  items: AttachmentItem[];
  total: number;
}

interface SignedUrl {
  path: string;
  expiresAt: string;
}

export interface IdentityAttachmentsPanelProps {
  entityType: 'VOUCHER' | 'SALARY_RECORD';
  entityId: string;
}

/**
 * Identity documents (DEC-092) attached to one voucher or salary record. Shown only to users with
 * attachment:read; upload needs attachment:create and attachment:identity. The server decides every
 * action, so these checks only hide controls.
 */
export function IdentityAttachmentsPanel({ entityType, entityId }: IdentityAttachmentsPanelProps) {
  const t = useTranslations('identityAttachments');
  const locale = useLocale();
  const { hasPermission } = useAuth();
  const canRead = hasPermission('attachment:read') && hasPermission('attachment:identity');
  const canCreate = hasPermission('attachment:create') && hasPermission('attachment:identity');
  const canDelete = hasPermission('attachment:delete') && hasPermission('attachment:identity');

  const [items, setItems] = useState<AttachmentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('ID_FRONT');
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const messageFor = useCallback(
    (err: unknown): string => {
      if (err instanceof ApiError) {
        if (err.status === 403) return t('errors.notPermitted');
        if (err.status === 413) return t('errors.tooLarge');
        if (err.status === 415) return t('errors.unsupportedType');
        if (err.status === 404) return t('errors.notFound');
        return err.message;
      }
      return t('errors.generic');
    },
    [t]
  );

  const load = useCallback(async () => {
    try {
      const query = `entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`;
      const result = await api.get<AttachmentList>(`/attachments?${query}`);
      setItems(result.items);
      setError(null);
    } catch (err) {
      setItems([]);
      setError(messageFor(err));
    }
  }, [entityType, entityId, messageFor]);

  useEffect(() => {
    if (canRead) {
      void load();
    }
  }, [canRead, load]);


  async function upload(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT_MIME.includes(file.type)) {
      setError(t('errors.unsupportedType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('errors.tooLarge'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('entityType', entityType);
      form.append('entityId', entityId);
      form.append('category', category);
      form.append('file', file);
      await api.postForm('/attachments', form);
      await load();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function view(id: string) {
    setError(null);
    try {
      const signed = await api.post<SignedUrl>(`/attachments/${id}/url`);
      window.open(`${api.baseUrl}/${signed.path}`, '_blank', 'noopener');
    } catch (err) {
      setError(messageFor(err));
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/attachments/${id}`);
      setConfirmId(null);
      await load();
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canRead) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-md border p-4" aria-labelledby="identity-attachments-title">
      <div>
        <h3 id="identity-attachments-title" className="text-sm font-semibold">
          {t('title')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('description')}</p>
      </div>

      {items === null ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="divide-y text-sm">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.filename}</div>
                <div className="text-xs text-muted-foreground">
                  {t(`categories.${item.category}`)} · {formatBytes(item.size)} ·{' '}
                  {formatDateTime(item.uploadedAt, locale)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void view(item.id)}>
                  <Download className="mr-1 h-4 w-4" aria-hidden />
                  {t('actions.view')}
                </Button>
                {canDelete &&
                  (confirmId === item.id ? (
                    <Button variant="destructive" size="sm" disabled={busy} onClick={() => void remove(item.id)}>
                      {t('actions.confirmDelete')}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(item.id)}>
                      <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                      {t('actions.delete')}
                    </Button>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canCreate && (
        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${entityType}-${entityId}-category`}>{t('fields.category')}</Label>
            <select
              id={`${entityType}-${entityId}-category`}
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${entityType}-${entityId}-file`}>{t('fields.file')}</Label>
            <input
              id={`${entityType}-${entityId}-file`}
              type="file"
              accept={ACCEPT_MIME.join(',')}
              disabled={busy}
              className="text-sm"
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          {busy && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Upload className="h-4 w-4" aria-hidden />
              {t('actions.uploading')}
            </span>
          )}
          <p className="w-full text-xs text-muted-foreground">{t('hint')}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
