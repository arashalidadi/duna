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

  /**
   * Book: PENDING → BOOKED.
   * Books an inspection for execution.
   */
  @Post(':id/book')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:update')
  book(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspectionService.book(id, user);
  }

  /**
   * Done: PENDING/BOOKED → DONE.
   * Marks inspection successful; cargo becomes loading-eligible.
   */
  @Post(':id/done')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:approve')
  done(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspectionService.done(id, user);
  }

  /**
   * Fail: PENDING/BOOKED → FAILED.
   * Requires a rejection reason; cargo is not loading-eligible.
   */
  @Post(':id/fail')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:reject')
  fail(
    @Param('id') id: string,
    @Body() dto: RejectInspectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inspectionService.fail(id, dto, user);
  }

  /**
   * Needs Re-inspection: FAILED → NEEDS_REINSPECTION.
   * Re-opens the cargo for a new inspection cycle (cargo inspectionStatus → PENDING).
   */
  @Post(':id/needs-re-inspection')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('inspection:update')
  needsReInspection(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.inspectionService.needsReInspection(id, user);
  }
}
