import { Prisma, type PrismaClient } from '@prisma/client';

/** DEC-117: seven canonical names. `code` below is an internal master key,
 * NOT a claim about an international or document abbreviation. Only HAM,
 * KHS and RJS are evidenced. Do not fabricate other city/region labels
 * or abbreviations; unknowns remain null and new rows inactive.
 */
export const referencePorts = [
  { code: 'HAMRIYAH', name: 'Hamriyah', country: 'UAE', city: 'Dubai', abbreviation: 'HAM' },
  { code: 'KHORRAMSHAHR', name: 'Khorramshahr', country: 'Iran', city: 'Persian Gulf', abbreviation: 'KHS' },
  { code: 'BANDAR_ABBAS', name: 'Bandar Abbas', country: 'Iran', city: 'Persian Gulf', abbreviation: 'RJS' },
  { code: 'BUSHEHR', name: 'Bushehr', country: 'Iran', city: null, abbreviation: null },
  { code: 'JEBALI', name: 'Jebel Ali', country: 'UAE', city: null, abbreviation: null },
  { code: 'SOHAR', name: 'Sohar', country: 'Oman', city: null, abbreviation: null },
  { code: 'DUBAI', name: 'Dubai', country: 'UAE', city: null, abbreviation: null },
] as const;

export class Phase10PortConflict extends Error {}

const key = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
export async function seedPhase10Ports(prisma: PrismaClient) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // The shared-port clarification is not permission to merge or delete a
    // pre-existing Rajaee row with possibly referenced historical documents.
    const all = await tx.port.findMany({ select: { id: true, code: true, name: true,
      displayName: true, country: true, city: true, abbreviation: true, deletedAt: true } });
    if (all.some((p) => key(p.name).includes('RAJAEE') ||
      (p.displayName && key(p.displayName).includes('RAJAEE')))) {
      throw new Phase10PortConflict('Existing Rajaee port row detected: do not merge/delete it automatically. Inspect referenced records and decide the alias cutover with the owner.');
    }
    if (all.some((p) => key(p.name) === 'KHALIFA PORT')) {
      console.warn('Existing Khalifa Port is not evidenced in the reference list; preserved unchanged (no deactivation/deletion).');
    }
    let created = 0, backfilled = 0;
    const selectedIds: string[] = [];
    let bandarAbbasId: string | undefined;
    for (const spec of referencePorts) {
      const matching = all.filter((p) => key(p.name) === key(spec.name));
      if (matching.length > 1) throw new Phase10PortConflict(`Multiple rows for ${spec.name}; inspect before seeding`);
      const existing = matching[0];
      if (existing) {
        if (existing.deletedAt || key(existing.country) !== key(spec.country)) {
          throw new Phase10PortConflict(`${spec.name} has incompatible country or is archived; inspect before seeding`);
        }
        if ((spec.city && existing.city && key(spec.city) !== key(existing.city)) ||
            (spec.abbreviation && existing.abbreviation && key(spec.abbreviation) !== key(existing.abbreviation))) {
          throw new Phase10PortConflict(`${spec.name} has different city/abbreviation; do not overwrite an operator value`);
        }
        const nameCodeOwner = all.find((p) => p.code === spec.code && p.id !== existing.id);
        if (nameCodeOwner) throw new Phase10PortConflict(`Internal code ${spec.code} already belongs to another port`);
        const patches = {
          ...(spec.city && !existing.city ? { city: spec.city } : {}),
          ...(spec.abbreviation && !existing.abbreviation ? { abbreviation: spec.abbreviation } : {}),
        };
        if (Object.keys(patches).length) {
          await tx.port.update({ where: { id: existing.id }, data: patches });
          backfilled++;
          await tx.auditLog.create({ data: { actorId: 'system:phase10-seed', actorEmail: 'system:phase10-seed',
            action: 'port.reference.backfill', entityType: 'Port', entityId: existing.id,
            beforeData: { city: existing.city, abbreviation: existing.abbreviation }, afterData: patches } });
        }
        selectedIds.push(existing.id);
        if (spec.name === 'Bandar Abbas') bandarAbbasId = existing.id;
      } else {
        if (all.some((p) => p.code === spec.code)) {
          throw new Phase10PortConflict(`Internal code ${spec.code} is in use for a different port; inspect before seeding`);
        }
        const row = await tx.port.create({ data: {
          code: spec.code, name: spec.name, country: spec.country,
          city: spec.city, abbreviation: spec.abbreviation,
          // Unknown city or abbreviation: keep the seed row inactive until
          // an administrator supplies the verified value.
          isActive: !!spec.city && !!spec.abbreviation,
        } });
        created++;
        selectedIds.push(row.id);
        if (spec.name === 'Bandar Abbas') bandarAbbasId = row.id;
        await tx.auditLog.create({ data: { actorId: 'system:phase10-seed', actorEmail: 'system:phase10-seed',
          action: 'port.reference.create', entityType: 'Port', entityId: row.id,
          afterData: { name: spec.name, country: spec.country, city: spec.city,
            abbreviation: spec.abbreviation, isActive: row.isActive } } });
      }
    }
    if (!bandarAbbasId) throw new Phase10PortConflict('Canonical Bandar Abbas row missing');
    const alias = await tx.portAlias.findUnique({ where: { key: 'RAJAEE' } });
    if (alias && alias.portId !== bandarAbbasId) {
      throw new Phase10PortConflict('Rajaee alias points to a different port; inspect before seeding');
    }
    if (!alias) {
      await tx.portAlias.create({ data: { portId: bandarAbbasId, label: 'Rajaee', key: 'RAJAEE' } });
      await tx.auditLog.create({ data: { actorId: 'system:phase10-seed', actorEmail: 'system:phase10-seed',
        action: 'port.reference.alias', entityType: 'Port', entityId: bandarAbbasId,
        afterData: { alias: 'Rajaee' } } });
    }
    return { canonical: referencePorts.length, created, backfilled, aliasCreated: !alias,
      incomplete: await tx.port.findMany({ where: { id: { in: selectedIds },
        OR: [{ city: null }, { abbreviation: null }] }, select: { code: true } }) };
  });
}
