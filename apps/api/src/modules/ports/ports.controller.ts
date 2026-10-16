import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { PortsService } from './ports.service';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import {
  CreatePortDto,
  ListPortsQueryDto,
  SetPortActiveDto,
  UpdatePortDto,
} from './dto/ports.dto';

@ApiTags('ports')
@Controller('ports')
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Get()
  @RequirePermissions('port:read')
  list(@Query() query: ListPortsQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.list(query, actor);
  }

  @Patch(':id/active')
  @RequirePermissions('port:update')
  setActive(@Param('id') id: string, @Body() dto: SetPortActiveDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.setActive(id, dto.isActive, actor);
  }

  @Get(':id')
  @RequirePermissions('port:read')
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.findById(id, actor);
  }

  @Post()
  @RequirePermissions('port:create')
  create(@Body() dto: CreatePortDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('port:update')
  update(@Param('id') id: string, @Body() dto: UpdatePortDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('port:update')
  remove(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.portsService.remove(id, actor);
  }
}
