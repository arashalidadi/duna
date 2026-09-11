'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { CurrentUser, LoginResponse, RefreshResponse } from '@shipping/shared';
import { api, ApiError, setAccessToken, getAccessToken } from '@/lib/api/client';

/** Shape returned by GET /auth/me. */
interface MeResponse {
  user: CurrentUser;
  permissions: string[];
}

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  permissions: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_KEY = 'shipping_refresh_token';

function readRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function storeRefreshToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Attempts to contact /auth/me using the stored access token. If the access
 * token is expired/invalid, tries a silent refresh with the stored refresh
 * token (token rotation handled server-side), then retries /auth/me once.
 * Returns the current user on success or null on failure.
 */
async function resolveSession(): Promise<{ user: CurrentUser; permissions: string[] } | null> {
  const access = getAccessToken();
  if (!access) return null;

  async function me(): Promise<MeResponse | null> {
    try {
      return await api.get<MeResponse>('/auth/me');
    } catch (e) {
      return e instanceof ApiError && e.status === 401 ? null : (() => { throw e; })();
    }
  }

  const fresh = await me();
  if (fresh) return fresh;

  // Expired access token — try silent refresh.
  const refreshToken = readRefreshToken();
  if (!refreshToken) return null;
  try {
    const pair = await api.post<RefreshResponse>('/auth/refresh', { refreshToken });
    setAccessToken(pair.accessToken);
    storeRefreshToken(pair.refreshToken);
    const retry = await me();
    return retry;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  const applyUser = useCallback((u: CurrentUser, perms: string[]) => {
    setUser(u);
    setPermissions(perms);
    setStatus('authenticated');
  }, []);

  // Restore / validate session on first render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await resolveSession();
      if (cancelled) return;
      if (session) {
        applyUser(session.user, session.permissions);
      } else {
        setAccessToken(null);
        storeRefreshToken(null);
        setUser(null);
        setPermissions([]);
        setStatus('unauthenticated');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      });
      setAccessToken(res.accessToken);
      storeRefreshToken(res.refreshToken);
      applyUser(res.user, res.permissions ?? []);
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    const refreshToken = readRefreshToken();
    try {
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch {
      /* best-effort: revocation failure must not block a local logout */
    } finally {
      setAccessToken(null);
      storeRefreshToken(null);
      setUser(null);
      setPermissions([]);
      setStatus('unauthenticated');
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const session = await resolveSession();
      if (session) {
        applyUser(session.user, session.permissions);
        return true;
      }
    } catch {
      /* fall through */
    }
    return false;
  }, [applyUser]);

  const hasPermission = useCallback(
    (permission: string) => permissions.includes(permission),
    [permissions]
  );
  const hasAnyPermission = useCallback(
    (perms: string[]) => perms.some((p) => permissions.includes(p)),
    [permissions]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      permissions,
      login,
      logout,
      hasPermission,
      hasAnyPermission,
      refreshSession,
    }),
    [status, user, permissions, login, logout, hasPermission, hasAnyPermission, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}