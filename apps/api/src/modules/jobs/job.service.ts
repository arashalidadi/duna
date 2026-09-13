import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(dto: CreateJobDto, actor?: AuthenticatedUser) {
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
      const job = await this.prisma.job.create({
        data: {
          jobNumber,
          title: dto.title,
          description: dto.description,
          jobType: dto.jobType,
          customerId: dto.customerId,
          voyageId: dto.voyageId,
          currencyCode: dto.currencyCode ?? 'USD',
          notes: dto.notes,
          createdById: actor?.id,
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
      return flattenDetail(job);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Job number ${jobNumber} already exists`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateJobDto) {
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

    const job = await this.prisma.job.update({
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
    return flattenDetail(job);
  }

  /** DRAFT -> OPEN. */
  async start(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'OPEN');
    const job = await this.prisma.job.update({ where: { id }, data: { status: 'OPEN' }, select: detailSelect });
    return flattenDetail(job);
  }

  /** OPEN -> COMPLETED. Stamps actor + time. */
  async complete(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'COMPLETED');
    const job = await this.prisma.job.update({
      where: { id },
      data: { status: 'COMPLETED', completedById: actor?.id, completedAt: new Date() },
      select: detailSelect,
    });
    return flattenDetail(job);
  }

  /** DRAFT|OPEN -> CANCELLED (reason required). */
  async cancel(id: string, dto: { cancelReason: string }, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'CANCELLED');
    const job = await this.prisma.job.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledById: actor?.id, cancelledAt: new Date(), cancelReason: dto.cancelReason },
      select: detailSelect,
    });
    return flattenDetail(job);
  }

  async remove(id: string) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT jobs can be deleted');
    }
    await this.prisma.job.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Items (editable while DRAFT|OPEN)
  // -------------------------------------------------------------------------

  async addItem(id: string, dto: JobItemInputDto) {
    const job = await this.assertItemsEditable(id);
    await this.prisma.jobCostItem.create({
      data: {
        jobId: job.id,
        kind: dto.kind,
        category: dto.category,
        description: dto.description,
        amount: dec(dto.amount),
        itemDate: dto.itemDate ? new Date(dto.itemDate) : new Date(),
        notes: dto.notes,
      },
    });
    return this.findById(id);
  }

  async updateItem(id: string, itemId: string, dto: UpdateJobItemDto) {
    await this.assertItemsEditable(id);
    const item = await this.prisma.jobCostItem.findFirst({ where: { id: itemId, jobId: id }, select: { id: true } });
    if (!item) throw new NotFoundException('Cost item not found on this job');
    await this.prisma.jobCostItem.update({
      where: { id: itemId },
      data: {
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.amount !== undefined ? { amount: dec(dto.amount) } : {}),
        ...(dto.itemDate !== undefined ? { itemDate: dto.itemDate ? new Date(dto.itemDate) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    return this.findById(id);
  }

  async removeItem(id: string, itemId: string) {
    await this.assertItemsEditable(id);
    const item = await this.prisma.jobCostItem.findFirst({ where: { id: itemId, jobId: id }, select: { id: true } });
    if (!item) throw new NotFoundException('Cost item not found on this job');
    await this.prisma.jobCostItem.delete({ where: { id: itemId } });
    return this.findById(id);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

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
