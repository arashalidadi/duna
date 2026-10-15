import { Global, Module } from '@nestjs/common';
import { ConfigurationController } from './configuration.controller';
import { FieldConfigService } from './field-config.service';
import { WorkflowConfigService } from './workflow-config.service';
import { DocumentConfigService } from './document-config.service';
import { ConfigDocumentOutputService } from './config-document-output.service';
import { CoreLabelService } from './core-label.service';

// Export only policy services: operational issuance calls them inside its own
// existing transaction. This module never replaces the operational services.
@Global()
@Module({
  controllers: [ConfigurationController],
  providers: [FieldConfigService, WorkflowConfigService, DocumentConfigService, ConfigDocumentOutputService,
    CoreLabelService],
  exports: [FieldConfigService, WorkflowConfigService],
})
export class ConfigurationModule {}
