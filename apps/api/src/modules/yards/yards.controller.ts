import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { YardsService } from './yards.service';
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
  list(@Query() query: ListYardsQueryDto) {
    return this.yardsService.list(query);
  }

  @Patch(':id/active')
  @RequirePermissions('yard:update')
  setActive(@Param('id') id: string, @Body() dto: SetYardActiveDto) {
    return this.yardsService.setActive(id, dto.isActive);
  }

  @Get(':id')
  @RequirePermissions('yard:read')
  get(@Param('id') id: string) {
    return this.yardsService.findById(id);
  }

  @Post()
  @RequirePermissions('yard:create')
  create(@Body() dto: CreateYardDto) {
    return this.yardsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('yard:update')
  update(@Param('id') id: string, @Body() dto: UpdateYardDto) {
    return this.yardsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('yard:update')
  remove(@Param('id') id: string) {
    return this.yardsService.remove(id);
  }
}
