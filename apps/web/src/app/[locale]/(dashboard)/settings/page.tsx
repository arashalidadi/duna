'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';

interface CompanySettings {
  id: string;
  companyName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCurrency: string;
  supportedCurrencies: string[];
}

interface CurrencyOption {
  code: string;
  name: string;
}

type TextField =
  | 'companyName'
  | 'legalName'
  | 'registrationNumber'
  | 'taxNumber'
  | 'address'
  | 'city'
  | 'country'
  | 'phone'
  | 'email'
  | 'website';

const TEXT_FIELDS: TextField[] = [
  'companyName',
  'legalName',
  'registrationNumber',
  'taxNumber',
  'address',
  'city',
  'country',
  'phone',
  'email',
  'website',
];

export default function CompanySettingsPage() {
  const t = useTranslations('companySettings');
  const { hasPermission } = useAuth();
  const canRead = hasPermission('settings:read');
  const canUpdate = hasPermission('settings:update');

  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [form, setForm] = useState<Record<TextField, string>>(emptyForm());
  const [supported, setSupported] = useState<string[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const applySettings = useCallback((data: CompanySettings) => {
    setSettings(data);
    setForm({
      companyName: data.companyName ?? '',
      legalName: data.legalName ?? '',
      registrationNumber: data.registrationNumber ?? '',
      taxNumber: data.taxNumber ?? '',
      address: data.address ?? '',
      city: data.city ?? '',
      country: data.country ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
      website: data.website ?? '',
    });
    setSupported(data.supportedCurrencies);
    setDefaultCurrency(data.defaultCurrency);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, list] = await Promise.all([
        api.get<CompanySettings | null>('/company-settings'),
        hasPermission('currency:read')
          ? api.get<CurrencyOption[]>('/currencies')
          : Promise.resolve<CurrencyOption[]>([]),
      ]);
      if (data) applySettings(data);
      setCurrencies(list);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? t('errors.notPermitted') : t('errors.load'));
    } finally {
      setLoading(false);
    }
  }, [applySettings, hasPermission, t]);

  useEffect(() => {
    if (canRead) {
      void load();
    } else {
      setLoading(false);
    }
  }, [canRead, load]);

  function toggleCurrency(code: string) {
    setSaved(false);
    setSupported((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      if (!next.includes(defaultCurrency) && next.length > 0) {
        setDefaultCurrency(next[0]);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      // Empty strings are sent as-is; the API trims them and clears optional fields.
      const updated = await api.patch<CompanySettings>('/company-settings', {
        ...form,
        supportedCurrencies: supported,
        defaultCurrency,
      });
      applySettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errors.save'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <PageLoader />;
  }
  if (!canRead) {
    return <ErrorState title={t('errors.notPermitted')} />;
  }

  const disabled = !canUpdate || saving;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={[{ label: t('page.breadcrumb') }]} />
        <h1 className="mt-2 text-lg font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('page.description')}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!settings && !error && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.identity')}</CardTitle>
          <CardDescription>{t('sections.identityHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <div key={field} className={field === 'address' ? 'space-y-1.5 md:col-span-2' : 'space-y-1.5'}>
                <Label htmlFor={`cs-${field}`}>{t(`fields.${field}`)}</Label>
                <Input
                  id={`cs-${field}`}
                  value={form[field]}
                  disabled={disabled}
                  maxLength={field === 'address' ? 500 : 255}
                  onChange={(e) => {
                    setSaved(false);
                    setForm({ ...form, [field]: e.target.value });
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sections.currencies')}</CardTitle>
          <CardDescription>{t('sections.currenciesHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="flex flex-wrap gap-4" disabled={disabled}>
            <legend className="sr-only">{t('fields.supportedCurrencies')}</legend>
            {currencies.map((c) => (
              <label key={c.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={supported.includes(c.code)}
                  onChange={() => toggleCurrency(c.code)}
                />
                {c.code} <span className="text-muted-foreground">{c.name}</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="cs-default-currency">{t('fields.defaultCurrency')}</Label>
            <select
              id="cs-default-currency"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={defaultCurrency}
              disabled={disabled || supported.length === 0}
              onChange={(e) => {
                setSaved(false);
                setDefaultCurrency(e.target.value);
              }}
            >
              {supported.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        {canUpdate ? (
          <Button onClick={() => void save()} disabled={saving || !settings || !form.companyName.trim()}>
            {saving ? t('actions.saving') : t('actions.save')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('readOnly')}</p>
        )}
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            {t('actions.saved')}
          </span>
        )}
      </div>
    </div>
  );
}

function emptyForm(): Record<TextField, string> {
  return Object.fromEntries(TEXT_FIELDS.map((f) => [f, ''])) as Record<TextField, string>;
}
