import type { Prisma } from '@prisma/client';

export const phase12Permissions = [
  { code: 'archive:create', module: 'archive', action: 'create' },
  { code: 'archive:reopen', module: 'archive', action: 'reopen' },
  // Reserved only: Phase 12 implements NO permanent archive deletion route.
  { code: 'archive:delete', module: 'archive', action: 'delete' },
  { code: 'retention:read', module: 'retention', action: 'read' },
  { code: 'retention:manage', module: 'retention', action: 'manage' },
  // Infrastructure capabilities are reserved in the permission vocabulary.
  // No HTTP backup/restore endpoint exists: OS operator authority is separate.
  { code: 'backup:manage', module: 'backup', action: 'manage' },
  { code: 'backup:restore', module: 'backup', action: 'restore' },
] as const;

export class Phase12PermissionConflict extends Error {}

/** Add only vocabulary. No role grants, user membership or sample data. */
export async function seedPhase12Permissions(tx: Prisma.TransactionClient) {
  for (const [code, module, action] of [
    ['letter:read', 'letters', 'read'], ['letter:archive', 'letters', 'archive'],
    ['audit:read', 'audit', 'read'],
  ]) {
    const row = await tx.permission.findUnique({ where: { code } });
    if (!row || row.module !== module || row.action !== action) {
      throw new Phase12PermissionConflict(`Required ${code} permission missing or conflicting`);
    }
  }
  let created = 0;
  for (const spec of phase12Permissions) {
    const prior = await tx.permission.findUnique({ where: { code: spec.code } });
    if (prior && (prior.module !== spec.module || prior.action !== spec.action)) {
      throw new Phase12PermissionConflict(`Conflicting ${spec.code} permission; manual review required`);
    }
    if (!prior) {
      await tx.permission.create({ data: spec });
      created++;
    }
  }
  return { created, checked: phase12Permissions.length };
}
