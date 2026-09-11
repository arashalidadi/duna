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
import { UsersService } from './users.service';
import {
  CreateUserDto,
  ListUsersQueryDto,
  ResetUserPasswordDto,
  SetUserActiveDto,
  SetUserRolesDto,
  UpdateUserDto,
  ChangeMyPasswordDto,
} from './dto/users.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions('user:read')
  list(@Query() query: ListUsersQueryDto, @CurrentUser() user: AccountAccess) {
    return this.usersService.list(query, user);
  }

  @Get(':id')
  @RequirePermissions('user:read')
  get(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @RequirePermissions('user:create')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AccountAccess) {
    return this.usersService.create(dto, user);
  }

  // Self-service password change (authenticated only; no admin permission needed).
  @Patch('me/password')
  async changeMyPassword(
    @CurrentUser() user: AccountAccess,
    @Body() dto: ChangeMyPasswordDto
  ) {
    await this.usersService.setOwnPassword(user, dto.currentPassword, dto.newPassword);
    return { changed: true };
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AccountAccess
  ) {
    return this.usersService.update(id, dto, user);
  }

  @Patch(':id/active')
  @RequirePermissions('user:activate')
  setActive(
    @Param('id') id: string,
    @Body() dto: SetUserActiveDto,
    @CurrentUser() user: AccountAccess
  ) {
    return this.usersService.setActive(id, dto, user);
  }

  @Patch(':id/roles')
  @RequirePermissions('user:roles')
  setRoles(
    @Param('id') id: string,
    @Body() dto: SetUserRolesDto,
    @CurrentUser() user: AccountAccess
  ) {
    return this.usersService.setRoles(id, dto, user);
  }

  @Post(':id/reset-password')
  @RequirePermissions('user:update')
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: AccountAccess
  ) {
    return this.usersService.resetPassword(id, dto, user);
  }
}