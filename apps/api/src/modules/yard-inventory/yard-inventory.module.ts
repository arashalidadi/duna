import { Module } from '@nestjs/common';
import { YardInventoryController } from './yard-inventory.controller';
import { YardInventoryService } from './yard-inventory.service';

@Module({
  controllers: [YardInventoryController],
  providers: [YardInventoryService],
})
export class YardInventoryModule {}