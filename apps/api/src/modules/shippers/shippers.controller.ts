import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { requireOffice } from '../configuration/configuration.policy';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { ShippersService } from './shippers.service';
import {
  CreateShipperDto,
  ListShipperQueryDto,
  SetShipperActiveDto,
  UpdateShipperDto,
} from './dto/shippers.dto';

@ApiTags('shippers')
@Controller('shippers')
export class ShippersController {
  constructor(private readonly shippersService: ShippersService) {}

  @Get()
  @RequirePermissions('shipper:read')
  list(@Query() query: ListShipperQueryDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'shipper:read');
    return this.shippersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('shipper:read')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'shipper:read');
    return this.shippersService.findById(id);
  }

  @Post()
  @RequirePermissions('shipper:create')
  create(@Body() dto: CreateShipperDto, @CurrentUser() user: AuthenticatedUser) {
    requireOffice(user, 'shipper:create');
    return this.shippersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('shipper:update')
  update(@Param('id') id: string, @Body() dto: UpdateShipperDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shippersService.update(id, dto, user);
  }

  @Patch(':id/active')
  @RequirePermissions('shipper:update')
  setActive(@Param('id') id: string, @Body() dto: SetShipperActiveDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shippersService.setActive(id, dto.isActive, user);
  }

  @Delete(':id')
  @RequirePermissions('shipper:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.shippersService.remove(id, user);
  }
}
