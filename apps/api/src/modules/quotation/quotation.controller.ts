import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { QuotationService } from './quotation.service';
import {
  AddQuotationItemDto,
  CancelQuotationDto,
  CreateQuotationDto,
  ListQuotationQueryDto,
  RejectQuotationDto,
  UpdateQuotationDto,
  UpdateQuotationItemDto,
} from './dto/quotation.dto';

@ApiTags('quotation')
@Controller('quotations')
export class QuotationController {
  constructor(private readonly quotations: QuotationService) {}

  @Get()
  @RequirePermissions('quotation:read')
  list(@Query() q: ListQuotationQueryDto) {
    return this.quotations.list(q);
  }

  @Post()
  @RequirePermissions('quotation:create')
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.quotations.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions('quotation:read')
  detail(@Param('id') id: string) {
    return this.quotations.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('quotation:update')
  update(@Param('id') id: string, @Body() dto: UpdateQuotationDto) {
    return this.quotations.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('quotation:delete')
  remove(@Param('id') id: string) {
    return this.quotations.remove(id);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  @Post(':id/send')
  @HttpCode(200)
  @RequirePermissions('quotation:send')
  @ApiOperation({ summary: 'Send the quote to the customer (DRAFT -> SENT)' })
  send(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotations.send(id, user);
  }

  @Post(':id/accept')
  @HttpCode(200)
  @RequirePermissions('quotation:accept')
  @ApiOperation({ summary: 'Record the customer acceptance (SENT -> ACCEPTED)' })
  accept(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotations.accept(id, user);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermissions('quotation:reject')
  @ApiOperation({ summary: 'Record the customer decline (SENT -> REJECTED, reason required)' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotations.reject(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('quotation:cancel')
  @ApiOperation({ summary: 'Withdraw the quote (DRAFT|SENT -> CANCELLED, reason required)' })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelQuotationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotations.cancel(id, dto, user);
  }

  @Post(':id/convert')
  @HttpCode(200)
  @RequirePermissions('quotation:convert')
  @ApiOperation({ summary: 'Convert an ACCEPTED quote into a DRAFT proforma (one-time)' })
  convert(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.quotations.convert(id, user);
  }

  // ─── line items ───────────────────────────────────────────────────────────

  @Post(':id/items')
  @HttpCode(200)
  @RequirePermissions('quotation:update')
  addItem(@Param('id') id: string, @Body() dto: AddQuotationItemDto) {
    return this.quotations.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('quotation:update')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuotationItemDto,
  ) {
    return this.quotations.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('quotation:update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.quotations.removeItem(id, itemId);
  }
}
