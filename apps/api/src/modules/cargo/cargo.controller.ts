import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
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
  list(@Query() query: ListCargoQueryDto) {
    return this.cargoService.list(query);
  }

  @Get(':id')
  @RequirePermissions('cargo:read')
  get(@Param('id') id: string) {
    return this.cargoService.findById(id);
  }

  @Post()
  @RequirePermissions('cargo:create')
  create(@Body() dto: CreateCargoDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cargoService.create(dto, user);
  }

  @Patch(':id/status')
  @RequirePermissions('cargo:transition')
  transition(@Param('id') id: string, @Body() dto: ChangeCargoStatusDto) {
    return this.cargoService.transition(id, dto.status);
  }

  @Patch(':id')
  @RequirePermissions('cargo:update')
  update(@Param('id') id: string, @Body() dto: UpdateCargoDto) {
    return this.cargoService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('cargo:delete')
  remove(@Param('id') id: string) {
    return this.cargoService.remove(id);
  }
}