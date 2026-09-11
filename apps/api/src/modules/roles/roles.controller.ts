import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  ListRolesQueryDto,
  SetRolePermissionsDto,
  SetRoleActiveDto,
  UpdateRoleDto,
} from './dto/roles.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('active')
  @RequirePermissions('role:read')
  listActive() {
    return this.rolesService.listActive();
  }

  @Get()
  @RequirePermissions('role:read')
  list(@Query() query: ListRolesQueryDto) {
    return this.rolesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('role:read')
  get(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @RequirePermissions('role:create')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('role:update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermissions('role:update')
  setActive(@Param('id') id: string, @Body() dto: SetRoleActiveDto) {
    return this.rolesService.setActive(id, dto.isActive);
  }

  @Patch(':id/permissions')
  @RequirePermissions('role:permissions')
  setPermissions(@Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.rolesService.setPermissions(id, dto);
  }
}