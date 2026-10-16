import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import { CreateCustomerDto, ListCustomersQueryDto, UpdateCustomerDto } from './dto/customers.dto';

const select = {
  id: true, code: true, name: true, personKind: true, contactName: true,
  phone: true, email: true, address: true, country: true, isActive: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.CustomerSelect;
const auditFields = (row: { code: string; name: string; personKind: unknown; isActive: boolean }) =>
  ({ code: row.code, name: row.name, personKind: row.personKind, isActive: row.isActive });

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(query: ListCustomersQueryDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:read');
    const pagination = parsePagination(query);
    const isActive = parseBooleanFilter(query.isActive);
    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search ? { OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ] } : {}),
      ...(query.personKind ? { personKind: query.personKind } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({ where, select, skip: pagination.skip,
        take: pagination.take, orderBy: { code: 'asc' } }),
    ]);
    return buildPaginated(items, total, pagination);
  }

  async findById(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:read');
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null }, select });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  create(dto: CreateCustomerDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:create');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.customer.create({ data: { code: dto.code, name: dto.name,
        personKind: dto.personKind, contactName: dto.contactName,
        phone: dto.phone, email: dto.email, address: dto.address, country: dto.country }, select });
      await this.audit.recordIn(tx, { action: 'customer.create', entityType: 'Customer',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email,
        afterData: auditFields(row) });
      return row;
    });
  }

  async update(id: string, dto: UpdateCustomerDto, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.customer.findFirst({ where: { id, deletedAt: null }, select });
      if (!before) throw new NotFoundException('Customer not found');
      // PATCH historically accepts isActive. Apply the same portal-account
      // guard as /active in this transaction rather than silently ignoring it.
      if (dto.isActive === false && before.isActive) {
        const portalUsers = await tx.user.count({ where: { portalCustomerId: id,
          isActive: true, deletedAt: null } });
        if (portalUsers) throw new ConflictException('Deactivate the linked portal account before the customer');
      }
      const after = await tx.customer.update({ where: { id }, data: {
        code: dto.code, name: dto.name, personKind: dto.personKind, isActive: dto.isActive,
        contactName: dto.contactName, phone: dto.phone, email: dto.email,
        address: dto.address, country: dto.country,
      }, select });
      await this.audit.recordIn(tx, { action: 'customer.update', entityType: 'Customer',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditFields(before), afterData: auditFields(after) });
      return after;
    });
  }

  async setActive(id: string, isActive: boolean, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.customer.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Customer not found');
      if (before.isActive === isActive) return tx.customer.findUniqueOrThrow({ where: { id }, select });
      if (!isActive) {
        const portalUsers = await tx.user.count({ where: { portalCustomerId: id,
          isActive: true, deletedAt: null } });
        if (portalUsers) throw new ConflictException('Deactivate the linked portal account before the customer');
      }
      const after = await tx.customer.update({ where: { id }, data: { isActive }, select });
      await this.audit.recordIn(tx, { action: isActive ? 'customer.activate' : 'customer.deactivate',
        entityType: 'Customer', entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { isActive: before.isActive }, afterData: { isActive } });
      return after;
    });
  }

  /** Do not hide financial/customer history. Only an unused master may be
   * archived (no hard deletion even then); audit remains accessible. */
  async remove(id: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'customer:update');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "id" = ${id} FOR UPDATE`;
      const before = await tx.customer.findFirst({ where: { id, deletedAt: null }, include: { _count: {
        select: { cargos: true, invoicesIssuedTo: true, statementIssues: true,
          proformasIssuedTo: true, quotationsIssuedTo: true, letters: true, jobs: true,
          deliveryOrdersReceived: true, vouchersReceived: true, bookings: true,
          portalUsers: true },
      } } });
      if (!before) throw new NotFoundException('Customer not found');
      const [postings, journalLines, attachments, legacy, sidecars, issued, rendered] = await Promise.all([
        tx.customerPosting.count({ where: { customerId: id } }),
        tx.journalLine.count({ where: { customerId: id } }),
        tx.fileAttachment.count({ where: { entityType: 'Customer', entityId: id } }),
        tx.customerLegacyAttribute.count({ where: { customerId: id } }),
        tx.configFieldValue.count({ where: { scope: 'Customer', recordId: id } }),
        tx.documentIssuedSnapshot.count({ where: { documentType: 'Customer', recordId: id } }),
        tx.documentRenderedOutput.count({ where: { documentType: 'Customer', recordId: id } }),
      ]);
      if (postings || journalLines || attachments || legacy || sidecars || issued || rendered ||
          Object.values(before._count).some((n) => n > 0)) {
        throw new ConflictException('Customer has dependent or retained records; deactivate instead');
      }
      const after = await tx.customer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      await this.audit.recordIn(tx, { action: 'customer.archive', entityType: 'Customer',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: auditFields(before), afterData: { deletedAt: after.deletedAt, isActive: false } });
      return { id, archived: true };
    });
  }
}
