import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { auditProjection } from '../../common/infrastructure/audit/audit-change';
import { NotificationWorkerService } from '../notifications/notification-worker.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import { CreateJobDto, JobItemInputDto, ListJobQueryDto, UpdateJobDto, UpdateJobItemDto } from './dto/job.dto';

// ---------------------------------------------------------------------------
// Job & costing (Phase 18, ADR-038).
//   DRAFT -> OPEN -> COMPLETED ; CANCELLED reachable from DRAFT/OPEN.
//   Items (COST / INCOME) editable while DRAFT|OPEN; totals recomputed on read.
//   profit = sum(INCOME) - sum(COST) in the job currency.
// ---------------------------------------------------------------------------
const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const ITEM_SUMMARY = { id: true, kind: true, amount: true } satisfies Prisma.JobCostItemSelect;

const listSelect = {
  id: true,
  jobNumber: true,
  title: true,
  jobType: true,
  customerId: true,
  customer: { select: { id: true, code: true, name: true } },
  voyageId: true,
  voyage: { select: { id: true, voyageNumber: true, vessel: { select: { name: true } } } },
  status: true,
  currencyCode: true,
  openingDate: true,
  completedAt: true,
  cancelledAt: true,
  cancelReason: true,
  notes: true,
  createdById: true,
  completedById: true,
  cancelledById: true,
  createdAt: true,
  updatedAt: true,
  items: { select: ITEM_SUMMARY },
} satisfies Prisma.JobSelect;

const detailSelect = {
  ...listSelect,
  description: true,
  items: {
    select: {
      id: true,
      kind: true,
      category: true,
      description: true,
      amount: true,
      itemDate: true,
      notes: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.JobSelect;

const JOB_SORT_FIELDS = new Set(['jobNumber', 'title', 'openingDate', 'createdAt', 'updatedAt']);

function round2(v: number): number {
  return Number(v.toFixed(2));
}

function dec(v: string): Prisma.Decimal {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`Invalid amount "${v}"`);
  return new Prisma.Decimal(n.toFixed(2));
}

function flatten(j: Record<string, unknown>) {
  const items = (j.items as Array<{ id: string; kind: string; amount: Prisma.Decimal }>) ?? [];
  let income = 0;
  let cost = 0;
  for (const it of items) {
    const v = Number(it.amount);
    if (it.kind === 'INCOME') income += v;
    else cost += v;
  }
  return {
    ...j,
    itemsCount: items.length,
    totalIncome: round2(income).toFixed(2),
    totalCost: round2(cost).toFixed(2),
    profit: round2(income - cost).toFixed(2),
  };
}

function flattenDetail(j: Record<string, unknown>) {
  const items = (j.items as Array<{ kind: string; amount: Prisma.Decimal }>) ?? [];
  let income = 0;
  let cost = 0;
  for (const it of items) {
    const v = Number(it.amount);
    if (it.kind === 'INCOME') income += v;
    else cost += v;
  }
  return {
    ...j,
    itemsCount: items.length,
    totalIncome: round2(income).toFixed(2),
    totalCost: round2(cost).toFixed(2),
    profit: round2(income - cost).toFixed(2),
  };
}

@Injectable()
export class JobService {
  constructor(private readonly prisma: PrismaService,
    private readonly notifications: NotificationWorkerService,
    private readonly audit: AuditService) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(query: ListJobQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort && JOB_SORT_FIELDS.has(query.sort) ? query.sort : 'openingDate') as
      | 'jobNumber'
      | 'title'
      | 'openingDate'
      | 'createdAt'
      | 'updatedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.JobWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as JobStatus;
    if (query.customerId) where.customerId = query.customerId;
    if (query.jobType) where.jobType = query.jobType;
    if (query.voyageId) where.voyageId = query.voyageId;
    if (query.search) {
      const s = query.search.trim();
      where.AND = {
        OR: [
          { jobNumber: { contains: s, mode: 'insensitive' } },
          { title: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
        ],
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.job.count({ where }),
      this.prisma.job.findMany({
        where,
        select: listSelect,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { [sortField]: sortOrder },
      }),
    ]);

    return buildPaginated(items.map(flatten), total, pagination);
  }

  async findById(id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, deletedAt: null },
      select: detailSelect,
    });
    if (!job) throw new NotFoundException('Job not found');
    return flattenDetail(job);
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  /** DEC-071 — the live invoices that bill this Job (Invoice <-> Job many-to-many). */
  async listInvoices(id: string) {
    await this.assertExists(id);
    const links = await this.prisma.invoiceJob.findMany({
      where: { jobId: id, invoice: { deletedAt: null } },
      select: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            issueDate: true,
            dueDate: true,
            currencyCode: true,
            totalAmount: true,
            paidAmount: true,
            customer: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return links.map((l) => l.invoice);
  }

  async create(dto: CreateJobDto, actor: AuthenticatedUser) {
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, deletedAt: null }, select: { id: true } });
      if (!customer) throw new BadRequestException('Customer not found');
    }
    if (dto.voyageId) {
      const voyage = await this.prisma.voyage.findFirst({ where: { id: dto.voyageId }, select: { id: true } });
      if (!voyage) throw new BadRequestException('Voyage not found');
    }

    const jobNumber = await this.generateJobNumber();
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        const saved = await tx.job.create({
        data: {
          jobNumber,
          title: dto.title,
          description: dto.description,
          jobType: dto.jobType,
          customerId: dto.customerId,
          voyageId: dto.voyageId,
          currencyCode: dto.currencyCode ?? 'USD',
          notes: dto.notes,
          createdById: actor.id,
          items: dto.items?.length
            ? {
                create: dto.items.map((it) => ({
                  kind: it.kind,
                  category: it.category,
                  description: it.description,
                  amount: dec(it.amount),
                  itemDate: it.itemDate ? new Date(it.itemDate) : undefined,
                  notes: it.notes,
                })),
              }
            : undefined,
        },
        select: detailSelect,
        });
        await this.audit.recordIn(tx, { action: 'job.create', entityType: 'Job',
          entityId: saved.id, actorId: actor.id, actorEmail: actor.email,
          afterData: { jobNumber: saved.jobNumber, status: saved.status,
            customerId: saved.customerId, voyageId: saved.voyageId,
            currencyCode: saved.currencyCode,
            items: saved.items.map((item) => auditProjection(item, ['id', 'kind', 'category', 'amount'])) } });
        return saved;
      });
      return flattenDetail(job);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Job number ${jobNumber} already exists`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateJobDto, actor: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT' && existing.status !== 'OPEN') {
      throw new ConflictException('Only DRAFT or OPEN jobs can be edited');
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, deletedAt: null }, select: { id: true } });
      if (!customer) throw new BadRequestException('Customer not found');
    }
    if (dto.voyageId) {
      const voyage = await this.prisma.voyage.findFirst({ where: { id: dto.voyageId }, select: { id: true } });
      if (!voyage) throw new BadRequestException('Voyage not found');
    }

    const job = await this.prisma.$transaction(async (tx) => {
      const before = await this.lockJob(tx, id);
      if (before.status !== 'DRAFT' && before.status !== 'OPEN') {
        throw new ConflictException('Only DRAFT or OPEN jobs can be edited');
      }
      const after = await tx.job.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.jobType !== undefined ? { jobType: dto.jobType } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.voyageId !== undefined ? { voyageId: dto.voyageId } : {}),
        ...(dto.currencyCode !== undefined ? { currencyCode: dto.currencyCode } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      select: detailSelect,
      });
      const fields = Object.keys(dto);
      await this.audit.recordIn(tx, { action: 'job.update', entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditProjection(before, fields), afterData: auditProjection(after, fields),
        metadata: { jobNumber: after.jobNumber, fields } });
      return after;
    });
    return flattenDetail(job);
  }

  /** Status and durable notification event are committed atomically. A row lock
   * prevents concurrent transitions from claiming the same previous status. */
  private async transition(id: string, to: JobStatus, actor: AuthenticatedUser,
    extra?: Prisma.JobUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "jobs" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.job.findFirst({ where: { id, deletedAt: null },
        select: { status: true } });
      if (!before) throw new NotFoundException('Job not found');
      this.assertTransition(before.status, to);
      const at = new Date();
      const after = await tx.job.update({ where: { id }, data: { status: to, ...extra },
        select: detailSelect });
      await this.notifications.jobTransitionIn(tx, id, before.status, to, at);
      await this.audit.recordIn(tx, { action: `job.${to.toLowerCase()}`, entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: before.status },
        afterData: { status: after.status, completedAt: after.completedAt,
          cancelledAt: after.cancelledAt, cancelReason: after.cancelReason },
        metadata: { jobNumber: after.jobNumber, reason: after.cancelReason } });
      return flattenDetail(after);
    });
  }

  async start(id: string, actor: AuthenticatedUser) {
    return this.transition(id, 'OPEN', actor);
  }

  async complete(id: string, actor: AuthenticatedUser) {
    return this.transition(id, 'COMPLETED', actor,
      { completedBy: { connect: { id: actor.id } }, completedAt: new Date() });
  }

  async cancel(id: string, dto: { cancelReason: string }, actor: AuthenticatedUser) {
    const reason = dto.cancelReason?.trim();
    if (!reason) throw new BadRequestException('A cancellation reason is required');
    return this.transition(id, 'CANCELLED', actor,
      { cancelledBy: { connect: { id: actor.id } },
        cancelledAt: new Date(), cancelReason: reason });
  }

  async remove(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockJob(tx, id);
      if (before.status !== 'DRAFT') throw new ConflictException('Only DRAFT jobs can be deleted');
      await tx.job.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.recordIn(tx, { action: 'job.delete_draft', entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: before.status, jobNumber: before.jobNumber },
        afterData: { deleted: true } });
      return { id, deleted: true };
    });
  }

  // -------------------------------------------------------------------------
  // Items (editable while DRAFT|OPEN)
  // -------------------------------------------------------------------------

  async addItem(id: string, dto: JobItemInputDto, actor: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const job = await this.lockJob(tx, id);
      if (!['DRAFT', 'OPEN'].includes(job.status)) throw new ConflictException('Cost items are frozen');
      const item = await tx.jobCostItem.create({ data: {
        jobId: job.id, kind: dto.kind, category: dto.category,
        description: dto.description, amount: dec(dto.amount),
        itemDate: dto.itemDate ? new Date(dto.itemDate) : new Date(), notes: dto.notes,
      } });
      await this.audit.recordIn(tx, { action: 'job.item.add', entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        afterData: auditProjection(item, ['id', 'kind', 'category', 'description',
          'amount', 'itemDate', 'notes']), metadata: { jobNumber: job.jobNumber } });
    });
    return this.findById(id);
  }

  async updateItem(id: string, itemId: string, dto: UpdateJobItemDto, actor: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const job = await this.lockJob(tx, id);
      if (!['DRAFT', 'OPEN'].includes(job.status)) throw new ConflictException('Cost items are frozen');
      const before = await tx.jobCostItem.findFirst({ where: { id: itemId, jobId: id } });
      if (!before) throw new NotFoundException('Cost item not found on this job');
      const after = await tx.jobCostItem.update({ where: { id: itemId }, data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.amount !== undefined ? { amount: dec(dto.amount) } : {}),
        ...(dto.itemDate !== undefined ? { itemDate: dto.itemDate ? new Date(dto.itemDate) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      } });
      const fields = Object.keys(dto);
      await this.audit.recordIn(tx, { action: 'job.item.update', entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditProjection(before, fields), afterData: auditProjection(after, fields),
        metadata: { jobNumber: job.jobNumber, itemId } });
    });
    return this.findById(id);
  }

  async removeItem(id: string, itemId: string, actor: AuthenticatedUser) {
    await this.prisma.$transaction(async (tx) => {
      const job = await this.lockJob(tx, id);
      if (!['DRAFT', 'OPEN'].includes(job.status)) throw new ConflictException('Cost items are frozen');
      const before = await tx.jobCostItem.findFirst({ where: { id: itemId, jobId: id } });
      if (!before) throw new NotFoundException('Cost item not found on this job');
      await tx.jobCostItem.delete({ where: { id: itemId } });
      await this.audit.recordIn(tx, { action: 'job.item.remove', entityType: 'Job',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditProjection(before, ['id', 'kind', 'category', 'amount', 'itemDate']),
        metadata: { jobNumber: job.jobNumber, itemId } });
    });
    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async lockJob(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "jobs" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.job.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException('Job not found');
    return row;
  }

  private async assertExists(id: string) {
    const existing = await this.prisma.job.findFirst({ where: { id, deletedAt: null }, select: { id: true, status: true } });
    if (!existing) throw new NotFoundException('Job not found');
    return existing;
  }

  private async assertItemsEditable(id: string) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT' && existing.status !== 'OPEN') {
      throw new ConflictException('Cost items are frozen once the job is COMPLETED or CANCELLED');
    }
    return existing;
  }

  private assertTransition(from: JobStatus, to: JobStatus) {
    if (!JOB_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Cannot move job from ${from} to ${to}`);
    }
  }

  private async generateJobNumber(): Promise<string> {
    const now = new Date();
    const tag = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.job.count({ where: { deletedAt: null } });
    return `JOB-${tag}-${String(count + 1).padStart(5, '0')}`;
  }
}
