'use client';

import { useTranslations } from 'next-intl';
import { ErrorState } from '@/components/ui/error-state';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { AppShell } from '@/components/layout/app-shell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status, refreshSession, logout } = useAuth();
  const t = useTranslations('workspaceUi');
  const common = useTranslations('common');
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  if (status === 'unavailable')
    return (
      <main className="mx-auto max-w-xl px-4 py-20">
        <ErrorState
          title={t('serviceUnavailable')}
          message={t('serviceUnavailableDescription')}
          onRetry={() => void refreshSession()}
        />
        <Button variant="ghost" className="mt-4" onClick={() => logout()}>
          {common('signOut')}
        </Button>
      </main>
    );

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
        <span className="sr-only">{common('loading')}</span>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
