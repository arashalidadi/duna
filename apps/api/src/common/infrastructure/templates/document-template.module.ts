import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplateController } from './document-template.controller';

@Global()
@Module({
  imports: [PrismaModule, StorageModule],
  providers: [DocumentTemplateService],
  controllers: [DocumentTemplateController],
  exports: [DocumentTemplateService],
})
export class DocumentTemplateModule {}
