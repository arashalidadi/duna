import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateAgentDto) {
    try {
      return await this.prisma.agent.create({
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

  async update(id: string, dto: UpdateAgentDto) {
    await this.findById(id);
    try {
      return await this.prisma.agent.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          taxId: dto.taxId?.trim() ?? null,
          address: dto.address?.trim() ?? null,
          phone: dto.phone?.trim() ?? null,
          email: dto.email?.trim() ?? null,
          notes: dto.notes?.trim() ?? null,
          isActive: dto.isActive,
        },
        select,
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

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.agent.update({
      where: { id },
      data: { isActive },
      select,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.agent.update({
      where: { id },
      data: { deletedAt: new Date() },
      select,
    });
  }

  async listDestinations(agentId: string, query: ListAgentDestinationQueryDto) {
    await this.findById(agentId);
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.AgentDestinationWhereInput = {
      agentId,
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

  async createDestination(agentId: string, dto: CreateAgentDestinationDto) {
    await this.findById(agentId);
    try {
      return await this.prisma.agentDestination.create({
        data: {
          agentId,
          portId: dto.portId,
          isActive: dto.isActive ?? true,
        },
        select: destinationSelect,
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

  async updateDestination(
    agentId: string,
    destinationId: string,
    dto: UpdateAgentDestinationDto
  ) {
    await this.findDestinationById(agentId, destinationId);
    return this.prisma.agentDestination.update({
      where: { id: destinationId },
      data: {
        isActive: dto.isActive,
      },
      select: destinationSelect,
    });
  }

  async removeDestination(agentId: string, destinationId: string) {
    await this.findDestinationById(agentId, destinationId);
    await this.prisma.agentDestination.delete({ where: { id: destinationId } });
  }

  async findDestinationById(agentId: string, destinationId: string) {
    const destination = await this.prisma.agentDestination.findUnique({
      where: { id: destinationId },
      select: destinationSelect,
    });
    if (!destination || destination.agentId !== agentId) {
      throw new NotFoundException('Agent destination not found');
    }
    return destination;
  }
}
