import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { ConsigneesService } from './consignees.service';
import {
  CreateConsigneeDto,
  ListConsigneeQueryDto,
  SetConsigneeActiveDto,
  UpdateConsigneeDto,
} from './dto/consignees.dto';

@ApiTags('consignees')
@Controller('consignees')
export class ConsigneesController {
  constructor(private readonly consigneesService: ConsigneesService) {}

  @Get()
  @RequirePermissions('consignee:read')
  list(@Query() query: ListConsigneeQueryDto) {
    return this.consigneesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('consignee:read')
  get(@Param('id') id: string) {
    return this.consigneesService.findById(id);
  }

  @Post()
  @RequirePermissions('consignee:create')
  create(@Body() dto: CreateConsigneeDto) {
    return this.consigneesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('consignee:update')
  update(@Param('id') id: string, @Body() dto: UpdateConsigneeDto) {
    return this.consigneesService.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermissions('consignee:update')
  setActive(@Param('id') id: string, @Body() dto: SetConsigneeActiveDto) {
    return this.consigneesService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @RequirePermissions('consignee:delete')
  remove(@Param('id') id: string) {
    return this.consigneesService.remove(id);
  }
}
