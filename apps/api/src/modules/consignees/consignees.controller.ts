import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
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
  list(@Query() query: ListConsigneeQueryDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'consignee:read');
    return this.consigneesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('consignee:read')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'consignee:read');
    return this.consigneesService.findById(id);
  }

  @Post()
  @RequirePermissions('consignee:create')
  create(@Body() dto: CreateConsigneeDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'consignee:create');
    return this.consigneesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('consignee:update')
  update(@Param('id') id: string, @Body() dto: UpdateConsigneeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.consigneesService.update(id, dto, user);
  }

  @Patch(':id/active')
  @RequirePermissions('consignee:update')
  setActive(@Param('id') id: string, @Body() dto: SetConsigneeActiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.consigneesService.setActive(id, dto.isActive, user);
  }

  @Delete(':id')
  @RequirePermissions('consignee:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.consigneesService.remove(id, user);
  }
}
