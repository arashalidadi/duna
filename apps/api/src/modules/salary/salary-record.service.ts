import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalaryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import { captureIssuedDocument } from '../document-output/document-issue-snapshot';
import {
  NumberingService,
  nextSequenceAfter,
  periodicSequenceRequest,
} from '../../common/infrastructure/numbering';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly audit: AuditService,
  ) {}

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

  async create(dto: CreateSalaryRecordDto, actor: AuthenticatedUser) {
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

    try {
      // Number and record are created in ONE transaction (DEC-027): concurrent creates get
      // distinct SAL numbers from the row-locked sequence, and a failed insert rolls back the counter.
      return await this.prisma.$transaction(async (tx) => {
        const req = periodicSequenceRequest('SALARY_RECORD', new Date());
        const { sequence: recordNumber } = await this.numbering.allocateNumber({
          ...req,
          seedNextSequence: async (seedTx) =>
            nextSequenceAfter(
              req.prefix,
              (
                await seedTx.salaryRecord.findFirst({
                  where: { recordNumber: { startsWith: req.prefix } },
                  orderBy: { recordNumber: 'desc' },
                  select: { recordNumber: true },
                })
              )?.recordNumber ?? null,
            ),
          tx,
        });
        const created = await tx.salaryRecord.create({
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
            createdById: actor.id,
          },
          select: listSelect,
        });
        await this.audit.recordIn(tx, { action: 'salary_record.create_draft',
          entityType: 'SalaryRecord', entityId: created.id,
          actorId: actor.id, actorEmail: actor.email,
          afterData: auditProjection(created, ['recordNumber', 'employeeId', 'year', 'month',
            'status', 'base', 'additions', 'deductions', 'net', 'currencyCode']) });
        return created;
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

  async update(id: string, dto: UpdateSalaryRecordDto, actor: AuthenticatedUser) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "salary_records" WHERE "id" = ${id} FOR UPDATE`;
        const before = await tx.salaryRecord.findFirst({ where: { id, deletedAt: null } });
        if (!before) throw new NotFoundException('Salary record not found');
        if (before.status !== 'DRAFT') throw new ConflictException('Only DRAFT payslips are editable');
        const year = dto.year ?? before.year;
        const month = dto.month ?? before.month;
        const employeeId = dto.employeeId ?? before.employeeId;
        if (employeeId !== before.employeeId) {
          const employee = await tx.employee.findFirst({ where: { id: employeeId, deletedAt: null },
            select: { id: true } });
          if (!employee) throw new NotFoundException('Employee not found');
        }
        if (year !== before.year || month !== before.month || employeeId !== before.employeeId) {
          const duplicate = await tx.salaryRecord.findFirst({ where: {
            employeeId, year, month, id: { not: id },
          }, select: { id: true } });
          if (duplicate) throw new ConflictException('A payslip already exists for this employee and month');
        }
        const base = dto.base !== undefined ? Number(dto.base) : Number(before.base);
        const additions = dto.additions !== undefined ? Number(dto.additions) : Number(before.additions);
        const deductions = dto.deductions !== undefined ? Number(dto.deductions) : Number(before.deductions);
        const net = this.computeNet(base, additions, deductions);
        const after = await tx.salaryRecord.update({ where: { id }, data: {
          employeeId, year, month, base: new Prisma.Decimal(round2(base)),
          additions: new Prisma.Decimal(round2(additions)),
          deductions: new Prisma.Decimal(round2(deductions)), net: new Prisma.Decimal(net),
          currencyCode: dto.currencyCode, notes: dto.notes,
        }, select: listSelect });
        const fields = ['employeeId', 'year', 'month', 'base', 'additions',
          'deductions', 'net', 'currencyCode', 'notes'];
        await this.audit.recordIn(tx, { action: 'salary_record.update_draft',
          entityType: 'SalaryRecord', entityId: id,
          actorId: actor.id, actorEmail: actor.email,
          beforeData: auditProjection(before, fields), afterData: auditProjection(after, fields),
          metadata: { recordNumber: before.recordNumber } });
        return after;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A payslip already exists for this employee and month');
      }
      throw e;
    }
  }

  /** Archive only DRAFT payslips. Keep the employee/month slot and financial
   * values in place; approved/paid/cancelled payslips remain visible. */
  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "salary_records" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.salaryRecord.findFirst({ where: { id, deletedAt: null },
        select: { id: true, recordNumber: true, status: true, employeeId: true, year: true, month: true } });
      if (!row) throw new NotFoundException('Salary record not found');
      if (row.status !== 'DRAFT') {
        throw new ConflictException('Only DRAFT payslips can be archived — cancel instead');
      }
      await tx.salaryRecord.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'salary_record.archive', entityType: 'SalaryRecord',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: row, afterData: { archived: true } });
      return { deleted: true, archived: true, id };
    });
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async approve(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, id);
      this.assertTransition(before.status, 'APPROVED');
      const after = await tx.salaryRecord.update({ where: { id }, data: {
        status: 'APPROVED', approvedById: actor.id, approvedAt: new Date(),
      }, select: listSelect });
      await captureIssuedDocument(tx, 'salary-slip', id, actor.id);
      await this.audit.recordIn(tx, { action: 'salary_record.approve',
        entityType: 'SalaryRecord', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: before.status },
        afterData: { status: after.status, approvedById: actor.id, approvedAt: after.approvedAt,
          net: after.net.toString(), currencyCode: after.currencyCode },
        metadata: { recordNumber: before.recordNumber } });
      return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  /** APPROVED -> PAID; the payment method and reference are part of the event. */
  async pay(id: string, dto: PaySalaryRecordDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, id);
      this.assertTransition(before.status, 'PAID');
      const after = await tx.salaryRecord.update({ where: { id }, data: {
        status: 'PAID', paidById: actor.id, paidAt: new Date(),
        paymentMethod: (dto.paymentMethod as 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER') ?? 'BANK_TRANSFER',
        paymentRef: dto.paymentRef,
      }, select: listSelect });
      await this.audit.recordIn(tx, { action: 'salary_record.pay',
        entityType: 'SalaryRecord', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: before.status },
        afterData: { status: after.status, paidById: actor.id, paidAt: after.paidAt,
          paymentMethod: after.paymentMethod, paymentRef: after.paymentRef,
          net: after.net.toString(), currencyCode: after.currencyCode },
        metadata: { recordNumber: before.recordNumber } });
      return after;
    });
  }

  async cancel(id: string, dto: CancelSalaryRecordDto, actor: AuthenticatedUser) {
    const reason = dto.cancelReason?.trim();
    if (!reason) throw new BadRequestException('A cancellation reason is required');
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockLive(tx, id);
      this.assertTransition(before.status, 'CANCELLED');
      const after = await tx.salaryRecord.update({ where: { id }, data: {
        status: 'CANCELLED', cancelReason: reason,
        cancelledById: actor.id, cancelledAt: new Date(),
      }, select: listSelect });
      await this.audit.recordIn(tx, { action: 'salary_record.cancel',
        entityType: 'SalaryRecord', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: before.status },
        afterData: { status: after.status, cancelledById: actor.id,
          cancelledAt: after.cancelledAt, reason },
        metadata: { recordNumber: before.recordNumber, reason } });
      return after;
    });
  }

  private async lockLive(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "salary_records" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.salaryRecord.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException('Salary record not found');
    return row;
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

}
