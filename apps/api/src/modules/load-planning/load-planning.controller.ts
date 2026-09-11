import {
  BadRequestException,
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
import { LoadPlanningService } from './load-planning.service';
import {
  AddLoadListItemDto,
  BulkAddLoadListItemsDto,
  CancelLoadListDto,
  CreateLoadListDto,
  EligibleCargoQueryDto,
  ListLoadListQueryDto,
  UpdateLoadListDto,
} from './dto/load-planning.dto';

@ApiTags('load-planning')
@Controller('load-lists')
export class LoadPlanningController {
  constructor(private readonly service: LoadPlanningService) {}

  @Get()
  @RequirePermissions('load_list:read')
  list(@Query() query: ListLoadListQueryDto) {
    return this.service.list(query);
  }

  @Get('eligible-cargo')
  @RequirePermissions('load_list:read')
  getEligibleCargo(@Query() query: EligibleCargoQueryDto) {
    if (!query.voyageId) {
      throw new BadRequestException('voyageId is required');
    }
    return this.service.getEligibleCargo(query.voyageId, query);
  }

  @Get(':id')
  @RequirePermissions('load_list:read')
  get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('load_list:create')
  create(@Body() dto: CreateLoadListDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('load_list:update')
  update(@Param('id') id: string, @Body() dto: UpdateLoadListDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('load_list:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // -------------------------------------------------------------------------
  // Load List Items
  // -------------------------------------------------------------------------

  @Post(':id/items')
  @RequirePermissions('load_list:update')
  addItem(@Param('id') id: string, @Body() dto: AddLoadListItemDto) {
    return this.service.addItem(id, dto);
  }

  @Post(':id/items/bulk')
  @RequirePermissions('load_list:update')
  addItemsBulk(@Param('id') id: string, @Body() dto: BulkAddLoadListItemsDto) {
    return this.service.addItemsBulk(id, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('load_list:update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  @Post(':id/finalize')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('load_list:finalize')
  finalize(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.finalize(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('load_list:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelLoadListDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.cancel(id, dto, user);
  }
}