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
 * Transactional, row-locked document-number allocation (ADR-008).
 * Sequences are upserted lazily on first use and incremented under
 * `SELECT ... FOR UPDATE` so concurrent allocations never collide.
 */
@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async allocateNumber(req: AllocateNumberRequest): Promise<AllocatedNumber> {
    const format = req.format ?? '{prefix}{sequence}';
    const padding = req.padding ?? 5;
    const prefix = req.prefix ?? '';
    const period = req.period ?? 'YYYY';

    return this.prisma.$transaction(async (tx) => {
      let sequence = await tx.numberingSequence.findUnique({
        where: { name: req.name },
        select: allSeqFields,
      });

      if (!sequence || !sequence.isActive) {
        sequence = await tx.numberingSequence.upsert({
          where: { name: req.name },
          create: {
            id: req.name,
            name: req.name,
            documentType: req.documentType,
            scopeType: req.scopeType,
            scopeValue: req.scopeValue ?? null,
            prefix,
            padding,
            format,
            nextSequence: 1,
            period,
            companyId: req.companyId ?? null,
            isActive: true,
          },
          update: {
            isActive: true,
            documentType: req.documentType,
            scopeType: req.scopeType,
            scopeValue: req.scopeValue ?? null,
            prefix: prefix ?? '',
            padding: padding ?? 5,
            format: format ?? '{prefix}{sequence}',
            period: period ?? 'YYYY',
            companyId: req.companyId ?? null,
            nextSequence: 1,
          },
          select: allSeqFields,
        });
      }

      const locked = await tx.$queryRaw<{ nextSequence: number }[]>`
        SELECT "nextSequence" FROM "NumberingSequence"
        WHERE "id" = ${sequence.id}
        FOR UPDATE
      `;
      if (!locked.length) {
        throw new Error(`Numbering sequence vanished during allocation: ${req.name}`);
      }

      const current = locked[0].nextSequence;
      await tx.numberingSequence.update({
        where: { id: sequence.id },
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
    });
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
