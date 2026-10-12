import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceCorrectionController } from './invoice-correction.controller';
import { InvoiceCorrectionService } from './invoice-correction.service';
import { InvoiceService } from './invoice.service';

@Module({
  controllers: [InvoiceController, InvoiceCorrectionController],
  providers: [InvoiceService, InvoiceCorrectionService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
