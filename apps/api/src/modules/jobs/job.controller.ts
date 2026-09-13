import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { JobService } from './job.service';
import {
  CancelJobDto,
  CreateJobDto,
  JobItemInputDto,
  ListJobQueryDto,
  UpdateJobDto,
  UpdateJobItemDto,
} from './dto/job.dto';

@ApiTags('jobs')
@Controller('jobs')
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Get()
  @RequirePermissions('job:read')
  list(@Query() q: ListJobQueryDto) {
    return this.jobs.list(q);
  }

  @Post()
  @RequirePermissions('job:create')
  create(@Body() dto: CreateJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions('job:read')
  detail(@Param('id') id: string) {
    return this.jobs.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('job:update')
  update(@Param('id') id: string, @Body() dto: UpdateJobDto) {
    return this.jobs.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('job:delete')
  remove(@Param('id') id: string) {
    return this.jobs.remove(id);
  }

  // ─── items ─────────────────────────────────────────────────────────────────

  @Post(':id/items')
  @HttpCode(200)
  @RequirePermissions('job:update')
  @ApiOperation({ summary: 'Add a COST/INCOME line; returns the refreshed job' })
  addItem(@Param('id') id: string, @Body() dto: JobItemInputDto) {
    return this.jobs.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('job:update')
  @ApiOperation({ summary: 'Update a line; returns the refreshed job' })
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateJobItemDto) {
    return this.jobs.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('job:update')
  @ApiOperation({ summary: 'Remove a line; returns the refreshed job' })
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.jobs.removeItem(id, itemId);
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  @Post(':id/start')
  @HttpCode(200)
  @RequirePermissions('job:start')
  @ApiOperation({ summary: 'Open the job (DRAFT -> OPEN)' })
  start(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.start(id, user);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions('job:complete')
  @ApiOperation({ summary: 'Complete the job (OPEN -> COMPLETED, freezes items)' })
  complete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.complete(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('job:cancel')
  @ApiOperation({ summary: 'Cancel the job (DRAFT|OPEN -> CANCELLED, reason required)' })
  cancel(@Param('id') id: string, @Body() dto: CancelJobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.jobs.cancel(id, dto, user);
  }
}
