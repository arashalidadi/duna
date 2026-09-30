import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AttachmentService } from './attachment.service';
import { AttachmentController } from './attachment.controller';

@Global()
@Module({
  imports: [PrismaModule, StorageModule],
  providers: [AttachmentService],
  controllers: [AttachmentController],
  exports: [AttachmentService],
})
export class AttachmentModule {}
