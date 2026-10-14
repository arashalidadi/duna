import { Module } from '@nestjs/common';
import { VoucherController } from './voucher.controller';
import { VoucherService } from './voucher.service';
import { LedgerController } from '../ledger/ledger.controller';
import { FinanceCoreModule } from '../finance/finance-core.module';
import { VoucherAllocationService } from './voucher-allocation.service';

@Module({
  imports: [FinanceCoreModule],
  controllers: [VoucherController, LedgerController],
  providers: [VoucherService, VoucherAllocationService],
  exports: [VoucherService],
})
export class VoucherModule {}
