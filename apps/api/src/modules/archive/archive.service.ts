import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { LetterService } from '../letters/letter.service';
import type { ListLetterQueryDto } from '../letters/dto/letter.dto';
import { RETENTION_SCOPES, type RetentionScope, type UpdateRetentionPolicyDto } from './dto/retention-policy.dto';

/** Archiving preserves records; it is never a delete or a substitute for compliance review. */
@Injectable()
export class ArchiveService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly letters: LetterService) {}

  static officeOnly(actor: AuthenticatedUser) {
    if (actor.portalAgentId || actor.portalCustomerId) {
      throw new ForbiddenException('Company archive is restricted to office users');
    }
  }

  async policies(actor: AuthenticatedUser) {
    ArchiveService.officeOnly(actor);
    const rows = await this.prisma.retentionPolicy.findMany({ orderBy: { scope: 'asc' } });
    return RETENTION_SCOPES.map((scope) => rows.find((r) => r.scope === scope) ?? { scope,
      minimumDays: null, archiveAfterDays: null, secureDeleteAfterDays: null,
      authority: null, lawfulBasis: null, updatedById: null, updatedAt: null });
  }

  async setPolicy(scopeInput: string, dto: UpdateRetentionPolicyDto, actor: AuthenticatedUser) {
    ArchiveService.officeOnly(actor);
    if (!RETENTION_SCOPES.includes(scopeInput as RetentionScope)) {
      throw new BadRequestException('Unknown retention scope');
    }
    const scope = scopeInput as RetentionScope;
    if (!Object.keys(dto).length) throw new BadRequestException('At least one policy field is required');
    // Serialize updates, including the first insert. The DB also rejects a
    // decrease for owners/direct SQL and forbids DELETE/TRUNCATE of a policy.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM
        (SELECT pg_advisory_xact_lock(120012, hashtext(${scope}))) AS guard`;
      const before = await tx.retentionPolicy.findUnique({ where: { scope } });
      const minimumDays = dto.minimumDays === undefined ? before?.minimumDays ?? null : dto.minimumDays;
      const archiveAfterDays = dto.archiveAfterDays === undefined ? before?.archiveAfterDays ?? null : dto.archiveAfterDays;
      const secureDeleteAfterDays = dto.secureDeleteAfterDays === undefined
        ? before?.secureDeleteAfterDays ?? null : dto.secureDeleteAfterDays;
      const authority = dto.authority === undefined ? before?.authority ?? null : dto.authority?.trim() || null;
      const lawfulBasis = dto.lawfulBasis === undefined ? before?.lawfulBasis ?? null : dto.lawfulBasis?.trim() || null;
      if (before?.minimumDays != null && (minimumDays == null || minimumDays < before.minimumDays)) {
        throw new ConflictException('A compliance retention floor cannot be removed or reduced');
      }
      if (before?.secureDeleteAfterDays != null &&
          (secureDeleteAfterDays == null || secureDeleteAfterDays < before.secureDeleteAfterDays)) {
        throw new ConflictException('Secure deletion threshold cannot be removed or reduced');
      }
      if (archiveAfterDays != null && (scope !== 'LETTER' || !Number.isInteger(archiveAfterDays) ||
          archiveAfterDays < 1 || archiveAfterDays > 365000 || !authority || authority.length < 10)) {
        throw new BadRequestException('Automatic archive requires an approved letter criterion and documented authority');
      }
      if (minimumDays != null && (!Number.isInteger(minimumDays) || minimumDays < 1 ||
          minimumDays > 365000 || !authority || authority.length < 10)) {
        throw new BadRequestException('Retention period requires a documented compliance authority');
      }
      if (secureDeleteAfterDays != null && (!minimumDays ||
          secureDeleteAfterDays < minimumDays || secureDeleteAfterDays > 365000)) {
        throw new BadRequestException('Secure deletion threshold must meet the retention floor');
      }
      if (scope === 'IDENTITY_DOCUMENT' && minimumDays != null && (!lawfulBasis || lawfulBasis.length < 10)) {
        throw new BadRequestException('Identity capture requires a documented lawful basis');
      }
      if (scope !== 'IDENTITY_DOCUMENT' && lawfulBasis) {
        throw new BadRequestException('Lawful identity-capture basis applies only to identity documents');
      }
      const data = { minimumDays, archiveAfterDays, secureDeleteAfterDays, authority,
        lawfulBasis, updatedById: actor.id };
      const after = before
        ? await tx.retentionPolicy.update({ where: { scope }, data })
        : await tx.retentionPolicy.create({ data: { scope, ...data } });
      await this.audit.recordIn(tx, { action: 'retention.policy.configure', entityType: 'RetentionPolicy',
        entityId: scope, actorId: actor.id, actorEmail: actor.email,
        beforeData: before ? { minimumDays: before.minimumDays, archiveAfterDays: before.archiveAfterDays,
          secureDeleteAfterDays: before.secureDeleteAfterDays, authority: before.authority,
          lawfulBasis: before.lawfulBasis } : null,
        afterData: { minimumDays, archiveAfterDays, secureDeleteAfterDays, authority, lawfulBasis } });
      return after;
    });
  }

  archivedLetters(query: ListLetterQueryDto, actor: AuthenticatedUser) {
    ArchiveService.officeOnly(actor);
    return this.letters.list({ ...query, status: 'ARCHIVED' });
  }

  history(id: string, actor: AuthenticatedUser,
    query: { page?: number; pageSize?: number } = {}) {
    ArchiveService.officeOnly(actor);
    return this.letters.archiveHistory(id, query);
  }

  reopen(id: string, reason: string, actor: AuthenticatedUser) {
    ArchiveService.officeOnly(actor);
    return this.letters.reopen(id, reason, actor);
  }

  /** At most 100 candidates; only SENT/RECEIVED, never drafts or deleted rows. */
  async runAutomatic(actor: AuthenticatedUser, limit = 100) {
    ArchiveService.officeOnly(actor);
    return this.runBatch(limit);
  }

  /** Used by the scheduled CLI after its independent DB identity gate. */
  async runBatch(limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('Invalid batch size');
    const policy = await this.prisma.retentionPolicy.findUnique({ where: { scope: 'LETTER' } });
    if (!policy?.archiveAfterDays) return { configured: false, scanned: 0, archived: 0, changed: 0 };
    const cutoff = new Date(Date.now() - policy.archiveAfterDays * 86400000);
    const candidates = await this.prisma.letter.findMany({ where: { deletedAt: null,
      status: { in: ['SENT', 'RECEIVED'] }, letterDate: { lte: cutoff },
      createdAt: { lte: cutoff }, OR: [{ sentAt: null }, { sentAt: { lte: cutoff } }],
    }, select: { id: true }, orderBy: [{ letterDate: 'asc' }, { id: 'asc' }], take: limit });
    let archived = 0;
    let changed = 0;
    for (const { id } of candidates) {
      try {
        await this.letters.archiveAutomatic(id);
        archived++;
      } catch (error) {
        if (error instanceof ConflictException) changed++;
        else throw error; // operational or audit failure must fail the job
      }
    }
    return { configured: true, scanned: candidates.length, archived, changed };
  }
}
