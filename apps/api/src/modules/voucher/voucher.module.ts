import { Module } from '@nestjs/common';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { LedgerController } from '../ledger/ledger.controller';

@Module({
  controllers: [VoucherController, LedgerController],
  providers: [VoucherService],
  exports: [VoucherService],
})
export class VoucherModule {}
