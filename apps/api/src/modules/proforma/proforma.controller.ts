import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { ProformaService } from './proforma.service';
import {
  AddProformaItemDto,
  CancelProformaDto,
  CreateProformaDto,
  ListProformaQueryDto,
  UpdateProformaDto,
  UpdateProformaItemDto,
} from './dto/proforma.dto';

@ApiTags('proformas')
@Controller('proformas')
export class ProformaController {
  constructor(private readonly service: ProformaService) {}

  @Get()
  @RequirePermissions('proforma:read')
  list(@Query() query: ListProformaQueryDto) {
    return this.service.list(query);
  }

  @Post()
  @RequirePermissions('proforma:create')
  create(@Body() dto: CreateProformaDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.create(dto, actor);
  }

  @Get(':id')
  @RequirePermissions('proforma:read')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('proforma:update')
  update(@Param('id') id: string, @Body() dto: UpdateProformaDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('proforma:delete')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── line items ──────────────────────────────────────────────────────────

  @Post(':id/items')
  @RequirePermissions('proforma:update')
  @HttpCode(HttpStatus.OK)
  addItem(@Param('id') id: string, @Body() dto: AddProformaItemDto) {
    return this.service.addItem(id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermissions('proforma:update')
  updateItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProformaItemDto,
  ) {
    return this.service.updateItem(id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermissions('proforma:update')
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  // ── lifecycle ───────────────────────────────────────────────────────────

  @Post(':id/issue')
  @RequirePermissions('proforma:issue')
  @HttpCode(HttpStatus.OK)
  issue(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.issue(id, actor);
  }

  @Post(':id/cancel')
  @RequirePermissions('proforma:cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelProformaDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.cancel(id, dto, actor);
  }

  /** One-time conversion into a real DRAFT invoice (ADR-034). */
  @Post(':id/convert')
  @RequirePermissions('proforma:convert')
  @HttpCode(HttpStatus.OK)
  convert(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.convert(id, actor);
  }
}
