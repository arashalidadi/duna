'use client';
import { TableScroll } from '@/components/ui/table-scroll';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';

import { useLocale as useUiLocale } from 'next-intl';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const uiLocale = useUiLocale();
  const ui = useUiTranslations('legacyUi');
  const { hasPermission, user: me } = useAuth();
  const [data, setData] = useState<PaginatedResult<UserListItem> | null>(null);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserListItem | null>(null);
  const [resetting, setResetting] = useState<UserListItem | null>(null);
  const [toggling, setToggling] = useState<UserListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [resetValue, setResetValue] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; code: string }[]>([]);
  const [portalSel, setPortalSel] = useState('');

  const activeRoles = useMemo(() => roles.filter((r) => r.isActive !== false), [roles]);

  const load = useCallback(
    async (p: number, q: string) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      try {
        const [userData, roleData, customerData] = await Promise.all([
          api.get<PaginatedResult<UserListItem>>(`/users?${params.toString()}`),
          api.get<RoleListItem[]>('/roles/active'),
          api.get<PaginatedResult<{ id: string; name: string; code: string }>>(
            '/customers?pageSize=200'
          ),
        ]);
        setData(userData);
        setRoles(roleData);
        setCustomers(customerData.data ?? []);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadUsers'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page, debouncedSearch);
  }, [load, page, debouncedSearch]);

  const canCreate = hasPermission('user:create');
  const canUpdate = hasPermission('user:update');
  const canActivate = hasPermission('user:activate');
  const canRoles = hasPermission('user:roles');

  function openCreate() {
    setEmail('');
    setFullName('');
    setPassword('');
    setSelectedRoleIds([]);
    setPortalSel('');
    setFormError(null);
    setCreateOpen(true);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!email.trim() || !fullName.trim() || !password) {
      setFormError(ui('emailNameAndPasswordAreRequired'));
      return;
    }
    if (selectedRoleIds.length === 0) {
      setFormError(ui('assignAtLeastOneRole'));
      return;
    }
    setSaving(true);
    try {
      await api.post<UserListItem>('/users', {
        email: email.trim(),
        fullName: fullName.trim(),
        password,
        roleIds: selectedRoleIds,
        ...(portalSel ? { portalCustomerId: portalSel } : {}),
      });
      setCreateOpen(false);
      setPage(1);
      await load(1, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToCreateUser'));
    } finally {
      setSaving(false);
    }
  }

  function openRoles(user: UserListItem) {
    setEditing(user);
    setSelectedRoleIds(user.roles.map((r) => r.id));
    setPortalSel(user.portalCustomerId ?? '');
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
      const wanted = portalSel || null;
      if (wanted !== (editing.portalCustomerId ?? null)) {
        await api.patch(`/users/${editing.id}`, { portalCustomerId: wanted });
      }
      setEditing(null);
      await load(page, search);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdateRoles'));
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
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdateUser'));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (!resetting || resetValue.length < 8) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.post<{ reset: true }>(`/users/${resetting.id}/reset-password`, {
        newPassword: resetValue,
      });
      setResetting(null);
      setResetValue('');
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToResetPassword'));
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
          <Breadcrumbs items={[{ label: ui('users') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('users')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('staffAccountsPasswordHashesAreNeverExposedByTheAPI')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newUser')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('userRegistry')}</CardTitle>
          <CardDescription>{ui('activeStaffAccountsAndTheirAccess')}</CardDescription>
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
              placeholder={ui('searchEmailOrName')}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={ui('searchUsers')}
            />
            <Button type="submit" variant="secondary">
              {ui('search')}
            </Button>
          </form>
        </CardContent>
        {loading ? (
          <PageLoader label={ui('loadingUsers')} />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page, search)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title={ui('noUsersFound')} description={ui('tryADifferentSearchTerm')} />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('user')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 font-medium">{ui('roles')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('lastLogin')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
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
                            {u.id === me?.id && <Badge variant="info">{ui('you')}</Badge>}
                          </div>
                          <div className="truncate text-[12px] text-muted-foreground">
                            {u.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <Badge variant="success">{ui('active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{ui('inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">{ui('noRoles')}</span>
                        ) : (
                          u.roles.map((r) => (
                            <Badge key={r.id} variant="outline" className="text-[11px]">
                              {r.code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-end text-[12px] tabular-nums text-muted-foreground">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString(uiLocale, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ui('never')}
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
                            {ui('roles')}
                          </Button>
                        )}
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setResetValue('');
                              setFormError(null);
                              setResetting(u);
                            }}
                            title={ui('resetPassword')}
                            aria-label={ui('resetPasswordForValue', { value0: String(u.email) })}
                          >
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                        {canActivate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setFormError(null);
                              setToggling(u);
                            }}
                            disabled={u.id === me?.id && u.isActive}
                            title={
                              u.id === me?.id && u.isActive
                                ? ui('youCannotDisableYourOwnAccount')
                                : u.isActive
                                  ? ui('deactivate')
                                  : ui('activate')
                            }
                            aria-label={u.isActive ? ui('deactivateUser') : ui('activateUser')}
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
          </TableScroll>
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
        title={ui('newUser')}
        description={ui('createAStaffAccountWithTheAppropriateRoles')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={createUser}>
              {ui('createUser')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="user-email" className="block">
              {ui('email')}
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
              {ui('fullName')}
            </Label>
            <Input
              id="user-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={ui('janeDoe')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user-password" className="block">
              {ui('temporaryPassword')}
            </Label>
            <Input
              id="user-password"
              type="text"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={ui('min8Characters')}
            />
            <p className="text-xs text-muted-foreground">
              {ui('shareThePasswordSecurelyWithTheUser')}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="block">{ui('roles')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {activeRoles.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {ui('noActiveRolesAvailable')}
                </span>
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
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </div>
      </Dialog>

      {/* Roles dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? ui('rolesValue', { value0: String(editing.fullName) }) : ui('roles')}
        description={ui('chooseTheRolesAssignedToThisUser')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={saveRoles}>
              {ui('saveRoles')}
            </Button>
          </>
        }
      >
        {formError && (
          <p className="mb-3 text-xs text-destructive" role="alert">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {activeRoles.length === 0 && (
            <span className="text-xs text-muted-foreground">{ui('noActiveRolesAvailable')}</span>
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
        title={toggling?.isActive ? ui('deactivateUser') : ui('activateUser')}
        description={
          toggling?.isActive
            ? ui('deactivatingValuePreventsThemFromSigningInAndRevokesTheirSessions', {
                value0: String(toggling?.fullName),
              })
            : ui('reActivatingValueLetsThemSignInAgain', { value0: String(toggling?.fullName) })
        }
        confirmLabel={toggling?.isActive ? ui('deactivate') : ui('activate')}
        destructive={toggling?.isActive}
        loading={saving}
        onConfirm={toggleActive}
        error={formError}
      />

      <Dialog
        open={!!resetting}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setResetting(null);
            setResetValue('');
          }
        }}
        title={ui('resetPasswordTitle')}
        description={ui('resetPasswordDescription', { name: resetting?.fullName ?? '' })}
        footer={
          <>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                setResetting(null);
                setResetValue('');
              }}
            >
              {ui('cancelAction')}
            </Button>
            <Button loading={saving} disabled={resetValue.length < 8} onClick={resetPassword}>
              {ui('resetPasswordTitle')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void resetPassword();
          }}
          className="space-y-3"
        >
          <Label htmlFor="reset-password">{ui('newPasswordLabel')}</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={resetValue}
            onChange={(e) => setResetValue(e.target.value)}
            aria-describedby="reset-password-help"
          />
          <p id="reset-password-help" className="text-xs text-muted-foreground">
            {ui('passwordHelp')}
          </p>
          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
        </form>
      </Dialog>
    </div>
  );
}
