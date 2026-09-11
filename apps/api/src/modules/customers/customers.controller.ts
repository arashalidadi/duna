import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CustomersService } from './customers.service';
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
  list(@Query() query: ListCustomersQueryDto) {
    return this.customersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('customer:read')
  get(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  @Post()
  @RequirePermissions('customer:create')
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id/active')
  @RequirePermissions('customer:update')
  setActive(@Param('id') id: string, @Body() dto: SetCustomerActiveDto) {
    return this.customersService.setActive(id, dto.isActive);
  }

  @Patch(':id')
  @RequirePermissions('customer:update')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('customer:update')
  remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
