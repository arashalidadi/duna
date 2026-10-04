import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { BillService } from './bill.service';
import {
  AddBillItemDto,
  CancelBillDto,
  CreateBillDto,
  CreateRevisionDto,
  ListBillQueryDto,
  UpdateBillDto,
  UpdateBillItemDto,
} from './dto/bill.dto';

@ApiTags('bills')
@Controller('bills')
export class BillController {
  constructor(private readonly service: BillService) {}

  // -------------------------------------------------------------------------
  // Bills of Lading (Phase 10)
  // -------------------------------------------------------------------------

  @Get()
  @RequirePermissions('bill:read')
  list(@Query() query: ListBillQueryDto) {
    return this.service.list(query);
  }

  @Get('eligible-items')
  @RequirePermissions('bill:read')
  eligibleItems(@Query('manifestId') manifestId?: string, @Query('voyageId') voyageId?: string) {
    // Two modes (transition contract A): ?manifestId= legacy transitional (shipped page),
    // ?voyageId= target (ADR-045 decision 1). Primitive @Query params bypass the DTO
    // whitelist, so adding voyageId is not a forbidNonWhitelisted concern.
    return this.service.eligibleItems(manifestId, voyageId);
  }

  @Get(':id')
  @RequirePermissions('bill:read')
  get(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions('bill:create')
  create(@Body() dto: CreateBillDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user);
  }

  @Patch(':id')
  @RequirePermissions('bill:update')
  update(@Param('id') id: string, @Body() dto: UpdateBillDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('bill:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // -------------------------------------------------------------------------
  // B/L Items
  // -------------------------------------------------------------------------

  @Post(':id/items')
  @RequirePermissions('bill:update')
  addItem(@Param('id') id: string, @Body() dto: AddBillItemDto) {
    return this.service.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('bill:update')
  updateItem(@Param('id') id: string, @Param('itemId') itemId: string, @Body() dto: UpdateBillItemDto) {
    return this.service.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('bill:update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  // -------------------------------------------------------------------------
  // P4-U5 revisions (ADR-045 decision 4)
  // -------------------------------------------------------------------------
  // List-only history + DRAFT-only freeze/restore. bill:update for writes (the
  // draft-editing loop), bill:read for history — no new permission codes. There is
  // deliberately no PUT/DELETE on revisions (decision 4 excludes revision editing
  // and deletion): those paths 404 by construction.

  @Post(':id/revisions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('bill:update')
  createRevision(
    @Param('id') id: string,
    @Body() dto: CreateRevisionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.createRevision(id, dto, user);
  }

  @Get(':id/revisions')
  @RequirePermissions('bill:read')
  listRevisions(@Param('id') id: string) {
    return this.service.listRevisions(id);
  }

  @Post(':id/revisions/:n/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('bill:update')
  restoreRevision(
    @Param('id') id: string,
    @Param('n') n: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.restoreRevision(id, n, user);
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * P4-U4 lifecycle edges (ADR-045 d2 + ADR-046 ruling 1). Same bill:issue
   * operational permission as /issue — no new permission codes in this unit.
   * No /release route exists: APPROVED -> RELEASED stays inert until U6
   * adds bill:release + the AuditLog entry.
   */
  @Post(':id/finalize')
  @HttpCode(200)
  @RequirePermissions('bill:issue')
  finalize(@Param('id') id: string) {
    return this.service.finalize(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermissions('bill:issue')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approve(id, user);
  }

  @Post(':id/issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('bill:issue')
  issue(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.issue(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('bill:cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBillDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.cancel(id, dto, user);
  }
}
