import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
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
  list(@Query() query: ListShipperQueryDto) {
    return this.shippersService.list(query);
  }

  @Get(':id')
  @RequirePermissions('shipper:read')
  get(@Param('id') id: string) {
    return this.shippersService.findById(id);
  }

  @Post()
  @RequirePermissions('shipper:create')
  create(@Body() dto: CreateShipperDto) {
    return this.shippersService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('shipper:update')
  update(@Param('id') id: string, @Body() dto: UpdateShipperDto) {
    return this.shippersService.update(id, dto);
  }

  @Patch(':id/active')
  @RequirePermissions('shipper:update')
  setActive(@Param('id') id: string, @Body() dto: SetShipperActiveDto) {
    return this.shippersService.setActive(id, dto.isActive);
  }

  @Delete(':id')
  @RequirePermissions('shipper:delete')
  remove(@Param('id') id: string) {
    return this.shippersService.remove(id);
  }
}
