import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPaginated, parsePagination } from '../../common/utils/pagination.util';
import { parseBooleanFilter } from '../../common/utils/query-filter.util';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  UpdateCustomerDto,
} from './dto/customers.dto';

const select = {
  id: true,
  code: true,
  name: true,
  shortName: true,
  type: true,
  contactName: true,
  phone: true,
  email: true,
  address: true,
  country: true,
  taxId: true,
  currency: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListCustomersQueryDto) {
    const pagination = parsePagination(query);

    const isActive = parseBooleanFilter(query.isActive);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { phone: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { code: 'asc' },
      }),
    ]);

    return buildPaginated(items, total, pagination);
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id }, select });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({
      data: {
        code: dto.code,
        name: dto.name,
        shortName: dto.shortName,
        type: dto.type,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        country: dto.country,
        taxId: dto.taxId,
        currency: dto.currency,
      },
      select,
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findById(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        shortName: dto.shortName,
        type: dto.type,
        contactName: dto.contactName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        country: dto.country,
        taxId: dto.taxId,
        currency: dto.currency,
        isActive: dto.isActive,
      },
      select,
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findById(id);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive },
      select,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
