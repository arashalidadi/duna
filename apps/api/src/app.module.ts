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