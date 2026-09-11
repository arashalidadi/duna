import { Module } from '@nestjs/common';
import { YardsController } from './yards.controller';
import { YardsService } from './yards.service';

@Module({
  controllers: [YardsController],
  providers: [YardsService],
})
export class YardsModule {}
