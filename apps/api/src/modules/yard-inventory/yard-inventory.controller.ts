import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { YardInventoryService } from './yard-inventory.service';
import {
  ListInventoryQueryDto,
  PlaceCargoDto,
  UpdateInventoryDto,
} from './dto/yard-inventory.dto';

@ApiTags('yard-inventory')
@Controller('yard-inventory')
export class YardInventoryController {
  constructor(private readonly yardInventoryService: YardInventoryService) {}

  @Get()
  @RequirePermissions('yard-inventory:read')
  list(@Query() query: ListInventoryQueryDto) {
    return this.yardInventoryService.list(query);
  }

  @Get(':id')
  @RequirePermissions('yard-inventory:read')
  get(@Param('id') id: string) {
    return this.yardInventoryService.findById(id);
  }

  @Post()
  @RequirePermissions('yard-inventory:create')
  place(@Body() dto: PlaceCargoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.yardInventoryService.place(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('yard-inventory:update')
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.yardInventoryService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermissions('yard-inventory:remove')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.yardInventoryService.remove(id, user);
  }
}