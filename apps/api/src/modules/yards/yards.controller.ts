import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { YardsService } from './yards.service';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import {
  CreateYardDto,
  ListYardsQueryDto,
  SetYardActiveDto,
  UpdateYardDto,
} from './dto/yards.dto';

@ApiTags('yards')
@Controller('yards')
export class YardsController {
  constructor(private readonly yardsService: YardsService) {}

  @Get()
  @RequirePermissions('yard:read')
  list(@Query() query: ListYardsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.list(query, actor);
  }

  @Patch(':id/active')
  @RequirePermissions('yard:update')
  setActive(@Param('id') id: string, @Body() dto: SetYardActiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.setActive(id, dto.isActive, actor);
  }

  @Get(':id')
  @RequirePermissions('yard:read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.findById(id, actor);
  }

  @Post()
  @RequirePermissions('yard:create')
  create(@Body() dto: CreateYardDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('yard:update')
  update(@Param('id') id: string, @Body() dto: UpdateYardDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('yard:update')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.yardsService.remove(id, actor);
  }
}
