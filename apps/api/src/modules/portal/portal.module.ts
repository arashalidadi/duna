import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { PortalDocumentsController } from './portal-documents.controller';
import { PortalDocumentsService } from './portal-documents.service';
import { BookingsController } from './bookings.controller';
import { VoucherModule } from '../voucher/voucher.module';

@Module({
  imports: [VoucherModule],
  providers: [PortalService, PortalDocumentsService],
  controllers: [PortalController, PortalDocumentsController, BookingsController],
})
export class PortalModule {}
