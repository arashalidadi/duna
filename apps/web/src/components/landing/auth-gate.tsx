'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { postLoginRoute } from '@/lib/auth/post-login-route';
import { useRouter } from '@/i18n/navigation';

/** Send signed-in visitors to their permitted landing page. Public markup stays static. */
export function AuthGate() {
  const { status, permissions } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace(postLoginRoute(permissions));
  }, [status, router, permissions]);

  return null;
}
