import { Module } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';

@Module({
  controllers: [CurrenciesController, RatesController],
  providers: [CurrenciesService, RatesService],
})
export class CurrenciesModule {}
