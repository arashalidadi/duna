import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { DocumentTemplateService } from './document-template.service';
import type {
  CreateTemplateDto,
  CreateTemplateVersionDto,
} from './document-template.types';

/**
 * Versioned document-template registry (ADR-009). Templates are immutable
 * containers; content changes create a new version, and one version per
 * template is active at a time.
 */
@Controller('infrastructure/templates')
export class DocumentTemplateController {
  constructor(private readonly service: DocumentTemplateService) {}

  @Get()
  list(
    @Query('documentType') documentType?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number
  ) {
    return this.service.listTemplates({
      documentType: documentType ?? undefined,
      activeOnly: activeOnly !== undefined ? activeOnly !== '0' : undefined,
      limit,
      offset,
    });
  }

  @Get('id/:id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getTemplate(id);
  }

  @Get('name/:name')
  getByName(@Param('name') name: string) {
    return this.service.getTemplateByName(name);
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(dto);
  }

  @Get('version/:templateId/:version')
  getVersion(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('version', ParseIntPipe) version: number
  ) {
    return this.service.getVersion(templateId, version);
  }

  @Get('active/:templateId')
  getActiveVersion(@Param('templateId', ParseUUIDPipe) templateId: string) {
    return this.service.getActiveVersion(templateId);
  }

  @Post('version')
  createVersion(@Body() dto: CreateTemplateVersionDto) {
    return this.service.createVersion(dto.templateId, dto);
  }

  @Post('active/:templateId/:version')
  setActiveVersion(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('version', ParseIntPipe) version: number
  ) {
    return this.service.setActiveVersion(templateId, version);
  }

  @Get('version/:templateId/:version/content')
  async readVersionContent(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Param('version', ParseIntPipe) version: number
  ) {
    const buffer = await this.service.readTemplateVersionContent(templateId, version);
    return { content: buffer.toString('base64') };
  }
}
