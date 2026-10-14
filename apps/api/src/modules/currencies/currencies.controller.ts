import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency-admin.dto';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @RequirePermissions('currency:read')
  listAll() {
    return this.currenciesService.listAll();
  }

  @Get('manage')
  @RequirePermissions('currency:manage')
  listManaged() {
    return this.currenciesService.listManaged();
  }

  @Post()
  @RequirePermissions('currency:manage')
  create(@Body() dto: CreateCurrencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.currenciesService.create(dto, user);
  }

  @Patch(':code')
  @RequirePermissions('currency:manage')
  update(@Param('code') code: string, @Body() dto: UpdateCurrencyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.currenciesService.update(code, dto, user);
  }
}
