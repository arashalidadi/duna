import { Module } from '@nestjs/common';
import { DeliveryOrderController } from './delivery-order.controller';
import { ReleaseOrderController } from './release-order.controller';
import { DeliveryReleaseService } from './delivery-release.service';

@Module({
  controllers: [DeliveryOrderController, ReleaseOrderController],
  providers: [DeliveryReleaseService],
  exports: [DeliveryReleaseService],
})
export class DeliveryReleaseModule {}
