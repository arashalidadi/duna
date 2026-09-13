import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateEmployeeDto,
  ListEmployeeQueryDto,
  UpdateEmployeeDto,
} from './dto/employee.dto';

const listSelect = {
  id: true,
  code: true,
  name: true,
  nationalId: true,
  position: true,
  phone: true,
  email: true,
  hireDate: true,
  baseSalary: true,
  currencyCode: true,
  status: true,
  notes: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  _count: { select: { salaryRecords: true } },
} satisfies Prisma.EmployeeSelect;

const EMPLOYEE_SORT_FIELDS = new Set(['code', 'name', 'hireDate', 'baseSalary', 'createdAt', 'updatedAt']);

/** Prisma's nested _count -> flat salaryRecordsCount (matches Employee in @shipping/shared). */
function flattenEmp<T extends { _count?: { salaryRecords?: number } }>(
  row: T,
): Omit<T, '_count'> & { salaryRecordsCount: number } {
  const { _count, ...rest } = row;
  return { ...rest, salaryRecordsCount: _count?.salaryRecords ?? 0 };
}

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListEmployeeQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort && EMPLOYEE_SORT_FIELDS.has(query.sort) ? query.sort : 'createdAt') as
      | 'code'
      | 'name'
      | 'hireDate'
      | 'baseSalary'
      | 'createdAt'
      | 'updatedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.EmployeeWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as 'ACTIVE' | 'INACTIVE';
    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { name: { contains: s, mode: 'insensitive' } },
        { nationalId: { contains: s, mode: 'insensitive' } },
        { position: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.employee.count({ where }),
      this.prisma.employee.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(items.map(flattenEmp), total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: listSelect,
    });
    if (!row) throw new NotFoundException('Employee not found');
    return flattenEmp(row);
  }

  async create(dto: CreateEmployeeDto, actor?: AuthenticatedUser) {
    const code = dto.code?.trim() || (await this.generateCode());
    try {
      const created = await this.prisma.employee.create({
        data: {
          code,
          name: dto.name,
          nationalId: dto.nationalId,
          position: dto.position,
          phone: dto.phone,
          email: dto.email,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          baseSalary: dto.baseSalary ?? 0,
          currencyCode: dto.currencyCode ?? 'IRR',
          status: (dto.status as 'ACTIVE' | 'INACTIVE') ?? 'ACTIVE',
          notes: dto.notes,
          createdById: actor?.id,
        },
        select: listSelect,
      });
      return flattenEmp(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Employee code ${code} already exists`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const existing = await this.assertExists(id);
    if (dto.code && dto.code !== existing.code) {
      const dup = await this.prisma.employee.findFirst({
        where: { code: dto.code, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException(`Employee code ${dto.code} already exists`);
    }
    try {
      const updated = await this.prisma.employee.update({
        where: { id: existing.id },
        data: {
          code: dto.code,
          name: dto.name,
          nationalId: dto.nationalId,
          position: dto.position,
          phone: dto.phone,
          email: dto.email,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          baseSalary: dto.baseSalary,
          currencyCode: dto.currencyCode,
          status: dto.status as 'ACTIVE' | 'INACTIVE' | undefined,
          notes: dto.notes,
        },
        select: listSelect,
      });
      return flattenEmp(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Employee code ${dto.code} already exists`);
      }
      throw e;
    }
  }

  /** Hard delete — only when no payslips reference the employee (audit trail). */
  async remove(id: string) {
    const existing = await this.assertExists(id);
    const records = await this.prisma.salaryRecord.count({ where: { employeeId: existing.id } });
    if (records > 0) {
      throw new ConflictException(
        `Employee has ${records} payslip(s) — set status INACTIVE instead of deleting`,
      );
    }
    await this.prisma.employee.delete({ where: { id: existing.id } });
    return { deleted: true, id };
  }

  private async assertExists(id: string) {
    const row = await this.prisma.employee.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!row) throw new NotFoundException('Employee not found');
    return row;
  }

  /** EMP-##### sequential — max existing suffix + 1. */
  private async generateCode(): Promise<string> {
    const latest = await this.prisma.employee.findFirst({
      where: { code: { startsWith: 'EMP-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastSeq = latest ? Number(latest.code.slice('EMP-'.length)) : 0;
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
    return `EMP-${String(next).padStart(5, '0')}`;
  }
}
