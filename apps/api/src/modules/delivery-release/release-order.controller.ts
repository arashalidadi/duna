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
  CreateReleaseOrderDto,
  UpdateReleaseOrderDto,
} from './dto/delivery-release.dto';

@ApiTags('release-orders')
@Controller('release-orders')
export class ReleaseOrderController {
  constructor(private readonly service: DeliveryReleaseService) {}

  /** Pre-check before issuing a release: outstanding balance & override need. */
  @Get('eligibility')
  @RequirePermissions('release:read')
  eligibility(@Query('billOfLadingId') billOfLadingId: string) {
    return this.service.eligibility(billOfLadingId);
  }

  @Get()
  @RequirePermissions('release:read')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'ISSUED' | 'CANCELLED',
    @Query('billOfLadingId') billOfLadingId?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    return this.service.listRelease({
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
  @RequirePermissions('release:read')
  detail(@Param('id') id: string) {
    return this.service.detailRelease(id);
  }

  @Post()
  @RequirePermissions('release:create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReleaseOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createRelease(dto, {
      userId: user.id,
      canOverride: user.permissions.includes('release:override'),
    });
  }

  @Patch(':id')
  @RequirePermissions('release:update')
  update(@Param('id') id: string, @Body() dto: UpdateReleaseOrderDto) {
    return this.service.updateRelease(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermissions('release:cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelDocDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.cancelRelease(id, dto, { userId: user.id });
  }

  @Delete(':id')
  @RequirePermissions('release:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.removeRelease(id);
  }
}
