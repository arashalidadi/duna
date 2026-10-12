import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { InvoiceCorrectionService } from './invoice-correction.service';
import { CorrectInvoiceDto, RejectInvoiceCorrectionDto } from './dto/invoice.dto';

/**
 * Phase 3 — controlled invoice correction (DEC-020…023).
 * invoice:correct requests a correction; invoice:approve_correction approves or rejects one
 * when approval is configured (CompanySettings.invoiceCorrectionApprovalRequired).
 */
@ApiTags('invoices')
@Controller()
export class InvoiceCorrectionController {
  constructor(private readonly service: InvoiceCorrectionService) {}

  @Get('invoices/:id/corrections')
  @RequirePermissions('invoice:read')
  list(@Param('id') id: string) {
    return this.service.listForInvoice(id);
  }

  @Post('invoices/:id/corrections')
  @RequirePermissions('invoice:correct')
  request(
    @Param('id') id: string,
    @Body() dto: CorrectInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.request(id, dto.reason, user);
  }

  @Post('invoice-corrections/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('invoice:approve_correction')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(id, user);
  }

  @Post('invoice-corrections/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('invoice:approve_correction')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectInvoiceCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(id, dto.reason, user);
  }
}
