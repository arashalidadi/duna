import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { configFactory } from './config/config.factory';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { PortsModule } from './modules/ports/ports.module';
import { YardsModule } from './modules/yards/yards.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { CargoModule } from './modules/cargo/cargo.module';
import { YardInventoryModule } from './modules/yard-inventory/yard-inventory.module';
import { InspectionsModule } from './modules/inspections/inspection.module';
import { VesselsModule } from './modules/vessels/vessels.module';
import { VoyagesModule } from './modules/voyages/voyages.module';
import { LoadPlanningModule } from './modules/load-planning/load-planning.module';
import { ActualLoadingModule } from './modules/actual-loading/actual-loading.module';
import { ManifestModule } from './modules/manifest/manifest.module';
import { BillModule } from './modules/bill/bill.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { VoucherModule } from './modules/voucher/voucher.module';
import { DeliveryReleaseModule } from './modules/delivery-release/delivery-release.module';
import { ProformaModule } from './modules/proforma/proforma.module';
import { QuotationModule } from './modules/quotation/quotation.module';
import { SalaryModule } from './modules/salary/salary.module';
import { LettersModule } from './modules/letters/letters.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { JwtAuthGuard } from './common/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/auth/guards/permissions.guard';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configFactory],
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    PortsModule,
    YardsModule,
    CustomersModule,
    CurrenciesModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CargoModule,
    YardInventoryModule,
    InspectionsModule,
    VesselsModule,
    VoyagesModule,
    LoadPlanningModule,
    ActualLoadingModule,
    ManifestModule,
    BillModule,
    InvoiceModule,
    VoucherModule,
    DeliveryReleaseModule,
    ProformaModule,
    QuotationModule,
    SalaryModule,
      LettersModule,
      JobsModule,
  ],
  controllers: [AppController],
  providers: [
    // Secure-by-default: every handler requires a valid JWT unless @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Authorization evaluated server-side against @RequirePermissions metadata.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}