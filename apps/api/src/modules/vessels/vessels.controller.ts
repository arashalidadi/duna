import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { VesselsService } from './vessels.service';
import {
  CreateVesselDto,
  ListVesselQueryDto,
  SetVesselActiveDto,
  UpdateVesselDto,
} from './dto/vessel.dto';

@ApiTags('vessels')
@Controller('vessels')
export class VesselsController {
  constructor(private readonly vesselsService: VesselsService) {}

  @Get()
  @RequirePermissions('vessel:read')
  list(@Query() query: ListVesselQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:read');
    return this.vesselsService.list(query);
  }

  @Patch(':id/active')
  @RequirePermissions('vessel:activate')
  setActive(@Param('id') id: string, @Body() dto: SetVesselActiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vesselsService.setActive(id, dto.isActive, actor);
  }

  @Get(':id')
  @RequirePermissions('vessel:read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    requireOffice(actor, 'vessel:read');
    return this.vesselsService.findById(id);
  }

  @Post()
  @RequirePermissions('vessel:create')
  create(@Body() dto: CreateVesselDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vesselsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('vessel:update')
  update(@Param('id') id: string, @Body() dto: UpdateVesselDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.vesselsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('vessel:update')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.vesselsService.remove(id, actor);
  }
}