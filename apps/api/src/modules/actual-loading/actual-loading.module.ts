import { Module } from '@nestjs/common';
import { ActualLoadingController } from './actual-loading.controller';
import { ActualLoadingService } from './actual-loading.service';

@Module({
  controllers: [ActualLoadingController],
  providers: [ActualLoadingService],
  exports: [ActualLoadingService],
})
export class ActualLoadingModule {}