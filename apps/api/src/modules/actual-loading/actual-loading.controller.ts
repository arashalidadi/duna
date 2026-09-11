import {
  Body,
  Controller,
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
import { ActualLoadingService } from './actual-loading.service';
import {
  BulkUpdateActualLoadingItemsDto,
  CancelActualLoadingDto,
  CompleteActualLoadingDto,
  CreateActualLoadingDto,
  ListActualLoadingQueryDto,
  UpdateActualLoadingItemDto,
} from './dto/actual-loading.dto';

@ApiTags('actual-loading')
@Controller('actual-loading')
export class ActualLoadingController {
  constructor(private readonly service: ActualLoadingService) {}

  // -------------------------------------------------------------------------
  // Actual Loading (Phase 8)
  // -------------------------------------------------------------------------

  @Get()
  @RequirePermissions('actual_loading:read')
  list(@Query() query: ListActualLoadingQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions('actual_loading:read')
  get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('actual_loading:create')
  create(@Body() dto: CreateActualLoadingDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('actual_loading:update')
  update(@Param('id') id: string, @Body() dto: { notes?: string }) {
    return this.service.update(id, dto);
  }

  // -------------------------------------------------------------------------
  // Actual Loading Items
  // -------------------------------------------------------------------------

  @Patch(':id/items/:loadListItemId')
  @RequirePermissions('actual_loading:update')
  updateItem(
    @Param('id') id: string,
    @Param('loadListItemId') loadListItemId: string,
    @Body() dto: UpdateActualLoadingItemDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.updateItem(id, loadListItemId, dto, user);
  }

  @Patch(':id/items')
  @RequirePermissions('actual_loading:update')
  updateItemsBulk(
    @Param('id') id: string,
    @Body() dto: BulkUpdateActualLoadingItemsDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.updateItemsBulk(id, dto, user);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('actual_loading:update')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.start(id, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('actual_loading:complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteActualLoadingDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.complete(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('actual_loading:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelActualLoadingDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.cancel(id, dto, user);
  }
}