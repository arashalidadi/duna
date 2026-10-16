import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
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
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

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

  async create(dto: CreateEmployeeDto, actor: AuthenticatedUser) {
    const code = dto.code?.trim() || (await this.generateCode());
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const row = await tx.employee.create({
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
          createdById: actor.id,
        },
        select: listSelect,
        });
        await this.audit.recordIn(tx, { action: 'employee.create', entityType: 'Employee',
          entityId: row.id, actorId: actor.id, actorEmail: actor.email,
          afterData: auditProjection(row, ['code', 'position', 'baseSalary', 'currencyCode', 'status']),
          metadata: { nationalIdPresent: Boolean(row.nationalId) } });
        return row;
      });
      return flattenEmp(created);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Employee code ${code} already exists`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto, actor: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    if (dto.code && dto.code !== existing.code) {
      const dup = await this.prisma.employee.findFirst({
        where: { code: dto.code, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException(`Employee code ${dto.code} already exists`);
    }
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "employees" WHERE "id" = ${id} FOR UPDATE`;
        const current = await tx.employee.findFirst({ where: { id, deletedAt: null },
          select: listSelect });
        if (!current) throw new NotFoundException('Employee not found');
        const result = await tx.employee.update({
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
        const fields = ['code', 'position', 'baseSalary', 'currencyCode', 'status'];
        await this.audit.recordIn(tx, { action: 'employee.update', entityType: 'Employee',
          entityId: id, actorId: actor.id, actorEmail: actor.email,
          beforeData: auditProjection(current, fields), afterData: auditProjection(result, fields),
          metadata: { nationalIdChanged: current.nationalId !== result.nationalId,
            contactChanged: current.phone !== result.phone || current.email !== result.email,
            nameChanged: current.name !== result.name } });
        if (current.status !== result.status) {
          await this.audit.recordIn(tx, { action: result.status === 'ACTIVE' ? 'employee.reactivate' : 'employee.deactivate',
            entityType: 'Employee', entityId: id, actorId: actor.id, actorEmail: actor.email,
            beforeData: auditProjection(current, ['code', 'status']),
            afterData: { code: result.code, status: result.status } });
        }
        return result;
      });
      return flattenEmp(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Employee code ${dto.code} already exists`);
      }
      throw e;
    }
  }

  /** Preserve identity and linked records. Payroll (including archived rows) and
   * sensitive attachments block archival; otherwise deactivate and audit. */
  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "employees" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.employee.findFirst({ where: { id, deletedAt: null },
        select: { id: true, code: true, status: true } });
      if (!row) throw new NotFoundException('Employee not found');
      const [records, attachments] = await Promise.all([
        tx.salaryRecord.count({ where: { employeeId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Employee', entityId: id } }),
      ]);
      if (records || attachments) {
        throw new ConflictException('Employee has payroll or attachments; deactivate instead');
      }
      await tx.employee.update({ where: { id }, data: { status: 'INACTIVE', deletedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'employee.archive', entityType: 'Employee',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: row, afterData: { status: 'INACTIVE', archived: true } });
      return { deleted: true, archived: true, id };
    });
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
