import { BadRequestException, Injectable } from '@nestjs/common';
import { BlStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice, string } from './configuration.policy';

/** The B/L status ENUM and transition service are fixed. Only owner-supplied
 * display labels can change; Phase-8 issued bytes are never regenerated. */
@Injectable()
export class CoreLabelService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}
  async billLabels(actor: AuthenticatedUser) {
    requireOffice(actor, 'bill:read');
    const rows = await this.prisma.blLifecycleLabel.findMany();
    return Object.values(BlStatus).map((code) => {
      const row = rows.find((r) => r.code === code);
      return { code, label: row?.label ?? code, configured: !!row,
        technicalFallback: !row || row.label === code };
    });
  }
  async setBillLabel(code: string, label: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'workflow:manage', 'bill:read');
    if (!Object.values(BlStatus).includes(code as BlStatus)) throw new BadRequestException('Unknown B/L status');
    const text = string(label, 'B/L display label', 120);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.blLifecycleLabel.findUnique({ where: { code: code as BlStatus } });
      const row = await tx.blLifecycleLabel.upsert({ where: { code: code as BlStatus },
        create: { code: code as BlStatus, label: text }, update: { label: text } });
      await this.audit.recordIn(tx, { action: 'configuration.bill_label.update', entityType: 'BlLifecycleLabel',
        entityId: code, actorId: actor.id, actorEmail: actor.email,
        beforeData: before, afterData: row });
      return row;
    });
  }
}
