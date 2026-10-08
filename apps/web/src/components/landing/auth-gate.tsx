'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from '@/i18n/navigation';

/**
 * Keeps the previous homepage behaviour: a signed-in user who lands on the
 * public page is taken straight to the dashboard.
 *
 * It renders nothing — the landing page itself is static markup, so it stays
 * readable and crawlable while the session is being resolved.
 */
export function AuthGate() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  return null;
}
