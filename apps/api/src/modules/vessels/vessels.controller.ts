import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  list(@Query() query: ListVesselQueryDto) {
    return this.vesselsService.list(query);
  }

  @Patch(':id/active')
  @RequirePermissions('vessel:activate')
  setActive(@Param('id') id: string, @Body() dto: SetVesselActiveDto) {
    return this.vesselsService.setActive(id, dto.isActive);
  }

  @Get(':id')
  @RequirePermissions('vessel:read')
  get(@Param('id') id: string) {
    return this.vesselsService.findById(id);
  }

  @Post()
  @RequirePermissions('vessel:create')
  create(@Body() dto: CreateVesselDto) {
    return this.vesselsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('vessel:update')
  update(@Param('id') id: string, @Body() dto: UpdateVesselDto) {
    return this.vesselsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('vessel:update')
  remove(@Param('id') id: string) {
    return this.vesselsService.remove(id);
  }
}