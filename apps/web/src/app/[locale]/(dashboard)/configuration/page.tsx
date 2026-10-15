'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/AuthProvider';
import { OptionListAdmin } from '@/components/configuration/option-list-admin';
import { FieldAdmin } from '@/components/configuration/field-admin';
import { WorkflowAdmin } from '@/components/configuration/workflow-admin';
import { DocumentTypeAdmin } from '@/components/configuration/document-type-admin';

type Tab = 'lists' | 'fields' | 'types' | 'workflows';

export default function ConfigurationPage() {
  const t = useTranslations('phase9');
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>('lists');
  if (!hasPermission('configuration:manage')) return <p>{t('noAccess')}</p>;
  return <div className="space-y-5">
    <Breadcrumbs items={[{ label: t('configuration') }]} />
    <div><h1 className="text-2xl font-semibold">{t('configuration')}</h1>
      <p className="text-sm text-muted-foreground">{t('safetyNotice')}</p></div>
    <div role="tablist" aria-label={t('configuration')} className="flex flex-wrap gap-2">
      {(['lists', 'fields', 'types', 'workflows'] as const).filter((item) =>
        item !== 'workflows' || hasPermission('workflow:manage')).map((item) =>
        <Button key={item} role="tab" aria-selected={tab === item} size="sm"
          variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>{t(item)}</Button>)}
    </div>
    {tab === 'lists' && <OptionListAdmin />}
    {tab === 'fields' && <FieldAdmin />}
    {tab === 'types' && <DocumentTypeAdmin />}
    {tab === 'workflows' && <WorkflowAdmin />}
  </div>;
}
