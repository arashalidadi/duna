import { Module } from '@nestjs/common';
import { DischargeController } from './discharge.controller';
import { DischargeService } from './discharge.service';

@Module({
  controllers: [DischargeController],
  providers: [DischargeService],
})
export class DischargeModule {}
