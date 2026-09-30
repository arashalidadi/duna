import { Module } from '@nestjs/common';
import { ConsigneesService } from './consignees.service';
import { ConsigneesController } from './consignees.controller';

@Module({
  controllers: [ConsigneesController],
  providers: [ConsigneesService],
  exports: [ConsigneesService],
})
export class ConsigneesModule {}
