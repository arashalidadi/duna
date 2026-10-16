import { Prisma } from '@prisma/client';

export class Phase10PermissionConflict extends Error {}

/** Only new permission vocabulary; no role except ADMIN is granted implicitly. */
export const phase10Permissions = [
  { code: 'notification:read', module: 'notification', action: 'read' },
  { code: 'notification:manage', module: 'notification', action: 'manage' },
] as const;

export async function seedPhase10Permissions(tx: Prisma.TransactionClient) {
  const admin = await tx.role.findUnique({ where: { code: 'ADMIN' },
    select: { id: true, deletedAt: true } });
  if (!admin || admin.deletedAt) throw new Phase10PermissionConflict('Active ADMIN role missing; inspect roles before Phase 10 grants');
  let created = 0, granted = 0;
  for (const spec of phase10Permissions) {
    const prior = await tx.permission.findUnique({ where: { code: spec.code } });
    if (prior && (prior.module !== spec.module || prior.action !== spec.action)) {
      throw new Phase10PermissionConflict(`Permission ${spec.code} has conflicting semantics; inspect before seeding`);
    }
    const permission = prior ?? await tx.permission.create({ data: spec });
    if (!prior) created++;
    const existing = await tx.rolePermission.findUnique({ where: {
      roleId_permissionId: { roleId: admin.id, permissionId: permission.id },
    } });
    if (!existing) {
      await tx.rolePermission.create({ data: { roleId: admin.id, permissionId: permission.id } });
      granted++;
    }
  }
  return { created, granted };
}
