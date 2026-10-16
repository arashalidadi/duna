import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateCustomerDto,
  ListCustomersQueryDto,
  SetCustomerActiveDto,
  UpdateCustomerDto,
} from './dto/customers.dto';

@ApiTags('customers')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @RequirePermissions('customer:read')
  list(@Query() query: ListCustomersQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.list(query, actor);
  }

  @Get(':id')
  @RequirePermissions('customer:read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.findById(id, actor);
  }

  @Post()
  @RequirePermissions('customer:create')
  create(@Body() dto: CreateCustomerDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.create(dto, actor);
  }

  @Patch(':id/active')
  @RequirePermissions('customer:update')
  setActive(@Param('id') id: string, @Body() dto: SetCustomerActiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.setActive(id, dto.isActive, actor);
  }

  @Patch(':id')
  @RequirePermissions('customer:update')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('customer:update')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.customersService.remove(id, actor);
  }
}
