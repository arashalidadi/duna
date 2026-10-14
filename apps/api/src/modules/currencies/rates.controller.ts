import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CreateRateDto, UpdateDraftRateDto } from './dto/currency-admin.dto';
import { RatesService } from './rates.service';

@ApiTags('currency-rates')
@Controller('currencies/rates')
export class RatesController {
  constructor(private readonly rates: RatesService) {}

  @Get()
  @RequirePermissions('currency_rate:read')
  list(@Query('currencyCode') currencyCode?: string) {
    return this.rates.list(currencyCode);
  }

  @Post()
  @RequirePermissions('currency_rate:create')
  create(@Body() dto: CreateRateDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rates.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('currency_rate:update')
  editDraft(@Param('id') id: string, @Body() dto: UpdateDraftRateDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rates.updateDraft(id, dto, actor);
  }

  @Post(':id/approve')
  @RequirePermissions('currency_rate:approve')
  approve(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rates.approve(id, actor);
  }
}
