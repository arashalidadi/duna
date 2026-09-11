import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { VoyagesService } from './voyages.service';
import {
  CancelVoyageDto,
  CreateVoyageDto,
  ListVoyageQueryDto,
  ScheduleVoyageDto,
  UpdateVoyageDto,
} from './dto/voyage.dto';

@ApiTags('voyages')
@Controller('voyages')
export class VoyagesController {
  constructor(private readonly voyagesService: VoyagesService) {}

  @Get()
  @RequirePermissions('voyage:read')
  list(@Query() query: ListVoyageQueryDto) {
    return this.voyagesService.list(query);
  }

  @Get(':id')
  @RequirePermissions('voyage:read')
  get(@Param('id') id: string) {
    return this.voyagesService.findById(id);
  }

  @Post()
  @RequirePermissions('voyage:create')
  create(@Body() dto: CreateVoyageDto, @CurrentUser() user: AuthenticatedUser) {
    return this.voyagesService.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('voyage:update')
  update(@Param('id') id: string, @Body() dto: UpdateVoyageDto) {
    return this.voyagesService.update(id, dto);
  }

  @Post(':id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('voyage:schedule')
  schedule(@Param('id') id: string, @Body() dto: ScheduleVoyageDto) {
    return this.voyagesService.schedule(id, dto);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('voyage:start')
  start(@Param('id') id: string) {
    return this.voyagesService.start(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('voyage:complete')
  complete(@Param('id') id: string) {
    return this.voyagesService.complete(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('voyage:cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelVoyageDto) {
    return this.voyagesService.cancel(id, dto.cancelReason);
  }
}