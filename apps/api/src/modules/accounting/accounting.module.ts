import { Module } from '@nestjs/common';
import { NumberingModule } from '../../common/infrastructure/numbering/numbering.module';
import { FinanceCoreModule } from '../finance/finance-core.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [FinanceCoreModule, NumberingModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
