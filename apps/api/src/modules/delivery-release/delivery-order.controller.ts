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
import { AuthenticatedUser } from '../../common/auth/types';
import { DeliveryReleaseService } from './delivery-release.service';
import {
  CancelDocDto,
  CreateDeliveryOrderDto,
  UpdateDeliveryOrderDto,
} from './dto/delivery-release.dto';

@ApiTags('delivery-orders')
@Controller('delivery-orders')
export class DeliveryOrderController {
  constructor(private readonly service: DeliveryReleaseService) {}

  @Get()
  @RequirePermissions('delivery:read')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'ISSUED' | 'CANCELLED',
    @Query('billOfLadingId') billOfLadingId?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.service.listDelivery({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      search,
      status,
      billOfLadingId,
      sort,
      order,
    });
  }

  @Get(':id')
  @RequirePermissions('delivery:read')
  detail(@Param('id') id: string) {
    return this.service.detailDelivery(id);
  }

  @Post()
  @RequirePermissions('delivery:create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDeliveryOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDelivery(dto, { userId: user.id });
  }

  @Patch(':id')
  @RequirePermissions('delivery:update')
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryOrderDto) {
    return this.service.updateDelivery(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('delivery:cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDocDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelDelivery(id, dto, { userId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('delivery:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.removeDelivery(id);
  }
}
