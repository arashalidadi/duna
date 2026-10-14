import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AccountType, JournalKind } from '@prisma/client';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CustomerPostingService } from '../finance/customer-posting.service';
import { LedgerQueryDto } from '../voucher/dto/voucher.dto';
import { AccountingService } from './accounting.service';
import { CreateAccountDto, PostExpenseDto, PostJournalDto, ReverseJournalDto, UpdateAccountDto } from './dto/accounting.dto';

@ApiTags('accounting')
@Controller('ledger')
export class AccountingController {
  constructor(private readonly service: AccountingService, private readonly postings: CustomerPostingService) {}

  @Get('accounts')
  @RequirePermissions('journal:read')
  accounts(@Query('type') type?: AccountType) { return this.service.listAccounts(type); }

  @Post('accounts')
  @RequirePermissions('account:manage')
  createAccount(@Body() dto: CreateAccountDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.createAccount(dto, actor);
  }

  @Patch('accounts/:id')
  @RequirePermissions('account:manage')
  updateAccount(@Param('id') id: string, @Body() dto: UpdateAccountDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.updateAccount(id, dto, actor);
  }

  @Get('accounts/:id/entries')
  @RequirePermissions('journal:read')
  entries(@Param('id') id: string, @Query('currencyCode') code?: string) {
    return this.service.accountEntries(id, code);
  }

  @Get('journals')
  @RequirePermissions('journal:read')
  list(@Query('page') page?: string, @Query('currencyCode') currencyCode?: string,
    @Query('kind') kind?: JournalKind, @Query('customerId') customerId?: string) {
    return this.service.listJournals({ page: page ? Number(page) : undefined, currencyCode, kind, customerId });
  }

  @Get('journals/:id')
  @RequirePermissions('journal:read')
  detail(@Param('id') id: string) { return this.service.journal(id); }

  @Post('journals')
  @RequirePermissions('journal:post')
  post(@Body() dto: PostJournalDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.post(dto, actor);
  }

  @Post('journals/:id/reverse')
  @RequirePermissions('journal:reverse')
  reverse(@Param('id') id: string, @Body() dto: ReverseJournalDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.reverse(id, dto.reason, actor);
  }

  @Post('expenses')
  @RequirePermissions('expense:post')
  expense(@Body() dto: PostExpenseDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.expense(dto, actor);
  }

  @Get('customers-posted')
  @RequirePermissions('ledger:reconcile')
  postedStatement(@Query() query: LedgerQueryDto) { return this.postings.postedStatement(query); }

  @Get('reconciliation')
  @RequirePermissions('ledger:reconcile')
  reconcile() { return this.postings.reconcileAll(); }
}
