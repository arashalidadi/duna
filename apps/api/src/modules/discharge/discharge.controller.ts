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
import { DischargeService } from './discharge.service';
import {
  CancelDischargeDto,
  CompleteDischargeDto,
  CreateDischargeDto,
  ListDischargeQueryDto,
  UpdateDischargeDto,
  UpdateDischargeItemDto,
} from './dto/discharge.dto';

@ApiTags('discharge')
@Controller('discharge')
export class DischargeController {
  constructor(private readonly service: DischargeService) {}

  @Get()
  @RequirePermissions('discharge:read')
  list(@Query() query: ListDischargeQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @RequirePermissions('discharge:read')
  get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('discharge:create')
  create(@Body() dto: CreateDischargeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('discharge:update')
  update(@Param('id') id: string, @Body() dto: UpdateDischargeDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('discharge:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // -------------------------------------------------------------------------
  // Items
  // -------------------------------------------------------------------------

  @Patch(':id/items/:itemId')
  @RequirePermissions('discharge:update')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateDischargeItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateItem(id, itemId, dto, user);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('discharge:update')
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.start(id, user);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('discharge:complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteDischargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.complete(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('discharge:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelDischargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancel(id, dto, user);
  }
}
