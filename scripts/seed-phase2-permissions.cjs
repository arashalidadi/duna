const { PrismaClient } = require('@prisma/client');

const MISSING = [
  { code: 'shipper:read',   module: 'shipper',  action: 'read' },
  { code: 'shipper:create', module: 'shipper',  action: 'create' },
  { code: 'shipper:update', module: 'shipper',  action: 'update' },
  { code: 'shipper:delete', module: 'shipper',  action: 'delete' },
  { code: 'consignee:read',   module: 'consignee',  action: 'read' },
  { code: 'consignee:create', module: 'consignee',  action: 'create' },
  { code: 'consignee:update', module: 'consignee',  action: 'update' },
  { code: 'consignee:delete', module: 'consignee',  action: 'delete' },
  { code: 'agent:read',   module: 'agent',  action: 'read' },
  { code: 'agent:create', module: 'agent',  action: 'create' },
  { code: 'agent:update', module: 'agent',  action: 'update' },
  { code: 'agent:delete', module: 'agent',  action: 'delete' },
];

async function main() {
  const p = new PrismaClient();
  try {
    const byCode = {};
    for (const m of MISSING) {
      const r = await p.permission.upsert({
        where: { code: m.code },
        update: { module: m.module, action: m.action },
        create: m,
      });
      byCode[m.code] = r.id;
    }
    const admin = await p.role.findUnique({ where: { code: 'ADMIN' } });
    if (admin) {
      for (const permissionId of Object.values(byCode)) {
        await p.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: admin.id, permissionId } },
          update: {},
          create: { roleId: admin.id, permissionId },
        });
      }
    }
    console.log('OK: ' + Object.keys(byCode).length + ' permission(s) seeded/linked');
  } finally {
    await p.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
