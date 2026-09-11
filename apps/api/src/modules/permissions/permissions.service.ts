import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { ListPermissionsQueryDto } from './dto/permissions.dto';

const select = {
  id: true,
  code: true,
  module: true,
  action: true,
} satisfies Prisma.PermissionSelect;

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPermissionsQueryDto) {
    const pagination = parsePagination(query);
    const where: Prisma.PermissionWhereInput = {
      ...(query.module ? { module: query.module } : {}),
      ...(query.search
        ? { code: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.permission.count({ where }),
      this.prisma.permission.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
      }),
    ]);
    return buildPaginated(items, total, pagination);
  }

  async listAll() {
    const items = await this.prisma.permission.findMany({
      select,
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
    return items;
  }

  async getById(id: string) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new BadRequestException('Invalid permission id');
    }
    const perm = await this.prisma.permission.findUnique({ where: { id }, select });
    if (!perm) throw new NotFoundException('Permission not found');
    return perm;
  }

  async listModules() {
    const rows = await this.prisma.permission.findMany({
      select: { module: true },
      distinct: ['module'],
      orderBy: { module: 'asc' },
    });
    return rows.map((r) => r.module);
  }
}