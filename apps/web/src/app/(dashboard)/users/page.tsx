'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PaginatedResult, RoleListItem, UserListItem } from '@shipping/shared';
import { Users, Plus, KeyRound, Power, ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { PageLoader } from '@/components/ui/loading';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { hasPermission, user: me } = useAuth();
  const [data, setData] = useState<PaginatedResult<UserListItem> | null>(null);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [toggling, setToggling] = useState<UserListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive !== false), [roles]);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
    if (q) params.set('search', q);
    try {
      const [userData, roleData] = await Promise.all([
        api.get<PaginatedResult<UserListItem>>(`/users?${params.toString()}`),
        api.get<RoleListItem[]>('/roles/active'),
      ]);
      setData(userData);
      setRoles(roleData);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, search);
  }, [load, page, search]);

  const canCreate = hasPermission('user:create');
  const canUpdate = hasPermission('user:update');
  const canActivate = hasPermission('user:activate');
  const canRoles = hasPermission('user:roles');

  function openCreate() {
    setEmail('');
    setFullName('');
    setPassword('');
    setSelectedRoleIds([]);
    setFormError(null);
    setCreateOpen(true);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || !fullName.trim() || !password) {
      setFormError('Email, name and password are required.');
      return;
    }
    if (selectedRoleIds.length === 0) {
      setFormError('Assign at least one role.');
      return;
    }
    setSaving(true);
    try {
      await api.post<UserListItem>('/users', {
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        roleIds: selectedRoleIds,
      });
      setCreateOpen(false);
      setPage(1);
      await load(1, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  function openRoles(user: UserListItem) {
    setEditing(user);
    setSelectedRoleIds(user.roles.map((r) => r.id));
    setFormError(null);
  }

  async function saveRoles() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<UserListItem>(`/users/${editing.id}/roles`, {
        roleIds: selectedRoleIds,
      });
      setEditing(null);
      await load(page, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update roles');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<UserListItem>(`/users/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!resetting) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.post<{ reset: true }>(`/users/${resetting.id}/reset-password`, {
        newPassword: 'ChangeMe123!',
      });
      setResetting(null);
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: 'Users' }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Staff accounts. Password hashes are never exposed by the API.
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New user
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">User registry</CardTitle>
          <CardDescription>Active staff accounts and their access.</CardDescription>
        </CardHeader>
        <CardContent className="border-b border-border pb-3 pt-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
            }}
            className="flex flex-wrap gap-2"
          >
            <Input
              className="max-w-xs"
              placeholder="Search email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search users"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label="Loading users…" />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title="No users found" description="Try a different search term." />
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Roles</th>
                  <th className="px-3 py-2 text-right font-medium">Last login</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {initials(u.fullName)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {u.fullName}
                            </span>
                            {u.id === me?.id && <Badge variant="info">You</Badge>}
                          </div>
                          <div className="truncate text-[12px] text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="neutral">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        ) : (
                          u.roles.map((r) => (
                            <Badge key={r.id} variant="outline" className="text-[11px]">
                              {r.code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] tabular-nums text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Never'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canRoles && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openRoles(u)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Roles
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setResetting(u)}
                            title="Reset password to ChangeMe123!"
                            aria-label={`Reset password for ${u.email}`}
                          >
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canActivate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setToggling(u)}
                            disabled={u.id === me?.id && u.isActive}
                            title={
                              u.id === me?.id && u.isActive
                                ? 'You cannot disable your own account'
                                : u.isActive
                                  ? 'Deactivate'
                                  : 'Activate'
                            }
                            aria-label={u.isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.meta.totalPages > 1 && (
          <CardFooter className="block px-0">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={data.meta.totalItems}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          </CardFooter>
        )}
      </Card>

      {/* Create user dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="New user"
        description="Create a staff account. The user must change their password on first sign-in."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={createUser}>
              Create user
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-email" className="block">
              Email
            </Label>
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@shipping.local"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-name" className="block">
              Full name
            </Label>
            <Input
              id="user-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-password" className="block">
              Temporary password
            </Label>
            <Input
              id="user-password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
            <p className="text-xs text-muted-foreground">This is shown once; change it on first use.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="block">Roles</Label>
            <div className="flex flex-wrap gap-1.5">
              {activeRoles.length === 0 && (
                <span className="text-xs text-muted-foreground">No active roles available.</span>
              )}
              {activeRoles.map((r) => {
                const checked = selectedRoleIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={cn(
                      'inline-flex cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                      checked
                        ? 'border-primary/40 bg-primary/10 text-foreground'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-[hsl(var(--primary))]"
                      checked={checked}
                      onChange={() => {
                        setSelectedRoleIds((prev) =>
                          prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                        );
                      }}
                    />
                    {r.code}
                  </label>
                );
              })}
            </div>
          </div>
          {formError && <p className="text-xs text-destructive" role="alert">{formError}</p>}
        </div>
      </Dialog>

      {/* Roles dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Roles — ${editing.fullName}` : 'Roles'}
        description="Choose the roles assigned to this user."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button size="sm" loading={saving} onClick={saveRoles}>
              Save roles
            </Button>
          </>
        }
      >
        {formError && <p className="mb-3 text-xs text-destructive" role="alert">{formError}</p>}
        <div className="flex flex-wrap gap-1.5">
          {activeRoles.length === 0 && (
            <span className="text-xs text-muted-foreground">No active roles available.</span>
          )}
          {activeRoles.map((r) => {
            const checked = selectedRoleIds.includes(r.id);
            return (
              <label
                key={r.id}
                className={cn(
                  'inline-flex cursor-pointer select-none items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                  checked
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-accent'
                )}
              >
                <input
                  type="checkbox"
                  className="accent-[hsl(var(--primary))]"
                  checked={checked}
                  onChange={() => {
                    setSelectedRoleIds((prev) =>
                      prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                    );
                  }}
                />
                {r.code}
              </label>
            );
          })}
        </div>
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? 'Deactivate user' : 'Activate user'}
        description={
          toggling?.isActive
            ? `Deactivating "${toggling?.fullName}" prevents them from signing in and revokes their sessions.`
            : `Re-activating "${toggling?.fullName}" lets them sign in again.`
        }
        confirmLabel={toggling?.isActive ? 'Deactivate' : 'Activate'}
        destructive={toggling?.isActive}
        loading={saving}
        onConfirm={toggleActive}
      />

      {/* Reset password confirm */}
      <ConfirmDialog
        open={!!resetting}
        onOpenChange={(open) => !open && setResetting(null)}
        title="Reset password"
        description={`Reset the password for "${resetting?.fullName}" to the temporary password ChangeMe123!. Their existing sessions will be revoked.`}
        confirmLabel="Reset password"
        loading={saving}
        onConfirm={resetPassword}
      />
    </div>
  );
}