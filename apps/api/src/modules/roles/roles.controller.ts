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
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AccountAccess } from '../../common/auth/account-access';
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
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: AccountAccess) {
    return this.rolesService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions('role:update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AccountAccess) {
    return this.rolesService.update(id, dto, actor);
  }

  @Patch(':id/active')
  @RequirePermissions('role:update')
  setActive(@Param('id') id: string, @Body() dto: SetRoleActiveDto, @CurrentUser() actor: AccountAccess) {
    return this.rolesService.setActive(id, dto.isActive, actor);
  }

  @Patch(':id/permissions')
  @RequirePermissions('role:permissions')
  setPermissions(
    @Param('id') id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser() actor: AccountAccess
  ) {
    return this.rolesService.setPermissions(id, dto, actor);
  }
}