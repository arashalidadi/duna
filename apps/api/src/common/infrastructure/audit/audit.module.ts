import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
