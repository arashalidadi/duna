import { BadRequestException, Body, Controller, DefaultValuePipe, Get, Param,
  ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { DocumentTemplateService } from './document-template.service';
import { CreateTemplateDto, CreateTemplateVersionDto } from './document-template.types';

/** Clients may submit validated JSON layouts, never arbitrary storage keys/actor IDs. */
@ApiTags('document templates')
@Controller('infrastructure/templates')
@RequirePermissions('document:manage')
export class DocumentTemplateController {
  constructor(private readonly service: DocumentTemplateService) {}

  // Existing callers continue receiving { items, total }; the new management
  // screen uses /catalogue to load a simple bounded array instead.
  @Get()
  list(@Query('documentType') documentType?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number) {
    return this.service.listPage({ documentType,
      activeOnly: activeOnly !== undefined ? activeOnly !== '0' : undefined,
      limit, offset });
  }

  @Get('catalogue')
  catalogue(@Query('documentType') type?: string) { return this.service.list(type); }

  // Read-path aliases for the pre-Phase-8 registry. The old unverified
  // storageKey upload is deliberately NOT accepted; all writes use JSON layouts.
  @Get('id/:id')
  getById(@Param('id') id: string) { return this.service.get(id); }

  @Get('name/:name')
  getByName(@Param('name') name: string) { return this.service.getByName(name); }

  @Get('version/:id/:version')
  legacyVersion(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    return this.service.getVersion(id, version);
  }

  @Get('active/:id')
  activeVersion(@Param('id') id: string) { return this.service.getActiveVersion(id); }

  @Get('version/:id/:version/content')
  async legacyContent(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    const record = await this.service.getVersion(id, version);
    // Fail closed for legacy versions without a verified Phase-8 layout hash.
    const layout = await this.service.readLayout(record.id);
    return { content: Buffer.from(JSON.stringify(layout)).toString('base64') };
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.service.get(id); }

  @Post()
  create(@Body() dto: CreateTemplateDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.create(dto, actor);
  }

  @Post('version')
  legacyAddVersion(@Body() dto: CreateTemplateVersionDto, @CurrentUser() actor: AuthenticatedUser) {
    if (!dto.templateId) throw new BadRequestException('A template ID is required');
    return this.service.addVersion(dto.templateId, dto, actor);
  }

  @Post('active/:id/:version')
  @RequirePermissions(['document:manage', 'document:approve'])
  legacyAssign(@Param('id') id: string, @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.service.assign(id, version, actor);
  }

  @Post(':id/versions')
  addVersion(@Param('id') id: string, @Body() dto: CreateTemplateVersionDto,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.service.addVersion(id, dto, actor);
  }

  @Get(':id/versions/:version')
  getVersion(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    return this.service.getVersion(id, version);
  }

  @Get(':id/versions/:version/layout')
  async layout(@Param('id') id: string, @Param('version', ParseIntPipe) version: number) {
    const record = await this.service.getVersion(id, version);
    return this.service.readLayout(record.id);
  }

  @Post(':id/versions/:version/assign')
  @RequirePermissions(['document:manage', 'document:approve'])
  assign(@Param('id') id: string, @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.service.assign(id, version, actor);
  }

  @Post(':id/deactivate')
  @RequirePermissions(['document:manage', 'document:approve'])
  deactivate(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.deactivate(id, actor).then(() => ({ deactivated: true }));
  }
}
