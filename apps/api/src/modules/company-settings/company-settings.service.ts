import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { UpdateCompanySettingsDto } from './dto/company-settings.dto';

export interface CompanySettingsView {
  id: string;
  companyName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCurrency: string;
  supportedCurrencies: string[];
  updatedAt: Date;
}

/** Identity fields read by the document layer (invoices, vouchers, salary slips). */
export interface DocumentIdentity {
  companyName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  defaultCurrency: string;
}

type SettingsRow = {
  id: string;
  companyName: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  defaultCurrency: string;
  supportedCurrenciesJson: string;
  updatedAt: Date;
};

/** Nullable text fields. companyName is required in the database and handled separately. */
const EDITABLE_TEXT_FIELDS = [
  'legalName',
  'registrationNumber',
  'taxNumber',
  'address',
  'city',
  'country',
  'phone',
  'email',
  'website',
] as const;

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  async get(): Promise<CompanySettingsView | null> {
    const row = await this.prisma.companySettings.findFirst();
    return row ? this.toView(row) : null;
  }

  /** Document-layer reader. Returns null when no company settings row exists. */
  async getDocumentIdentity(): Promise<DocumentIdentity | null> {
    const row = await this.prisma.companySettings.findFirst();
    if (!row) {
      return null;
    }
    return {
      companyName: row.companyName,
      legalName: row.legalName,
      registrationNumber: row.registrationNumber,
      taxNumber: row.taxNumber,
      address: row.address,
      city: row.city,
      country: row.country,
      phone: row.phone,
      email: row.email,
      defaultCurrency: row.defaultCurrency,
    };
  }

  async update(
    user: AuthenticatedUser,
    dto: UpdateCompanySettingsDto,
    context: { ipAddress?: string | null; userAgent?: string | null }
  ): Promise<CompanySettingsView> {
    const current = await this.prisma.companySettings.findFirst();

    if (dto.companyName === null) {
      throw new BadRequestException('companyName cannot be empty');
    }
    if (!current && !dto.companyName) {
      throw new BadRequestException('companyName is required to create company settings');
    }

    const supported = dto.supportedCurrencies ?? (current ? this.parseSupported(current.supportedCurrenciesJson) : []);
    const defaultCurrency = dto.defaultCurrency ?? current?.defaultCurrency ?? 'USD';

    if (!supported.includes(defaultCurrency)) {
      throw new BadRequestException('defaultCurrency must be one of supportedCurrencies');
    }
    const knownCurrencies = await this.prisma.currency.findMany({
      where: { code: { in: supported }, isActive: true },
      select: { code: true },
    });
    const knownCodes = new Set(knownCurrencies.map((c) => c.code));
    const unknown = supported.filter((code) => !knownCodes.has(code));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown or inactive currencies: ${unknown.join(', ')}`);
    }

    const textData: Partial<Record<(typeof EDITABLE_TEXT_FIELDS)[number], string | null>> = {};
    for (const field of EDITABLE_TEXT_FIELDS) {
      if (dto[field] !== undefined) {
        textData[field] = dto[field] ?? null;
      }
    }

    const data = {
      ...textData,
      ...(dto.companyName ? { companyName: dto.companyName } : {}),
      defaultCurrency,
      supportedCurrenciesJson: JSON.stringify(supported),
    };

    const saved = await this.prisma.$transaction(async (tx) => {
      if (current) {
        return tx.companySettings.update({
          where: { id: current.id },
          data: { ...data, updatedByUserId: user.id },
        });
      }
      return tx.companySettings.create({
        data: {
          ...data,
          companyName: data.companyName ?? '',
          createdByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
    });

    await this.audit.record({
      action: current ? 'company_settings.update' : 'company_settings.create',
      entityType: 'CompanySettings',
      entityId: saved.id,
      actorId: user.id,
      actorEmail: user.email,
      beforeData: current ? this.toView(current) : null,
      afterData: this.toView(saved),
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
    });

    return this.toView(saved);
  }

  private toView(row: SettingsRow): CompanySettingsView {
    return {
      id: row.id,
      companyName: row.companyName,
      legalName: row.legalName,
      registrationNumber: row.registrationNumber,
      taxNumber: row.taxNumber,
      address: row.address,
      city: row.city,
      country: row.country,
      phone: row.phone,
      email: row.email,
      website: row.website,
      defaultCurrency: row.defaultCurrency,
      supportedCurrencies: this.parseSupported(row.supportedCurrenciesJson),
      updatedAt: row.updatedAt,
    };
  }

  private parseSupported(json: string): string[] {
    try {
      const parsed: unknown = JSON.parse(json);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
}
