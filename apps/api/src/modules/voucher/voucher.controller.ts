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
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { VoucherService } from './voucher.service';
import { CreateVoucherDto, UpdateVoucherDto, CancelVoucherDto } from './dto/voucher.dto';
import type { Request } from 'express';

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
  create(@Body() dto: CreateVoucherDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.service.create(dto, user ? { id: user.id ?? user.sub } : undefined);
  }

  @Patch(':id')
  @RequirePermissions('voucher:update')
  update(@Param('id') id: string, @Body() dto: UpdateVoucherDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('voucher:cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelVoucherDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.service.cancel(id, dto, user ? { id: user.id ?? user.sub } : undefined);
  }

  @Delete(':id')
  @RequirePermissions('voucher:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
