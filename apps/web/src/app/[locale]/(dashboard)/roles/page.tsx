'use client';
import { TableScroll } from '@/components/ui/table-scroll';

import { useTranslations as useUiTranslations } from 'next-intl';

import { useCallback, useEffect, useState } from 'react';
import type { PaginatedResult, PermissionListItem, RoleListItem } from '@shipping/shared';
import { ShieldCheck, Plus, KeyRound, Power } from 'lucide-react';
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

export default function RolesPage() {
  const ui = useUiTranslations('legacyUi');
  const { hasPermission } = useAuth();
  const [data, setData] = useState<PaginatedResult<RoleListItem> | null>(null);
  const [permissions, setPermissions] = useState<PermissionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleListItem | null>(null);
  const [toggling, setToggling] = useState<RoleListItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const [roleData, permData] = await Promise.all([
          api.get<PaginatedResult<RoleListItem>>(`/roles?page=${p}&pageSize=${PAGE_SIZE}`),
          api.get<PermissionListItem[]>('/permissions/all'),
        ]);
        setData(roleData);
        setPermissions(permData);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : ui('failedToLoadRoles'));
      } finally {
        setLoading(false);
      }
    },
    [ui]
  );

  useEffect(() => {
    load(page);
  }, [load, page]);

  const canCreate = hasPermission('role:create');
  const canUpdate = hasPermission('role:update');
  const canManagePerms = hasPermission('role:permissions');

  function openCreate() {
    setCode('');
    setName('');
    setDescription('');
    setFormError(null);
    setCreateOpen(true);
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!code.trim() || !name.trim()) {
      setFormError(ui('codeAndNameAreRequired'));
      return;
    }
    setSaving(true);
    try {
      await api.post<RoleListItem>('/roles', {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setCreateOpen(false);
      setPage(1);
      await load(1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToCreateRole'));
    } finally {
      setSaving(false);
    }
  }

  function openPermissions(role: RoleListItem) {
    setEditing(role);
    setSelectedPermissions(new Set(role.permissions.map((p) => p.id)));
    setFormError(null);
  }

  async function savePermissions() {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await api.patch<RoleListItem>(`/roles/${editing.id}/permissions`, {
        permissionIds: Array.from(selectedPermissions),
      });
      setEditing(null);
      await load(page);
      void updated;
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdatePermissions'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRole() {
    if (!toggling) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.patch<RoleListItem>(`/roles/${toggling.id}/active`, {
        isActive: !toggling.isActive,
      });
      setToggling(null);
      await load(page);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : ui('failedToUpdateRole'));
    } finally {
      setSaving(false);
    }
  }

  const modules = Array.from(new Set(permissions.map((p) => p.module))).sort();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Breadcrumbs items={[{ label: ui('roles') }]} />
          <h1 className="mt-2 text-lg font-semibold tracking-tight">{ui('roles')}</h1>
          <p className="text-sm text-muted-foreground">
            {ui('defineWhoCanAccessWhatPermissionsAreEnforcedServerSide')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {ui('newRole')}
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{ui('roleRegistry')}</CardTitle>
          <CardDescription>{ui('activeRolesVisibleToYou')}</CardDescription>
        </CardHeader>
        {loading ? (
          <PageLoader label={ui('loadingRoles')} />
        ) : error ? (
          <CardContent>
            <ErrorState message={error} onRetry={() => load(page)} />
          </CardContent>
        ) : data && data.data.length === 0 ? (
          <CardContent>
            <EmptyState title={ui('noRolesFound')} description={ui('createYourFirstRoleToBegin')} />
          </CardContent>
        ) : (
          <TableScroll className="overflow-x-auto">
            <table className="w-full text-start">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{ui('role')}</th>
                  <th className="px-3 py-2 font-medium">{ui('status')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('users')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('permissions')}</th>
                  <th className="px-3 py-2 text-end font-medium">{ui('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((role) => (
                  <tr key={role.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'truncate text-[13px] font-medium text-foreground',
                                role.isSystem && 'italic'
                              )}
                            >
                              {role.name}
                            </span>
                            {role.isSystem && <Badge variant="neutral">{ui('system')}</Badge>}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {role.code}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {role.isActive ? (
                        <Badge variant="success">{ui('active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{ui('inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end text-[13px] tabular-nums text-foreground">
                      {role.userCount}
                    </td>
                    <td className="px-3 py-2 text-end font-mono text-[12px] tabular-nums text-muted-foreground">
                      {role.permissions.length}
                    </td>
                    <td className="px-3 py-2 text-end">
                      <div className="flex items-center justify-end gap-1">
                        {canManagePerms && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => openPermissions(role)}
                          >
                            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                            {ui('permissions')}
                          </Button>
                        )}
                        {(canUpdate || canManagePerms) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setFormError(null);
                              setToggling(role);
                            }}
                            disabled={role.isSystem}
                            title={
                              role.isSystem
                                ? ui('systemRolesCannotBeDeactivated')
                                : role.isActive
                                  ? ui('deactivate')
                                  : ui('activate')
                            }
                            aria-label={role.isActive ? ui('deactivateRole') : ui('activateRole')}
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

      {/* Create role dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={ui('newRole')}
        description={ui('defineARoleThatASetOfPermissionsCanBeAttached')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={createRole}>
              {ui('createRole')}
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => e.preventDefault()}
          className="space-y-4"
          aria-label={ui('newRoleForm')}
        >
          <div className="space-y-1.5">
            <Label htmlFor="role-code" className="block">
              {ui('code')}
            </Label>
            <Input
              id="role-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={ui('operationsMANAGER')}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-name" className="block">
              {ui('name')}
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ui('operationsManager')}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-description" className="block">
              {ui('description')}
            </Label>
            <textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {formError && (
            <p className="text-xs text-destructive" role="alert">
              {formError}
            </p>
          )}
        </form>
      </Dialog>

      {/* Permissions dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing ? ui('permissionsValue', { value0: String(editing.name) }) : ui('permissions')
        }
        description={ui('chooseThePermissionsGrantedByThisRoleDecisionsAreEnforcedServer')}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              {ui('cancel')}
            </Button>
            <Button size="sm" loading={saving} onClick={savePermissions}>
              {ui('savePermissions')}
            </Button>
          </>
        }
      >
        {formError && (
          <p className="mb-3 text-xs text-destructive" role="alert">
            {formError}
          </p>
        )}
        <div className="scrollbar-thin max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {modules.map((mod) => (
            <fieldset key={mod}>
              <legend className="micro-label mb-1.5 text-muted-foreground">{mod}</legend>
              <div className="flex flex-wrap gap-1.5">
                {permissions
                  .filter((p) => p.module === mod)
                  .map((p) => {
                    const checked = selectedPermissions.has(p.id);
                    return (
                      <label
                        key={p.id}
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
                            setSelectedPermissions((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                        />
                        <span className="font-mono">{p.code}</span>
                      </label>
                    );
                  })}
              </div>
            </fieldset>
          ))}
        </div>
      </Dialog>

      {/* Toggle confirm */}
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? ui('deactivateRole') : ui('activateRole')}
        description={
          toggling?.isActive
            ? ui('deactivatingValueRemovesAccessForItsValueAssignedUserValueUntil', {
                value0: String(toggling?.name),
                value1: String(toggling?.userCount),
                value2: String(toggling?.userCount === 1 ? '' : 's'),
              })
            : ui('reActivatingValueRestoresAccessForItsAssignedUsers', {
                value0: String(toggling?.name),
              })
        }
        confirmLabel={toggling?.isActive ? ui('deactivate') : ui('activate')}
        destructive={toggling?.isActive}
        loading={saving}
        onConfirm={toggleRole}
        error={formError}
      />
    </div>
  );
}
