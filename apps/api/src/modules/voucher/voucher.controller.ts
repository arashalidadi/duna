import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto, UpdateVoucherDto, CancelVoucherDto, AdjustVoucherDto, ReallocateVoucherDto } from './dto/voucher.dto';

@ApiTags('vouchers')
@Controller('vouchers')
export class VoucherController {
  constructor(private readonly service: VoucherService) {}

  @Get()
  @RequirePermissions('voucher:read')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('type') type?: 'RECEIPT' | 'PAYMENT',
    @Query('status') status?: 'POSTED' | 'CANCELLED',
    @Query('customerId') customerId?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('method') method?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.service.list({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      type,
      status,
      customerId,
      invoiceId,
      method,
      fromDate,
      toDate,
      sort,
      order,
    });
  }

  @Get(':id')
  @RequirePermissions('voucher:read')
  detail(@Param('id') id: string) {
    return this.service.detail(id);
  }

  @Post()
  @RequirePermissions('voucher:create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('voucher:update')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/adjust')
  @RequirePermissions('voucher:adjust')
  adjust(@Param('id') id: string, @Body() dto: AdjustVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.adjust(id, dto, user);
  }

  @Post(':id/allocations')
  @RequirePermissions('voucher:allocate')
  reallocate(@Param('id') id: string, @Body() dto: ReallocateVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reallocate(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermissions('voucher:cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelVoucherDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancel(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('voucher:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
