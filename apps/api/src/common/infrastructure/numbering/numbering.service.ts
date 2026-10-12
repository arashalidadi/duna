import { Prisma } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AllocateNumberRequest,
  AllocatedNumber,
} from './numbering-sequence.types';

const allSeqFields = {
  id: true,
  name: true,
  documentType: true,
  scopeType: true,
  scopeValue: true,
  prefix: true,
  padding: true,
  format: true,
  nextSequence: true,
  period: true,
  companyId: true,
  isActive: true,
} as const;

/**
 * Transactional, row-locked document-number allocation (ADR-008, DEC-027).
 *
 * - A sequence row is created at most once. Its starting value comes from
 *   `seedNextSequence` (existing max + 1), so no database restarts at 1.
 * - An existing row's counter is NEVER reset. Reactivating an inactive row
 *   keeps its counter (DEC-026: issued numbers are immutable).
 * - Increments happen under `SELECT ... FOR UPDATE`, so concurrent callers
 *   receive distinct numbers and no unique-index collision (no 409).
 */
@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async allocateNumber(req: AllocateNumberRequest): Promise<AllocatedNumber> {
    if (req.tx) {
      return this.allocateIn(req.tx, req);
    }
    return this.prisma.$transaction((tx) => this.allocateIn(tx, req));
  }

  private async allocateIn(
    tx: Prisma.TransactionClient,
    req: AllocateNumberRequest,
  ): Promise<AllocatedNumber> {
    const existing = await tx.numberingSequence.findUnique({
      where: { name: req.name },
      select: { id: true },
    });

    if (!existing) {
      const firstNumber = req.seedNextSequence ? await req.seedNextSequence(tx) : 1;
      // Two first-time callers can race here. The unique `name` index lets one
      // insert win; the other is skipped and then locks the winner's row below.
      await tx.numberingSequence.createMany({
        data: [
          {
            id: req.name,
            name: req.name,
            documentType: req.documentType,
            scopeType: req.scopeType,
            scopeValue: req.scopeValue ?? null,
            prefix: req.prefix ?? '',
            padding: req.padding ?? 5,
            format: req.format ?? '{prefix}{sequence}',
            nextSequence: firstNumber,
            period: req.period ?? 'YYYY',
            companyId: req.companyId ?? null,
            isActive: true,
          },
        ],
        skipDuplicates: true,
      });
    }

    const locked = await tx.$queryRaw<{ id: string; nextSequence: number; isActive: boolean }[]>`
      SELECT "id", "nextSequence", "isActive" FROM "NumberingSequence"
      WHERE "name" = ${req.name}
      FOR UPDATE
    `;
    if (!locked.length) {
      throw new Error(`Numbering sequence vanished during allocation: ${req.name}`);
    }

    const row = locked[0];
    if (!row.isActive) {
      // Reactivate without touching the counter (never restart a sequence).
      await tx.numberingSequence.update({ where: { id: row.id }, data: { isActive: true } });
    }

    const sequence = await tx.numberingSequence.findUniqueOrThrow({
      where: { id: row.id },
      select: allSeqFields,
    });

    const current = row.nextSequence;
    await tx.numberingSequence.update({
      where: { id: row.id },
      data: { nextSequence: current + 1 },
    });

    const rendered = this.renderNumber({
      prefix: sequence.prefix,
      sequenceNumber: current,
      padding: sequence.padding,
      format: sequence.format,
    });

    return {
      sequence: rendered,
      rawSequence: current,
      sequenceName: sequence.name,
      scopeType: sequence.scopeType,
      scopeValue: sequence.scopeValue,
      prefix: sequence.prefix,
      padding: sequence.padding,
      format: sequence.format,
      period: sequence.period,
    };
  }

  renderNumber(params: {
    prefix: string;
    sequenceNumber: number;
    padding: number;
    format: string;
  }): string {
    const sequenceStr = String(params.sequenceNumber).padStart(params.padding, '0');
    return params.format
      .replace('{prefix}', params.prefix)
      .replace('{sequence}', sequenceStr);
  }

  computeScopeValue(period: string, refDate: Date): string {
    const y = refDate.getFullYear();
    switch (period) {
      case 'YYYY':
        return String(y);
      case 'YY':
        return String(y).slice(-2);
      case 'YYYYMM':
        return `${y}${String(refDate.getMonth() + 1).padStart(2, '0')}`;
      case 'QUARTER': {
        const q = Math.floor(refDate.getMonth() / 3) + 1;
        return `${y}-Q${q}`;
      }
      default:
        return String(y);
    }
  }

  async listActiveSequences() {
    return this.prisma.numberingSequence.findMany({
      where: { isActive: true },
      orderBy: [{ documentType: 'asc' }, { scopeType: 'asc' }, { name: 'asc' }],
    });
  }

  async createSequence(data: Prisma.NumberingSequenceCreateInput) {
    return this.prisma.numberingSequence.create({ data });
  }
}
