import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Phase11PermissionConflict, seedPhase11Permissions } from '../../../prisma/seed/phase11-permissions';
import { auditProjection } from '../src/common/infrastructure/audit/audit-change';
import { auditExportWindow, renderAuditCsv } from '../src/common/infrastructure/audit/audit-export';
import type { AuditLogRecord } from '../src/common/infrastructure/audit/audit.types';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { StorageAdapter } from '../src/common/infrastructure/storage/storage-adapter.interface';
import { DocumentAssetsService } from '../src/modules/document-output/document-assets.service';
import { UsersService } from '../src/modules/users/users.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/** DB-free regression checks for data minimization and safe privileged CSV export. */
describe('Phase 11 audit data boundaries', () => {
  it('projects only approved fields, never identifiers/password material', () => {
    const result = auditProjection({ status: 'INACTIVE', code: 'EMP-1',
      nationalId: 'sensitive-id', passwordHash: 'never-log', relation: { secret: 'x' },
    }, ['status', 'code']);
    expect(result).toEqual({ status: 'INACTIVE', code: 'EMP-1' });
    expect(JSON.stringify(result)).not.toContain('sensitive-id');
    expect(JSON.stringify(result)).not.toContain('never-log');
  });

  it('quotes CSV cells, escapes formulas and retains the JSON change history', () => {
    const row = { id: '1', timestamp: new Date('2026-10-16T00:00:00Z'),
      actorId: 'user-1', actorEmail: ' =1+1', action: 'role:create',
      entityType: 'Role', entityId: 'role-1', beforeData: null,
      afterData: { code: 'AUDIT_EXPORTER' }, metadata: { reason: 'He said "yes"' },
      ipAddress: null, userAgent: '-HYPERLINK("x","y")', createdAt: new Date(),
    } as AuditLogRecord;
    const csv = renderAuditCsv([row]);
    expect(csv).toContain('"\' =1+1"');
    expect(csv).toContain('"\'-HYPERLINK(""x"",""y"")"');
    expect(csv).toContain('"{""code"":""AUDIT_EXPORTER""}"');
    expect(csv.split('\r\n')).toHaveLength(3);
  });

  it('attributes company artwork metadata access and fails closed without an audit row', async () => {
    const actor = { id: 'manager-1', email: 'manager@example.test', roles: [],
      permissions: ['document:manage'], isPrimaryAdmin: false };
    const record = jest.fn().mockResolvedValue(undefined);
    const findMany = jest.fn().mockResolvedValue([
      { id: 'asset-1', kind: 'STAMP', storageKey: 'never-disclose-storage-key' },
    ]);
    const service = new DocumentAssetsService(
      { documentAsset: { findMany } } as unknown as PrismaService,
      { record } as unknown as AuditService, {} as StorageAdapter,
    );
    expect(await service.list(actor)).toEqual([{ id: 'asset-1', kind: 'STAMP' }]);
    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, take: 200 });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'document_asset.list_metadata', entityType: 'DocumentAsset',
      entityId: 'collection', actorId: actor.id, actorEmail: actor.email,
      metadata: { returned: 1 },
    }));
    record.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(service.list(actor)).rejects.toThrow('audit unavailable');
  });

  it('locks official artwork before deciding and auditing approval or retirement', async () => {
    const actor = { id: 'approver', email: 'approver@example.test', roles: [],
      permissions: ['document:approve'], isPrimaryAdmin: false };
    const order: string[] = [];
    const row = { id: 'asset-1', storageKey: 'private-key', sha256: 'hash',
      isApproved: false, approvedAt: null as Date | null, deactivatedAt: null as Date | null };
    const tx = { $queryRaw: jest.fn(async () => { order.push('lock'); return []; }),
      documentAsset: { findUnique: jest.fn(async () => { order.push('read'); return { ...row }; }),
        update: jest.fn(async ({ data }) => {
          order.push('write'); Object.assign(row, data); return { ...row };
        }) },
    };
    const audit = { recordIn: jest.fn(async () => { order.push('audit'); }) };
    const db = { $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) };
    const service = new DocumentAssetsService(db as unknown as PrismaService,
      audit as unknown as AuditService, {} as StorageAdapter);
    expect(await service.approve('asset-1', actor)).toEqual(expect.objectContaining({ isApproved: true }));
    expect(await service.retire('asset-1', actor)).toEqual(expect.objectContaining({
      isApproved: false, deactivatedAt: expect.any(Date),
    }));
    expect(order).toEqual(['lock', 'read', 'write', 'audit', 'lock', 'read', 'write', 'audit']);
    expect(audit.recordIn).toHaveBeenNthCalledWith(1, tx, expect.objectContaining({
      action: 'document_asset.approve', beforeData: { isApproved: false },
    }));
    expect(audit.recordIn).toHaveBeenNthCalledWith(2, tx, expect.objectContaining({
      action: 'document_asset.retire', beforeData: { isApproved: true },
    }));
  });

  it('never upgrades a pre-existing exporter role with members; fully seeded reruns are safe', async () => {
    const incomplete = { id: 'export-role', isSystem: true, deletedAt: null,
      _count: { users: 1 }, permissions: [{ permission: { code: 'audit:read' } }] };
    const full = { ...incomplete, permissions: [...incomplete.permissions,
      { permission: { code: 'audit:export' } }] };
    const create = jest.fn();
    const tx = { permission: { findUnique: jest.fn().mockImplementation(async ({ where }) =>
      ({ id: where.code, code: where.code, module: 'audit',
        action: where.code === 'audit:read' ? 'read' : 'export' })) },
      role: { findUnique: jest.fn().mockResolvedValueOnce(incomplete).mockResolvedValueOnce(full),
        create },
      rolePermission: { count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue({ roleId: 'export-role' }), create },
    };
    await expect(seedPhase11Permissions(tx as unknown as Prisma.TransactionClient))
      .rejects.toThrow(Phase11PermissionConflict);
    expect(create).not.toHaveBeenCalled();
    expect(await seedPhase11Permissions(tx as unknown as Prisma.TransactionClient))
      .toEqual({ created: 0, roleCreated: 0, granted: 0 });
    expect(create).not.toHaveBeenCalled();
  });

  it('rechecks role activity under the role lock before creating a user', async () => {
    const create = jest.fn();
    const locked = jest.fn().mockResolvedValue([]);
    const tx = { $queryRaw: locked, role: { count: jest.fn().mockResolvedValue(0) },
      user: { create } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null) },
      // Preflight sees an active role, but the transactional read sees it has
      // been deactivated before the lock was acquired.
      role: { findMany: jest.fn().mockResolvedValue([{ id: 'role-1', deletedAt: null }]) },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new UsersService(prisma as unknown as PrismaService, {} as AuditService);
    await expect(service.create({ email: 'new@example.test', password: 'TestOnly123!',
      fullName: 'New user', roleIds: ['role-1'] },
    { id: 'manager', email: 'manager@example.test', roles: [],
      permissions: ['user:create'], isPrimaryAdmin: false })).rejects.toThrow(BadRequestException);
    expect(locked).toHaveBeenCalledTimes(1);
    expect(tx.role.count).toHaveBeenCalledWith({ where: {
      id: { in: ['role-1'] }, deletedAt: null,
    } });
    expect(create).not.toHaveBeenCalled();
  });

  it('requires a valid bounded past time window', () => {
    expect(() => auditExportWindow('2026-01-01T00:00:00Z', '2026-02-05T00:00:00Z')).toThrow();
    expect(() => auditExportWindow('2026-02-01T00:00:00Z', '2026-01-01T00:00:00Z')).toThrow();
    expect(() => auditExportWindow('2026-02-01T00:00:00Z', '2999-01-01T00:00:00Z')).toThrow();
    expect(() => auditExportWindow('2026-02-01T00:00:00Z', 'not-a-date')).toThrow();
    expect(auditExportWindow('2026-02-01T00:00:00Z', '2026-02-02T00:00:00Z').from.toISOString())
      .toBe('2026-02-01T00:00:00.000Z');
  });
});
