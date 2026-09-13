import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalaryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import {
  CancelSalaryRecordDto,
  CreateSalaryRecordDto,
  ListSalaryRecordQueryDto,
  PaySalaryRecordDto,
  UpdateSalaryRecordDto,
} from './dto/salary-record.dto';

// ---------------------------------------------------------------------------
// Payslip lifecycle (server-side, ADR-036).
//   DRAFT    -> APPROVED | CANCELLED     (DRAFT = editable)
//   APPROVED -> PAID | CANCELLED          (frozen; pay records method+ref)
//   PAID / CANCELLED are terminal.
// One payslip per employee per month (unique [employeeId, year, month]).
// net = base + additions - deductions, recomputed server-side on every write.
// ---------------------------------------------------------------------------
const SALARY_TRANSITIONS: Record<SalaryStatus, SalaryStatus[]> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PAID', 'CANCELLED'],
  PAID: [],
  CANCELLED: [],
};

const listSelect = {
  id: true,
  recordNumber: true,
  employeeId: true,
  employee: { select: { id: true, code: true, name: true } },
  year: true,
  month: true,
  status: true,
  base: true,
  additions: true,
  deductions: true,
  net: true,
  currencyCode: true,
  paymentMethod: true,
  paymentRef: true,
  notes: true,
  approvedById: true,
  paidById: true,
  cancelledById: true,
  approvedAt: true,
  paidAt: true,
  cancelledAt: true,
  cancelReason: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.SalaryRecordSelect;

const SALARY_SORT_FIELDS = new Set(['recordNumber', 'net', 'year', 'month', 'createdAt', 'updatedAt']);

function round2(v: number): number {
  return Number(v.toFixed(2));
}

@Injectable()
export class SalaryRecordService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(query: ListSalaryRecordQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort && SALARY_SORT_FIELDS.has(query.sort) ? query.sort : 'createdAt') as
      | 'recordNumber'
      | 'net'
      | 'year'
      | 'month'
      | 'createdAt'
      | 'updatedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.SalaryRecordWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as SalaryStatus;
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.year !== undefined) where.year = query.year;
    if (query.month !== undefined) where.month = query.month;
    if (query.search) {
      const s = query.search.trim();
      where.AND = {
        OR: [
          { recordNumber: { contains: s, mode: 'insensitive' } },
          { employee: { name: { contains: s, mode: 'insensitive' } } },
          { employee: { code: { contains: s, mode: 'insensitive' } } },
          { notes: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.salaryRecord.count({ where }),
      this.prisma.salaryRecord.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const row = await this.prisma.salaryRecord.findFirst({
      where: { id, deletedAt: null },
      select: listSelect,
    });
    if (!row) throw new NotFoundException('Salary record not found');
    return row;
  }

  // -------------------------------------------------------------------------
  // CRUD (DRAFT-only edits)
  // -------------------------------------------------------------------------

  async create(dto: CreateSalaryRecordDto, actor?: AuthenticatedUser) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, deletedAt: null },
      select: { id: true, baseSalary: true, currencyCode: true, status: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const now = new Date();
    const year = dto.year ?? now.getFullYear();
    const month = dto.month ?? now.getMonth() + 1;

    await this.assertNoDuplicate(dto.employeeId, year, month);

    const base = dto.base !== undefined ? Number(dto.base) : Number(employee.baseSalary);
    const additions = dto.additions !== undefined ? Number(dto.additions) : 0;
    const deductions = dto.deductions !== undefined ? Number(dto.deductions) : 0;
    const net = this.computeNet(base, additions, deductions);
    const currencyCode = dto.currencyCode ?? employee.currencyCode;

    const recordNumber = await this.generateRecordNumber();
    try {
      return await this.prisma.salaryRecord.create({
        data: {
          recordNumber,
          employeeId: dto.employeeId,
          year,
          month,
          base: new Prisma.Decimal(round2(base)),
          additions: new Prisma.Decimal(round2(additions)),
          deductions: new Prisma.Decimal(round2(deductions)),
          net: new Prisma.Decimal(net),
          currencyCode,
          notes: dto.notes,
          createdById: actor?.id,
        },
        select: listSelect,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `A payslip already exists for this employee in ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateSalaryRecordDto) {
    const existing = await this.assertEditable(id);

    const year = dto.year ?? existing.year;
    const month = dto.month ?? existing.month;
    const employeeId =
      dto.employeeId && dto.employeeId !== existing.employeeId ? dto.employeeId : existing.employeeId;

    if (employeeId !== existing.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: employeeId, deletedAt: null },
        select: { id: true },
      });
      if (!employee) throw new NotFoundException('Employee not found');
    }
    if (year !== existing.year || month !== existing.month || employeeId !== existing.employeeId) {
      await this.assertNoDuplicate(employeeId, year, month, id);
    }

    const base = dto.base !== undefined ? Number(dto.base) : Number(existing.base);
    const additions = dto.additions !== undefined ? Number(dto.additions) : Number(existing.additions);
    const deductions = dto.deductions !== undefined ? Number(dto.deductions) : Number(existing.deductions);
    const net = this.computeNet(base, additions, deductions);

    try {
      return await this.prisma.salaryRecord.update({
        where: { id: existing.id },
        data: {
          employeeId,
          year,
          month,
          base: new Prisma.Decimal(round2(base)),
          additions: new Prisma.Decimal(round2(additions)),
          deductions: new Prisma.Decimal(round2(deductions)),
          net: new Prisma.Decimal(net),
          currencyCode: dto.currencyCode,
          notes: dto.notes,
        },
        select: listSelect,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `A payslip already exists for this employee in ${year}-${String(month).padStart(2, '0')}`,
        );
      }
      throw e;
    }
  }

  /** Hard delete — DRAFT only (approved/paid rows keep the audit trail). */
  async remove(id: string) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT payslips can be deleted — cancel instead');
    }
    await this.prisma.salaryRecord.delete({ where: { id: existing.id } });
    return { deleted: true, id };
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async approve(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'APPROVED');
    return this.prisma.salaryRecord.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: actor?.id, approvedAt: new Date() },
      select: listSelect,
    });
  }

  /** APPROVED -> PAID. Records the payment fact (method + trace) on the row. */
  async pay(id: string, dto: PaySalaryRecordDto, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'PAID');
    return this.prisma.salaryRecord.update({
      where: { id },
      data: {
        status: 'PAID',
        paidById: actor?.id,
        paidAt: new Date(),
        paymentMethod: (dto.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER') ?? 'BANK_TRANSFER',
        paymentRef: dto.paymentRef,
      },
      select: listSelect,
    });
  }

  async cancel(id: string, dto: CancelSalaryRecordDto, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'CANCELLED');
    if (!dto.cancelReason?.trim()) {
      throw new BadRequestException('A cancellation reason is required');
    }
    return this.prisma.salaryRecord.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.cancelReason.trim(),
        cancelledById: actor?.id,
        cancelledAt: new Date(),
      },
      select: listSelect,
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** net = base + additions - deductions; never negative (bad input guard). */
  private computeNet(base: number, additions: number, deductions: number): number {
    const net = round2(base + additions - deductions);
    if (net < 0) {
      throw new BadRequestException('Deductions cannot exceed base + additions');
    }
    if (!Number.isFinite(net)) {
      throw new BadRequestException('Invalid amounts');
    }
    return net;
  }

  private assertTransition(from: SalaryStatus, to: SalaryStatus) {
    if (!SALARY_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Cannot move payslip from ${from} to ${to}`);
    }
  }

  private async assertExists(id: string) {
    const row = await this.prisma.salaryRecord.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        status: true,
        employeeId: true,
        year: true,
        month: true,
        base: true,
        additions: true,
        deductions: true,
        deletedAt: true,
      },
    });
    if (!row) throw new NotFoundException('Salary record not found');
    return row;
  }

  private async assertEditable(id: string) {
    const row = await this.assertExists(id);
    if (row.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT payslips are editable');
    }
    return row;
  }

  private async assertNoDuplicate(employeeId: string, year: number, month: number, exceptId?: string) {
    const dup = await this.prisma.salaryRecord.findFirst({
      where: { employeeId, year, month, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (dup) {
      throw new ConflictException(
        `A payslip already exists for this employee in ${year}-${String(month).padStart(2, '0')}`,
      );
    }
  }

  /** SAL-YYMM-##### sequential within the record's creation month. */
  private async generateRecordNumber(): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear() % 100).padStart(2, '0')}${String(
      now.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const prefix = `SAL-${yymm}-`;
    const latest = await this.prisma.salaryRecord.findFirst({
      where: { recordNumber: { startsWith: prefix } },
      orderBy: { recordNumber: 'desc' },
      select: { recordNumber: true },
    });
    const lastSeq = latest ? Number(latest.recordNumber.slice(prefix.length)) : 0;
    const nextSeq = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }
}
