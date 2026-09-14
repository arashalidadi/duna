import { Module } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';
import { BookingsController } from './bookings.controller';
import { VoucherModule } from '../voucher/voucher.module';

@Module({
  imports: [VoucherModule],
  providers: [PortalService],
  controllers: [PortalController, BookingsController],
})
export class PortalModule {}
