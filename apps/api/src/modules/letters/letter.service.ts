import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, LetterStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { AuthenticatedUser } from '../../common/auth/types';
import { CreateLetterDto, ListLetterQueryDto, UpdateLetterDto } from './dto/letter.dto';

// ---------------------------------------------------------------------------
// Correspondence register (Phase 17, ADR-037).
//   INCOMING letters are created directly as RECEIVED.
//   OUTGOING letters: DRAFT -> SENT (send freezes content).
//   SENT | RECEIVED -> ARCHIVED (terminal).
// Content edits are DRAFT-only. Replies thread via replyToId (no limit).
// ---------------------------------------------------------------------------
const LETTER_TRANSITIONS: Record<LetterStatus, LetterStatus[]> = {
  DRAFT: ['SENT', 'ARCHIVED'],
  SENT: ['ARCHIVED'],
  RECEIVED: ['ARCHIVED'],
  ARCHIVED: [],
};

const listSelect = {
  id: true,
  letterNumber: true,
  direction: true,
  status: true,
  letterDate: true,
  subject: true,
  body: true,
  refNumber: true,
  fromContact: true,
  toContact: true,
  customerId: true,
  customer: { select: { id: true, code: true, name: true } },
  replyToId: true,
  replyTo: { select: { id: true, letterNumber: true, subject: true } },
  _count: { select: { replies: true } },
  notes: true,
  sentById: true,
  sentAt: true,
  archivedById: true,
  archivedAt: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.LetterSelect;

const LETTER_SORT_FIELDS = new Set(['letterNumber', 'letterDate', 'subject', 'createdAt', 'updatedAt']);

function flatten(l: { _count?: { replies?: number } } & Record<string, unknown>) {
  const { _count, ...rest } = l as { _count?: { replies?: number } };
  return { ...rest, repliesCount: _count?.replies ?? 0 };
}

@Injectable()
export class LetterService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  async list(query: ListLetterQueryDto) {
    const pagination = parsePagination(query);
    const sortField = (query.sort && LETTER_SORT_FIELDS.has(query.sort) ? query.sort : 'letterDate') as
      | 'letterNumber'
      | 'letterDate'
      | 'subject'
      | 'createdAt'
      | 'updatedAt';
    const sortOrder = (query.order ?? 'desc') as Prisma.SortOrder;

    const where: Prisma.LetterWhereInput = { deletedAt: null };
    if (query.status) where.status = query.status as LetterStatus;
    if (query.direction) where.direction = query.direction as 'INCOMING' | 'OUTGOING';
    if (query.customerId) where.customerId = query.customerId;
    if (query.replyToId) where.replyToId = query.replyToId;
    if (query.search) {
      const s = query.search.trim();
      where.AND = {
        OR: [
          { letterNumber: { contains: s, mode: 'insensitive' } },
          { subject: { contains: s, mode: 'insensitive' } },
          { refNumber: { contains: s, mode: 'insensitive' } },
          { fromContact: { contains: s, mode: 'insensitive' } },
          { toContact: { contains: s, mode: 'insensitive' } },
          { customer: { name: { contains: s, mode: 'insensitive' } } },
        ],
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.letter.count({ where }),
      this.prisma.letter.findMany({
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
    const letter = await this.prisma.letter.findFirst({
      where: { id, deletedAt: null },
      select: listSelect,
    });
    if (!letter) throw new NotFoundException('Letter not found');
    return flatten(letter);
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(dto: CreateLetterDto, actor?: AuthenticatedUser) {
    if (dto.replyToId) {
      const parent = await this.prisma.letter.findFirst({
        where: { id: dto.replyToId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('replyTo letter not found');
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Customer not found');
    }

    const letterNumber = await this.generateLetterNumber();
    try {
      return flatten(await this.prisma.letter.create({
        data: {
          letterNumber,
          direction: dto.direction,
          // Incoming mail is a fact: it arrives as RECEIVED, never a draft.
          status: dto.direction === 'INCOMING' ? 'RECEIVED' : 'DRAFT',
          letterDate: dto.letterDate ? new Date(dto.letterDate) : new Date(),
          subject: dto.subject,
          body: dto.body,
          refNumber: dto.refNumber,
          fromContact: dto.fromContact,
          toContact: dto.toContact,
          customerId: dto.customerId,
          replyToId: dto.replyToId,
          notes: dto.notes,
          createdById: actor?.id,
        },
        select: listSelect,
      }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Letter number ${letterNumber} already exists`);
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateLetterDto) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT letters can be edited');
    }
    if (dto.replyToId && dto.replyToId !== id) {
      const parent = await this.prisma.letter.findFirst({
        where: { id: dto.replyToId, deletedAt: null },
        select: { id: true },
      });
      if (!parent) throw new BadRequestException('replyTo letter not found');
    }
    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, deletedAt: null },
        select: { id: true },
      });
      if (!customer) throw new BadRequestException('Customer not found');
    }

    return flatten(await this.prisma.letter.update({
      where: { id },
      data: {
        ...(dto.letterDate !== undefined ? { letterDate: new Date(dto.letterDate) } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.refNumber !== undefined ? { refNumber: dto.refNumber } : {}),
        ...(dto.fromContact !== undefined ? { fromContact: dto.fromContact } : {}),
        ...(dto.toContact !== undefined ? { toContact: dto.toContact } : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.replyToId !== undefined ? { replyToId: dto.replyToId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      select: listSelect,
    }));
  }

  /** DRAFT -> SENT (outgoing only). Freezes content, stamps sender + time. */
  async send(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'SENT');
    return flatten(await this.prisma.letter.update({
      where: { id },
      data: { status: 'SENT', sentById: actor?.id, sentAt: new Date() },
      select: listSelect,
    }));
  }

  /**
   * One-click reply: creates an OUTGOING DRAFT linked to the parent letter,
   * mirroring contacts and prefixing the subject with "Re: ".
   */
  async reply(id: string, dto: { body?: string; notes?: string }, actor?: AuthenticatedUser) {
    const parent = await this.prisma.letter.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        subject: true,
        letterDate: true,
        fromContact: true,
        toContact: true,
        customerId: true,
        refNumber: true,
      },
    });
    if (!parent) throw new NotFoundException('Letter not found');

    const subject = parent.subject.startsWith('Re: ') ? parent.subject : `Re: ${parent.subject}`;
    const letterNumber = await this.generateLetterNumber();
    try {
      return flatten(await this.prisma.letter.create({
        data: {
          letterNumber,
          direction: 'OUTGOING',
          status: 'DRAFT',
          letterDate: new Date(),
          subject,
          body: dto.body,
          // Mirror the counterpart: whoever sent the parent receives the reply.
          fromContact: parent.toContact ?? undefined,
          toContact: parent.fromContact ?? undefined,
          refNumber: parent.refNumber ?? undefined,
          customerId: parent.customerId ?? undefined,
          replyToId: parent.id,
          notes: dto.notes,
          createdById: actor?.id,
        },
        select: listSelect,
      }));
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Letter number ${letterNumber} already exists`);
      }
      throw e;
    }
  }

  /** SENT | RECEIVED -> ARCHIVED. */
  async archive(id: string, actor?: AuthenticatedUser) {
    const existing = await this.assertExists(id);
    this.assertTransition(existing.status, 'ARCHIVED');
    return flatten(await this.prisma.letter.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedById: actor?.id, archivedAt: new Date() },
      select: listSelect,
    }));
  }

  async remove(id: string) {
    const existing = await this.assertExists(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT letters can be deleted');
    }
    await this.prisma.letter.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id, deleted: true };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async assertExists(id: string) {
    const existing = await this.prisma.letter.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true, direction: true },
    });
    if (!existing) throw new NotFoundException('Letter not found');
    return existing;
  }

  private assertTransition(from: LetterStatus, to: LetterStatus) {
    if (!LETTER_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Cannot move letter from ${from} to ${to}`);
    }
  }

  private async generateLetterNumber(): Promise<string> {
    const now = new Date();
    const tag = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.prisma.letter.count({ where: { deletedAt: null } });
    return `LET-${tag}-${String(count + 1).padStart(5, '0')}`;
  }
}
