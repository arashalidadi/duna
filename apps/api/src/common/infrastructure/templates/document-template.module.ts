import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { VoucherModule } from '../../../modules/voucher/voucher.module';
import { CompanySettingsModule } from '../../../modules/company-settings/company-settings.module';
import { DocumentAssetsController } from '../../../modules/document-output/document-assets.controller';
import { DocumentAssetsService } from '../../../modules/document-output/document-assets.service';
import { DocumentDataService } from '../../../modules/document-output/document-data.service';
import { DocumentOutputController } from '../../../modules/document-output/document-output.controller';
import { DocumentOutputService } from '../../../modules/document-output/document-output.service';
import { DocumentRendererService } from '../../../modules/document-output/document-renderer.service';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplateController } from './document-template.controller';

@Global()
@Module({
  imports: [PrismaModule, StorageModule, VoucherModule, CompanySettingsModule],
  providers: [DocumentAssetsService, DocumentDataService, DocumentRendererService,
    DocumentTemplateService, DocumentOutputService],
  controllers: [DocumentTemplateController, DocumentAssetsController, DocumentOutputController],
  exports: [DocumentTemplateService, DocumentOutputService],
})
export class DocumentTemplateModule {}
