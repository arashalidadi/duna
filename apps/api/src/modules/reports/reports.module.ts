import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { VoucherModule } from '../voucher/voucher.module';
import { StandardReportsService } from './standard-reports.service';
import { CostCategoriesService } from './cost-categories.service';
import { ReportsController } from './reports.controller';
import { ReportDatasets } from './report-datasets';
import { ReportBuilderService } from './report-builder.service';
import { ReportExportService } from './report-export.service';
import { ReportDownloadController } from './report-download.controller';

@Module({
  imports: [AccountingModule, VoucherModule],
  providers: [StandardReportsService, CostCategoriesService, ReportDatasets,
    ReportBuilderService, ReportExportService],
  controllers: [ReportsController, ReportDownloadController],
})
export class ReportsModule {}
