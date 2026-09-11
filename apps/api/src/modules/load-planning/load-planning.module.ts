import { Module } from '@nestjs/common';
import { LoadPlanningController } from './load-planning.controller';
import { LoadPlanningService } from './load-planning.service';

@Module({
  controllers: [LoadPlanningController],
  providers: [LoadPlanningService],
  exports: [LoadPlanningService],
})
export class LoadPlanningModule {}