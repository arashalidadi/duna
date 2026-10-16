import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import {
  CreateAgentDestinationDto,
  CreateAgentDto,
  ListAgentDestinationQueryDto,
  ListAgentQueryDto,
  UpdateAgentDestinationDto,
  UpdateAgentDto,
} from './dto/agents.dto';

const select = {
  id: true,
  code: true,
  name: true,
  taxId: true,
  address: true,
  phone: true,
  email: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.AgentSelect;

const destinationSelect = {
  id: true,
  agentId: true,
  portId: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  port: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AgentDestinationSelect;

/**
 * Agent master data (Phase 2 party model). Agents are third-party
 * representatives at destination ports. Each agent exposes a set of
 * destinations it serves.
 */
@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListAgentQueryDto) {
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.AgentWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.agent.count({ where }),
      this.prisma.agent.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { code: 'asc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id }, select });
    if (!agent || agent.deletedAt) {
      throw new NotFoundException('Agent not found');
    }
    return agent;
  }

  async create(dto: CreateAgentDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.agent.create({
        data: {
          code: dto.code.trim(),
          name: dto.name.trim(),
          taxId: dto.taxId?.trim() || null,
          address: dto.address?.trim() || null,
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        select,
        });
        await this.audit.recordIn(tx, { action: 'agent.create',
          entityType: 'Agent', entityId: row.id,
          actorId: actor.id, actorEmail: actor.email,
          afterData: auditProjection(row, ['code', 'name', 'isActive']),
          metadata: { taxIdPresent: Boolean(row.taxId) } });
        return row;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('An agent with this code already exists');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateAgentDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'agent:update');
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "agents" WHERE "id" = ${id} FOR UPDATE`;
        const before = await tx.agent.findFirst({ where: { id, deletedAt: null },
          select });
        if (!before) throw new NotFoundException('Agent not found');
        const after = await tx.agent.update({ where: { id }, data: {
          name: dto.name?.trim(),
          taxId: dto.taxId === undefined ? undefined : dto.taxId.trim() || null,
          address: dto.address === undefined ? undefined : dto.address.trim() || null,
          phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
          email: dto.email === undefined ? undefined : dto.email.trim() || null,
          notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
          isActive: dto.isActive,
        }, select });
        await this.audit.recordIn(tx, { action: 'agent.update',
          entityType: 'Agent', entityId: id, actorId: actor.id, actorEmail: actor.email,
          beforeData: auditProjection(before, ['code', 'name', 'isActive']),
          afterData: auditProjection(after, ['code', 'name', 'isActive']),
          metadata: { contactChanged: before.phone !== after.phone || before.email !== after.email,
            taxIdChanged: before.taxId !== after.taxId } });
        if (before.isActive !== after.isActive) {
          await this.audit.recordIn(tx, { action: after.isActive ? 'agent.reactivate' : 'agent.deactivate',
            entityType: 'Agent', entityId: id, actorId: actor.id, actorEmail: actor.email,
            beforeData: before, afterData: { code: after.code, isActive: after.isActive } });
        }
        return after;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('An agent with this code already exists');
      }
      throw e;
    }
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    return this.update(id, { isActive }, actor);
  }

  /** Keep portal links and historical manifests addressable. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'agent:delete');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "agents" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.agent.findFirst({ where: { id, deletedAt: null },
        select: { id: true, code: true, isActive: true } });
      if (!before) throw new NotFoundException('Agent not found');
      const [manifests, portalUsers, destinations, attachments] = await Promise.all([
        tx.manifest.count({ where: { agentId: id } }),
        tx.user.count({ where: { portalAgentId: id } }),
        tx.agentDestination.count({ where: { agentId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Agent', entityId: id } }),
      ]);
      if (manifests || portalUsers || destinations || attachments) {
        throw new ConflictException('Agent has portal, destination or document history; deactivate instead');
      }
      await tx.agent.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'agent.archive', entityType: 'Agent',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: before, afterData: { code: before.code, isActive: false, archived: true } });
      return { id, archived: true };
    });
  }

  async listDestinations(agentId: string, query: ListAgentDestinationQueryDto) {
    await this.findById(agentId);
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.AgentDestinationWhereInput = {
      agentId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.agentDestination.count({ where }),
      this.prisma.agentDestination.findMany({
        where,
        select: destinationSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { port: { name: 'asc' } },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async createDestination(agentId: string, dto: CreateAgentDestinationDto,
    actor: AuthenticatedUser) {
    const agent = await this.findById(agentId);
    if (!agent.isActive && dto.isActive !== false) {
      throw new ConflictException('Inactive agent cannot receive an active destination');
    }
    const port = await this.prisma.port.findFirst({ where: { id: dto.portId, deletedAt: null },
      select: { isActive: true } });
    if (!port) throw new NotFoundException('Port not found');
    if (!port.isActive && dto.isActive !== false) {
      throw new ConflictException('Inactive port cannot be an active destination');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.agentDestination.create({
        data: {
          agentId,
          portId: dto.portId,
          isActive: dto.isActive ?? true,
        },
        select: destinationSelect,
        });
        await this.audit.recordIn(tx, { action: 'agent_destination.create',
          entityType: 'AgentDestination', entityId: row.id,
          actorId: actor.id, actorEmail: actor.email,
          afterData: { agentId, portId: row.portId, isActive: row.isActive } });
        return row;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('An agent destination with this code already exists');
      }
      throw e;
    }
  }

  async updateDestination(agentId: string, destinationId: string,
    dto: UpdateAgentDestinationDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'agent:update');
    await this.findById(agentId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "agent_destinations" WHERE "id" = ${destinationId} FOR UPDATE`;
      const before = await tx.agentDestination.findFirst({
        where: { id: destinationId, agentId, deletedAt: null },
        select: { id: true, portId: true, isActive: true },
      });
      if (!before) throw new NotFoundException('Agent destination not found');
      if (dto.isActive) {
        const [agent, port] = await Promise.all([
          tx.agent.findFirst({ where: { id: agentId, deletedAt: null }, select: { isActive: true } }),
          tx.port.findFirst({ where: { id: before.portId, deletedAt: null }, select: { isActive: true } }),
        ]);
        if (!agent?.isActive || !port?.isActive) {
          throw new ConflictException('Activate the agent and port before reactivating this destination');
        }
      }
      const after = await tx.agentDestination.update({ where: { id: destinationId },
        data: { isActive: dto.isActive }, select: destinationSelect });
      if (before.isActive !== after.isActive) {
        await this.audit.recordIn(tx, { action: after.isActive ? 'agent_destination.reactivate' : 'agent_destination.deactivate',
          entityType: 'AgentDestination', entityId: destinationId,
          actorId: actor.id, actorEmail: actor.email,
          beforeData: before, afterData: { portId: before.portId, isActive: after.isActive } });
      }
      return after;
    });
  }

  /** DELETE deactivates the link; PATCH can reactivate it without losing its identity. */
  async removeDestination(agentId: string, destinationId: string, actor: AuthenticatedUser) {
    return this.updateDestination(agentId, destinationId, { isActive: false }, actor);
  }

  async findDestinationById(agentId: string, destinationId: string) {
    const destination = await this.prisma.agentDestination.findUnique({
      where: { id: destinationId },
      select: destinationSelect,
    });
    if (!destination || destination.agentId !== agentId || destination.deletedAt) {
      throw new NotFoundException('Agent destination not found');
    }
    return destination;
  }
}
