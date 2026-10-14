import { Module } from '@nestjs/common';
import { ExchangeRateService } from './exchange-rate.service';
import { CustomerPostingService } from './customer-posting.service';

@Module({
  providers: [ExchangeRateService, CustomerPostingService],
  exports: [ExchangeRateService, CustomerPostingService],
})
export class FinanceCoreModule {}
