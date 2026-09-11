import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { PortsService } from './ports.service';
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
  list(@Query() query: ListPortsQueryDto) {
    return this.portsService.list(query);
  }

  @Patch(':id/active')
  @RequirePermissions('port:update')
  setActive(@Param('id') id: string, @Body() dto: SetPortActiveDto) {
    return this.portsService.setActive(id, dto.isActive);
  }

  @Get(':id')
  @RequirePermissions('port:read')
  get(@Param('id') id: string) {
    return this.portsService.findById(id);
  }

  @Post()
  @RequirePermissions('port:create')
  create(@Body() dto: CreatePortDto) {
    return this.portsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('port:update')
  update(@Param('id') id: string, @Body() dto: UpdatePortDto) {
    return this.portsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('port:update')
  remove(@Param('id') id: string) {
    return this.portsService.remove(id);
  }
}
