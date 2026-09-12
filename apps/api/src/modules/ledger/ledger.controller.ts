import { Body, Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { VoucherService } from '../voucher/voucher.service';
import { LedgerQueryDto } from '../voucher/dto/voucher.dto';

@ApiTags('ledger')
@Controller('ledger')
export class LedgerController {
  constructor(private readonly voucherService: VoucherService) {}

  /** Customer statement: ISSUED invoices (debit) + POSTED vouchers (credit). */
  @Get('customers')
  @RequirePermissions('ledger:read')
  statement(@Query() q: LedgerQueryDto) {
    return this.voucherService.ledger(q);
  }
}
