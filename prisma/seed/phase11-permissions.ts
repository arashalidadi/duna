import type { Prisma } from '@prisma/client';

export const AUDIT_EXPORT_ROLE = 'AUDIT_EXPORTER';
export const phase11Permissions = [
  { code: 'audit:export', module: 'audit', action: 'export' },
] as const;
export class Phase11PermissionConflict extends Error {}

/**
 * Idempotent additive grants. Never grant export to ADMIN or a pre-existing
 * ordinary role: only the primary administrator may assign the dedicated role.
 * Conflicting role/permission vocabulary stops the transaction for review.
 */
export async function seedPhase11Permissions(tx: Prisma.TransactionClient) {
  const read = await tx.permission.findUnique({ where: { code: 'audit:read' } });
  if (!read || read.module !== 'audit' || read.action !== 'read') {
    throw new Phase11PermissionConflict('audit:read is missing or conflicting; inspect the permission registry');
  }
  const spec = phase11Permissions[0];
  const prior = await tx.permission.findUnique({ where: { code: spec.code } });
  if (prior && (prior.module !== spec.module || prior.action !== spec.action)) {
    throw new Phase11PermissionConflict('audit:export has conflicting semantics; inspect before seeding');
  }
  const exported = prior ?? await tx.permission.create({ data: spec });
  const existing = await tx.role.findUnique({ where: { code: AUDIT_EXPORT_ROLE },
    include: { permissions: { include: { permission: true } },
      _count: { select: { users: true } } } });
  if (existing && (existing.deletedAt || !existing.isSystem ||
    existing.permissions.some((p) => !['audit:read', 'audit:export'].includes(p.permission.code)))) {
    throw new Phase11PermissionConflict('AUDIT_EXPORTER role conflicts with least privilege; inspect before seeding');
  }
  // An existing, assigned role must not silently acquire export (or read)
  // authority when the seed fills in missing grants. A fully provisioned role
  // with owner-delegated users can still be safely rechecked idempotently.
  if (existing?._count.users && ['audit:read', 'audit:export'].some((code) =>
    !existing.permissions.some((p) => p.permission.code === code))) {
    throw new Phase11PermissionConflict('AUDIT_EXPORTER already has members but lacks required grants; inspect and delegate explicitly');
  }
  const role = existing ?? await tx.role.create({ data: {
    code: AUDIT_EXPORT_ROLE, name: 'Audit exporter', isSystem: true,
    description: 'Read and export the audit trail; assign only by the primary administrator',
  } });
  const otherGrants = await tx.rolePermission.count({
    where: { permissionId: exported.id, roleId: { not: role.id } },
  });
  if (otherGrants) {
    throw new Phase11PermissionConflict('audit:export is assigned to another role; inspect and revoke explicitly before seeding');
  }
  let granted = 0;
  for (const permissionId of [read.id, exported.id]) {
    const key = { roleId: role.id, permissionId };
    if (!await tx.rolePermission.findUnique({ where: { roleId_permissionId: key } })) {
      await tx.rolePermission.create({ data: key });
      granted++;
    }
  }
  return { created: prior ? 0 : 1, roleCreated: existing ? 0 : 1, granted };
}
