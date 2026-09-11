import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { PermissionsService } from './permissions.service';
import { ListPermissionsQueryDto } from './dto/permissions.dto';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('all')
  @RequirePermissions('permission:read')
  listAll() {
    return this.permissionsService.listAll();
  }

  @Get('modules')
  @RequirePermissions('permission:read')
  listModules() {
    return this.permissionsService.listModules();
  }

  @Get()
  @RequirePermissions('permission:read')
  list(@Query() query: ListPermissionsQueryDto) {
    return this.permissionsService.list(query);
  }

  @Get(':id')
  @RequirePermissions('permission:read')
  getById(@Param('id') id: string) {
    return this.permissionsService.getById(id);
  }
}