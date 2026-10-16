import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { CargoService } from './cargo.service';
import {
  ChangeCargoStatusDto,
  CreateCargoDto,
  ListCargoQueryDto,
  UpdateCargoDto,
} from './dto/cargo.dto';

@ApiTags('cargo')
@Controller('cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

  @Get()
  @RequirePermissions('cargo:read')
  list(@Query() query: ListCargoQueryDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'cargo:read');
    return this.cargoService.list(query);
  }

  @Get(':id')
  @RequirePermissions('cargo:read')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'cargo:read');
    return this.cargoService.findById(id);
  }

  @Post()
  @RequirePermissions('cargo:create')
  create(@Body() dto: CreateCargoDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'cargo:create');
    return this.cargoService.create(dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('cargo:transition')
  transition(@Param('id') id: string, @Body() dto: ChangeCargoStatusDto,
    @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'cargo:transition');
    return this.cargoService.transition(id, dto.status, user);
  }

  @Patch(':id')
  @RequirePermissions('cargo:update')
  update(@Param('id') id: string, @Body() dto: UpdateCargoDto, @CurrentUser() actor: AuthenticatedUser) {
    requireOffice(actor, 'cargo:update');
    return this.cargoService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('cargo:delete')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    requireOffice(actor, 'cargo:delete');
    return this.cargoService.remove(id, actor);
  }
}