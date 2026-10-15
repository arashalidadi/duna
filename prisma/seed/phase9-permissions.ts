import { Prisma } from '@prisma/client';

/** Only the new permission registry entries for Phase 9. Seeding them never
 * creates business/demo records or modifies existing users/owner identity. */
export const phase9Permissions = [
  { code: 'configuration:read', module: 'configuration', action: 'read' },
  { code: 'configuration:manage', module: 'configuration', action: 'manage' },
  { code: 'configuration:value_write', module: 'configuration', action: 'value_write' },
  { code: 'workflow:read', module: 'workflow', action: 'read' },
  { code: 'workflow:manage', module: 'workflow', action: 'manage' },
  { code: 'workflow:approve', module: 'workflow', action: 'approve' },
  { code: 'config_document:read', module: 'config_document', action: 'read' },
  { code: 'config_document:create', module: 'config_document', action: 'create' },
  { code: 'config_document:update', module: 'config_document', action: 'update' },
  { code: 'config_document:transition', module: 'config_document', action: 'transition' },
  { code: 'config_document:approve', module: 'config_document', action: 'approve' },
  { code: 'config_document:render', module: 'config_document', action: 'render' },
] as const;

/** Call this in a transaction after reviewing the target database state. */
export async function seedPhase9Permissions(tx: Prisma.TransactionClient) {
  const admin = await tx.role.findUnique({ where: { code: 'ADMIN' },
    select: { id: true, deletedAt: true } });
  if (!admin || admin.deletedAt) throw new Error('Active ADMIN role is missing; inspect role state before seeding Phase 9');
  let created = 0;
  let granted = 0;
  for (const definition of phase9Permissions) {
    const prior = await tx.permission.findUnique({ where: { code: definition.code } });
    if (prior && (prior.module !== definition.module || prior.action !== definition.action)) {
      throw new Error(`Existing permission ${definition.code} has different semantics; inspect before proceeding`);
    }
    const permission = prior ?? await tx.permission.create({ data: definition });
    if (!prior) created++;
    const existingGrant = await tx.rolePermission.findUnique({ where: { roleId_permissionId: {
      roleId: admin.id, permissionId: permission.id } } });
    if (!existingGrant) {
      await tx.rolePermission.create({ data: { roleId: admin.id, permissionId: permission.id } });
      granted++;
    }
  }
  return { created, granted };
}
