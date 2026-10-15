import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { AccountingService } from '../accounting/accounting.service';
import { PostVoyageCostDto } from '../accounting/dto/accounting.dto';
import { CostCategoriesService } from './cost-categories.service';
import { StandardReportsService } from './standard-reports.service';
import { CreateCostCategoryDto, IssueStatementDto, UpdateCostCategoryDto } from './dto/reports.dto';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly standard: StandardReportsService,
    private readonly categories: CostCategoriesService, private readonly accounting: AccountingService) {}

  @Get('pnl')
  @RequirePermissions(['report:read', 'invoice:read', 'voucher:read', 'journal:read', 'expense:read'])
  pnl(@Query('year') year?: string, @Query('voyageId') voyageId?: string) {
    return this.standard.pnl({ year: year ? Number(year) : undefined, voyageId });
  }

  @Get('vat')
  @RequirePermissions(['report:read', 'invoice:read', 'voucher:read', 'journal:read', 'expense:read'])
  vat(@Query('year') year: string, @Query('quarter') q: string) {
    return this.standard.vat(Number(year), Number(q));
  }

  @Get('overdue')
  @RequirePermissions(['report:read', 'invoice:read', 'voucher:read'])
  overdue(@Query('asOf') asOf: string) { return this.standard.overdue(asOf); }

  @Get('releases')
  @RequirePermissions(['report:read', 'release:read', 'invoice:read', 'voucher:read', 'bill:read'])
  releases(@Query('from') from: string, @Query('to') to: string) {
    return this.standard.releases(from, to);
  }

  @Get('released-unpaid')
  @RequirePermissions(['report:read', 'release:read', 'invoice:read', 'voucher:read', 'bill:read'])
  unpaid(@Query('from') from: string, @Query('to') to: string) {
    return this.standard.releases(from, to, true);
  }

  @Get('statements/:customerId')
  @RequirePermissions(['report:read', 'ledger:read', 'customer:read', 'voucher:read', 'invoice:read'])
  statement(@Param('customerId') customerId: string, @Query('currencyCode') currencyCode: string,
    @Query('from') from: string, @Query('to') to: string) {
    return this.standard.statement(customerId, currencyCode, from, to);
  }

  @Post('statements/:customerId/issue')
  @RequirePermissions(['report:read', 'ledger:read', 'customer:read', 'voucher:read', 'invoice:read', 'report:statement_issue'])
  issueStatement(@Param('customerId') customerId: string,
    @Body() body: IssueStatementDto,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.standard.issueStatement(customerId, body.currencyCode, body.from, body.to, actor);
  }

  @Get('statements/:customerId/issues')
  @RequirePermissions(['report:read', 'ledger:read', 'customer:read', 'voucher:read', 'invoice:read'])
  statementIssues(@Param('customerId') customerId: string, @Query('currencyCode') currencyCode: string) {
    return this.standard.issuedStatements(customerId, currencyCode);
  }

  @Get('statements/issues/:id')
  @RequirePermissions(['report:read', 'ledger:read', 'customer:read', 'voucher:read', 'invoice:read'])
  issuedStatement(@Param('id') id: string) { return this.standard.issuedStatement(id); }

  @Get('cost-categories')
  @RequirePermissions(['report:read', 'expense:read'])
  listCategories() { return this.categories.list(); }

  @Post('cost-categories')
  @RequirePermissions(['report:cost_manage', 'expense:post'])
  createCategory(@Body() dto: CreateCostCategoryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.categories.create(dto, actor);
  }

  @Patch('cost-categories/:id')
  @RequirePermissions(['report:cost_manage', 'expense:post'])
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCostCategoryDto,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.categories.update(id, dto, actor);
  }

  @Post('costs')
  @RequirePermissions(['report:cost_manage', 'expense:post', 'voyage:read', 'journal:read', 'journal:post'])
  cost(@Body() dto: PostVoyageCostDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.accounting.voyageCost(dto, actor);
  }
}
