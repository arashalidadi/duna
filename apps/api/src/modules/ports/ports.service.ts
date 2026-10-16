import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { CreatePortDto, ListPortsQueryDto, UpdatePortDto } from './dto/ports.dto';

const select = {
  id: true, code: true, name: true, displayName: true, country: true, city: true,
  abbreviation: true, aliases: { select: { id: true, label: true }, orderBy: { label: 'asc' as const } },
  isActive: true, createdAt: true, updatedAt: true,
} satisfies Prisma.PortSelect;

type PortRow = Prisma.PortGetPayload<{ select: typeof select }>;
const label = (port: PortRow) => ({ ...port,
  // No fallback that invents a city/abbreviation for an incomplete legacy row.
  displayLabel: port.city ? `${port.displayName || port.name}, ${port.city}, ${port.country}` : null,
  needsReview: !port.city || !port.abbreviation,
});
export function aliasKey(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('en');
}
function nonblank(v: string, field: string): string {
  if (!v?.trim()) throw new BadRequestException(`${field} must not be blank`);
  return v.trim();
}

@Injectable()
export class PortsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListPortsQueryDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:read');
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);
    const where: Prisma.PortWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.country ? { country: { equals: query.country, mode: 'insensitive' } } : {}),
      ...(query.search ? { OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { country: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { abbreviation: { contains: query.search, mode: 'insensitive' } },
        { aliases: { some: { label: { contains: query.search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.port.count({ where }),
      this.prisma.port.findMany({ where, select, skip: pagination.skip,
        take: pagination.take, orderBy: { code: 'asc' } }),
    ]);
    return buildPaginated(items.map(label), total, pagination);
  }

  async findById(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:read');
    const port = await this.prisma.port.findFirst({ where: { id, deletedAt: null },
      include: { aliases: { orderBy: { label: 'asc' } }, yards: { where: { deletedAt: null },
        select: { id: true, code: true, name: true, address: true, isActive: true },
        orderBy: { code: 'asc' } } } });
    if (!port) throw new NotFoundException('Port not found');
    return { ...port, displayLabel: port.city
      ? `${port.displayName || port.name}, ${port.city}, ${port.country}` : null,
      needsReview: !port.city || !port.abbreviation };
  }

  private async validateAliases(tx: Prisma.TransactionClient, aliases: string[], portId: string | null,
    officialName: string, displayName: string | null): Promise<{ label: string; key: string }[]> {
    const values = aliases.map((name) => ({ label: nonblank(name, 'Alias'), key: aliasKey(name) }));
    const keys = values.map((v) => v.key);
    if (new Set(keys).size !== keys.length || keys.includes(aliasKey(officialName)) ||
        (displayName && keys.includes(aliasKey(displayName)))) {
      throw new BadRequestException('Aliases must be unique and distinct from the official and display names');
    }
    const used = await tx.portAlias.findMany({ where: { key: { in: keys },
      ...(portId ? { portId: { not: portId } } : {}) }, select: { key: true } });
    if (used.length) throw new ConflictException('Alias is already assigned to a different port');
    const canonical = await tx.port.findMany({ where: { deletedAt: null,
      ...(portId ? { id: { not: portId } } : {}) }, select: { name: true, displayName: true } });
    if (canonical.some((p) => keys.includes(aliasKey(p.name)) ||
      (p.displayName && keys.includes(aliasKey(p.displayName))))) {
      throw new ConflictException('Alias conflicts with another official port name');
    }
    return values;
  }

  /** Shared by both status routes so PATCH cannot bypass the lifecycle gate. */
  private async ensureStatusChange(tx: Prisma.TransactionClient, id: string,
    from: boolean, to: boolean, city: string | null, abbreviation: string | null) {
    if (from === to) return;
    if (to) {
      if (!city?.trim() || !abbreviation?.trim()) {
        throw new ConflictException('Complete city/region and verified abbreviation before activation');
      }
      return;
    }
    const [yards, voyages, destinations, cargo, bookings] = await Promise.all([
      tx.yard.count({ where: { portId: id, isActive: true, deletedAt: null } }),
      tx.voyage.count({ where: {
        status: { in: ['DRAFT', 'SCHEDULED', 'IN_PROGRESS'] },
        OR: [{ originPortId: id }, { destinationPortId: id },
          { legs: { some: { destinationPortId: id, deletedAt: null } } }] } }),
      tx.agentDestination.count({ where: { portId: id, isActive: true, deletedAt: null } }),
      tx.cargo.count({ where: { deletedAt: null, status: { notIn: ['CANCELLED', 'DELIVERED'] },
        OR: [{ portId: id }, { destinationPortId: id }] } }),
      tx.bookingRequest.count({ where: { deletedAt: null, status: 'PENDING',
        OR: [{ originPortId: id }, { destinationPortId: id }] } }),
    ]);
    if (yards || voyages || destinations || cargo || bookings) {
      throw new ConflictException(`Port has active dependencies (yards ${yards}, voyages ${voyages}, agent destinations ${destinations}, cargo ${cargo}, pending bookings ${bookings}); resolve them first`);
    }
  }

  async create(dto: CreatePortDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:create');
    const name = nonblank(dto.name, 'Official name');
    const displayName = dto.displayName?.trim() || null;
    const names = [name, displayName].filter((v): v is string => !!v).map(aliasKey);
    const aliases = dto.aliases ?? [];
    try {
      return await this.prisma.$transaction(async (tx) => {
        const valid = await this.validateAliases(tx, aliases, null, name, displayName);
        if (await tx.portAlias.count({ where: { key: { in: names } } })) {
          throw new ConflictException('Official or display name is already an alias of another port');
        }
        const conflict = await tx.port.findMany({ where: { deletedAt: null },
          select: { name: true, displayName: true } });
        if (conflict.some((p) => [p.name, p.displayName].some((n) => n && names.includes(aliasKey(n))))) {
          throw new ConflictException('A port with that official or display name already exists');
        }
        const row = await tx.port.create({ data: {
          code: nonblank(dto.code, 'Code').toUpperCase(), name,
          country: nonblank(dto.country, 'Country'), city: nonblank(dto.city, 'City/region'),
          abbreviation: nonblank(dto.abbreviation, 'Abbreviation').toUpperCase(),
          displayName,
          aliases: { create: valid },
        }, select });
        await this.audit.recordIn(tx, { action: 'port.create', entityType: 'Port', entityId: row.id,
          actorId: actor.id, actorEmail: actor.email,
          afterData: { code: row.code, name: row.name, country: row.country, city: row.city,
            abbreviation: row.abbreviation, displayName: row.displayName, aliases: valid } });
        return label(row);
      });
    } catch (e) { throw PortsService.unique(e); }
  }

  async update(id: string, dto: UpdatePortDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Port" WHERE "id" = ${id} FOR UPDATE`;
        const before = await tx.port.findFirst({ where: { id, deletedAt: null },
          include: { aliases: true } });
        if (!before) throw new NotFoundException('Port not found');
        if (dto.isActive !== undefined) {
          await this.ensureStatusChange(tx, id, before.isActive, dto.isActive,
            dto.city !== undefined ? dto.city : before.city,
            dto.abbreviation !== undefined ? dto.abbreviation : before.abbreviation);
        }
        const name = dto.name !== undefined ? nonblank(dto.name, 'Official name') : before.name;
        const displayName = dto.displayName !== undefined ? dto.displayName.trim() || null : before.displayName;
        const names = [name, displayName].filter((v): v is string => !!v).map(aliasKey);
        const aliases = dto.aliases !== undefined ? dto.aliases : before.aliases.map((a) => a.label);
        const valid = await this.validateAliases(tx, aliases, id, name, displayName);
        if (await tx.portAlias.count({ where: { key: { in: names }, portId: { not: id } } })) {
          throw new ConflictException('Official or display name is already an alias of another port');
        }
        const otherNames = await tx.port.findMany({ where: { id: { not: id }, deletedAt: null },
          select: { name: true, displayName: true } });
        if (otherNames.some((p) => [p.name, p.displayName].some((n) => n && names.includes(aliasKey(n))))) {
          throw new ConflictException('Another port has this official or display name');
        }
        const row = await tx.port.update({ where: { id }, data: {
          code: dto.code !== undefined ? nonblank(dto.code, 'Code').toUpperCase() : undefined,
          name,
          displayName: dto.displayName !== undefined ? displayName : undefined,
          country: dto.country !== undefined ? nonblank(dto.country, 'Country') : undefined,
          city: dto.city !== undefined ? nonblank(dto.city, 'City/region') : undefined,
          abbreviation: dto.abbreviation !== undefined
            ? nonblank(dto.abbreviation, 'Abbreviation').toUpperCase() : undefined,
          isActive: dto.isActive,
          // Aliases may be replaced in full, but history never rewrites a Port FK.
          ...(dto.aliases !== undefined ? { aliases: { deleteMany: {}, create: valid } } : {}),
        }, select });
        await this.audit.recordIn(tx, { action: before.isActive === row.isActive ? 'port.update'
          : row.isActive ? 'port.activate' : 'port.deactivate', entityType: 'Port', entityId: id,
          actorId: actor.id, actorEmail: actor.email,
          beforeData: { code: before.code, name: before.name, country: before.country,
            city: before.city, abbreviation: before.abbreviation, isActive: before.isActive,
            displayName: before.displayName, aliases: before.aliases.map((a) => a.label) },
          afterData: { code: row.code, name: row.name, country: row.country, city: row.city,
            abbreviation: row.abbreviation, isActive: row.isActive,
            displayName: row.displayName, aliases: valid.map((a) => a.label) } });
        return label(row);
      });
    } catch (e) { throw PortsService.unique(e); }
  }

  /** Never bypass active operational dependencies by hiding a master row. */
  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Port" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.port.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Port not found');
      if (before.isActive === isActive) return label(await tx.port.findUniqueOrThrow({ where: { id }, select }));
      await this.ensureStatusChange(tx, id, before.isActive, isActive, before.city, before.abbreviation);
      const after = await tx.port.update({ where: { id }, data: { isActive }, select });
      await this.audit.recordIn(tx, { action: isActive ? 'port.activate' : 'port.deactivate',
        entityType: 'Port', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: before.isActive }, afterData: { isActive } });
      return label(after);
    });
  }

  /** Only unused reference entries can be hidden; no hard-delete route exists. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'port:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Port" WHERE "id" = ${id} FOR UPDATE`;
      const port = await tx.port.findFirst({ where: { id, deletedAt: null }, include: { _count: {
        select: { yards: true, cargos: true, cargoDestinations: true, yardInventories: true,
          voyageOrigins: true, voyageDestinations: true, voyageLegs: true,
          manifestsAsPol: true, manifestsAsPod: true, bookingsAsOrigin: true, bookingsAsDestination: true,
          deliveryOrders: true, agentDestinations: true, aliases: true },
      } } });
      if (!port) throw new NotFoundException('Port not found');
      const attachments = await tx.fileAttachment.count({ where: {
        entityType: 'Port', entityId: id } });
      if (attachments || Object.values(port._count).some((n) => n > 0)) {
        throw new ConflictException('Port is referenced by history or operations; deactivate instead');
      }
      const result = await tx.port.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'port.archive', entityType: 'Port', entityId: id,
        actorId: actor.id, actorEmail: actor.email,
        beforeData: { code: port.code, isActive: port.isActive },
        afterData: { deletedAt: result.deletedAt, isActive: false } });
      return { id, archived: true };
    });
  }

  private static unique(e: unknown): Error {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return new ConflictException('Port code, abbreviation or alias is already in use');
    }
    return e instanceof Error ? e : new Error('Port operation failed');
  }
}
