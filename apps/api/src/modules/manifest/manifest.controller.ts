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
import { ManifestService } from './manifest.service';
import {
  AddManifestItemDto,
  CancelManifestDto,
  CreateManifestDto,
  ListManifestQueryDto,
  UpdateManifestDto,
  UpdateManifestItemDto,
} from './dto/manifest.dto';

@ApiTags('manifests')
@Controller('manifests')
export class ManifestController {
  constructor(private readonly service: ManifestService) {}

  // -------------------------------------------------------------------------
  // Manifests (Phase 9)
  // -------------------------------------------------------------------------

  @Get()
  @RequirePermissions('manifest:read')
  list(@Query() query: ListManifestQueryDto) {
    return this.service.list(query);
  }

  @Get('eligible-cargo')
  @RequirePermissions('manifest:read')
  eligibleCargo(
    @Query('voyageId') voyageId: string,
    @Query('manifestId') manifestId?: string
  ) {
    return this.service.eligibleCargo(voyageId, manifestId);
  }

  @Get(':id')
  @RequirePermissions('manifest:read')
  get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('manifest:create')
  create(@Body() dto: CreateManifestDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('manifest:update')
  update(@Param('id') id: string, @Body() dto: UpdateManifestDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('manifest:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // -------------------------------------------------------------------------
  // Manifest Items
  // -------------------------------------------------------------------------

  @Post(':id/items')
  @RequirePermissions('manifest:update')
  addItem(
    @Param('id') id: string,
    @Body() dto: AddManifestItemDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.addItem(id, dto, user);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('manifest:update')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateManifestItemDto) {
    return this.service.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('manifest:update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('manifest:submit')
  submit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submit(id, user);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('manifest:approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('manifest:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelManifestDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.cancel(id, dto, user);
  }
}
