import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { InspectionService } from './inspection.service';
import {
  CreateInspectionDto,
  ListInspectionQueryDto,
  RejectInspectionDto,
  UpdateInspectionDto,
} from './dto/inspection.dto';

@ApiTags('inspections')
@Controller('inspections')
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  @Get()
  @RequirePermissions('inspection:read')
  list(@Query() query: ListInspectionQueryDto) {
    return this.inspectionService.list(query);
  }

  @Get('cargo/:cargoId/history')
  @RequirePermissions('inspection:read')
  history(@Param('cargoId') cargoId: string) {
    return this.inspectionService.historyByCargo(cargoId);
  }

  @Get(':id')
  @RequirePermissions('inspection:read')
  get(@Param('id') id: string) {
    return this.inspectionService.findById(id);
  }

  @Post()
  @RequirePermissions('inspection:create')
  create(@Body() dto: CreateInspectionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inspectionService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('inspection:update')
  update(@Param('id') id: string, @Body() dto: UpdateInspectionDto) {
    return this.inspectionService.update(id, dto);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspectionService.approve(id, user);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectInspectionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.inspectionService.reject(id, dto, user);
  }
}