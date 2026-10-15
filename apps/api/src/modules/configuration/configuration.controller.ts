import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { FieldConfigService } from './field-config.service';
import { WorkflowConfigService } from './workflow-config.service';
import { DocumentConfigService } from './document-config.service';
import { ConfigDocumentOutputService } from './config-document-output.service';
import { CoreLabelService } from './core-label.service';

@ApiTags('configuration')
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly fields: FieldConfigService, private readonly flows: WorkflowConfigService,
    private readonly documents: DocumentConfigService, private readonly output: ConfigDocumentOutputService,
    private readonly coreLabels: CoreLabelService) {}

  @Get('option-lists')
  @RequirePermissions('configuration:read')
  optionLists(@CurrentUser() actor: AuthenticatedUser) { return this.fields.lists(actor); }

  @Post('option-lists')
  @RequirePermissions('configuration:manage')
  createList(@Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.createList(body, actor);
  }
  @Patch('option-lists/:id')
  @RequirePermissions('configuration:manage')
  updateList(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.updateList(id, body, actor);
  }
  @Post('option-lists/:id/options')
  @RequirePermissions('configuration:manage')
  addOption(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.addOption(id, body, actor);
  }
  @Patch('options/:id')
  @RequirePermissions('configuration:manage')
  updateOption(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.updateOption(id, body, actor);
  }

  @Get('field-definitions/:scope')
  @RequirePermissions('configuration:read')
  definitions(@Param('scope') scope: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.fields(scope, actor);
  }
  @Post('field-definitions')
  @RequirePermissions('configuration:manage')
  createField(@Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.createField(body, actor);
  }
  @Patch('field-definitions/:id')
  @RequirePermissions('configuration:manage')
  updateField(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.updateField(id, body, actor);
  }
  @Get('field-definitions/:id/history')
  @RequirePermissions('configuration:manage')
  fieldHistory(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.history(id, actor);
  }
  @Get('records/ReleaseOrder/create-fields')
  @RequirePermissions('release:create')
  releaseCreateFields(@CurrentUser() actor: AuthenticatedUser) {
    return this.fields.releaseCreateFields(actor);
  }
  @Get('records/:scope/search/:key')
  // The service intersects source-read, live/saved field visibility and report
  // or export grants. Operators need not administer configuration to query it.
  searchFields(@Param('scope') scope: string, @Param('key') key: string,
    @Query('term') term: string | undefined, @Query('mode') mode: string,
    @Query('page') page: string | undefined, @CurrentUser() actor: AuthenticatedUser) {
    if (!['searchable', 'filterable', 'reportable', 'exportable'].includes(mode)) {
      throw new BadRequestException('Invalid field query mode');
    }
    return this.fields.search(scope, key, term, actor,
      mode as 'searchable' | 'filterable' | 'reportable' | 'exportable', page);
  }
  @Get('records/:scope/:recordId/fields')
  // Record-scoped projection: the service checks the base record read grant,
  // existence and each saved field's current AND issue-time visibility.
  values(@Param('scope') scope: string, @Param('recordId') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.values(scope, id, actor);
  }
  @Patch('records/:scope/:recordId/fields')
  @RequirePermissions('configuration:value_write')
  write(@Param('scope') scope: string, @Param('recordId') id: string,
    @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.writeValues(scope, id, body, actor);
  }
  @Get('records/:scope/:recordId/fields/:key/history')
  @RequirePermissions('configuration:read')
  valueHistory(@Param('scope') scope: string, @Param('recordId') id: string,
    @Param('key') key: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.fields.valueHistory(scope, id, key, actor);
  }

  @Get('core/bill-labels')
  @RequirePermissions('bill:read')
  billLabels(@CurrentUser() actor: AuthenticatedUser) { return this.coreLabels.billLabels(actor); }
  @Patch('core/bill-labels/:code')
  @RequirePermissions('workflow:manage')
  setBillLabel(@Param('code') code: string, @Body() body: unknown,
    @CurrentUser() actor: AuthenticatedUser) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      !('label' in body)) throw new BadRequestException('A display label is required');
    return this.coreLabels.setBillLabel(code, (body as { label: unknown }).label, actor);
  }

  @Get('workflows')
  @RequirePermissions('configuration:read')
  workflows(@CurrentUser() actor: AuthenticatedUser) { return this.flows.list(actor); }
  @Post('workflows/:scope')
  @RequirePermissions('workflow:manage')
  createWorkflow(@Param('scope') scope: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.create(scope, body, actor);
  }
  @Post('workflows/:scope/versions')
  @RequirePermissions('workflow:manage')
  versionWorkflow(@Param('scope') scope: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.addVersion(scope, body, actor);
  }
  @Post('workflows/:scope/activate')
  @RequirePermissions('workflow:manage')
  activateWorkflow(@Param('scope') scope: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.activate(scope, body, actor);
  }
  @Get('approvals/pending/:scope')
  @RequirePermissions('workflow:approve')
  pending(@Param('scope') scope: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.pending(scope, actor);
  }
  @Get('approvals/for/:scope/:recordId')
  @RequirePermissions('workflow:read')
  approvals(@Param('scope') scope: string, @Param('recordId') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.approvals(scope, id, actor);
  }
  @Post('approvals/:id/decide')
  @RequirePermissions('workflow:approve')
  decide(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      typeof (body as Record<string, unknown>).approve !== 'boolean') throw new BadRequestException('approve must be boolean');
    const data = body as { approve: boolean; note?: string };
    return this.flows.decide(id, data.approve, actor, data.note);
  }
  @Get('release-exceptions/policy')
  @RequirePermissions('release:read')
  releasePolicy(@CurrentUser() actor: AuthenticatedUser) { return this.flows.releasePolicy(actor); }
  @Post('release-exceptions')
  @RequirePermissions('release:override')
  releaseRequest(@Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.flows.requestRelease(body, actor);
  }

  @Get('document-types')
  @RequirePermissions('configuration:read')
  documentTypes(@CurrentUser() actor: AuthenticatedUser) { return this.documents.types(actor); }
  @Post('document-types/:code')
  @RequirePermissions('configuration:manage')
  createType(@Param('code') code: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.createType(code, body, actor);
  }
  @Post('document-types/:code/versions')
  @RequirePermissions('configuration:manage')
  typeVersion(@Param('code') code: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.addVersion(code, body, actor);
  }
  @Post('document-types/:code/activate')
  @RequirePermissions('configuration:manage')
  activateType(@Param('code') code: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.activateType(code, body, actor);
  }
  @Get('documents/catalog')
  @RequirePermissions('config_document:read')
  docCatalogue(@CurrentUser() actor: AuthenticatedUser) { return this.documents.catalogue(actor); }
  @Get('documents/by-type/:code/policy')
  @RequirePermissions('config_document:read')
  docPolicy(@Param('code') code: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.formPolicy(code, actor);
  }
  @Get('documents/by-type/:code/fields')
  @RequirePermissions('config_document:read')
  docFields(@Param('code') code: string, @Query('recordId') recordId: string | undefined,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.formFields(code, actor, recordId);
  }
  @Get('documents/by-type/:code')
  @RequirePermissions('config_document:read')
  listDocs(@Param('code') code: string, @Query('search') search: string | undefined,
    @CurrentUser() actor: AuthenticatedUser) { return this.documents.listRecords(code, actor, search); }
  @Post('documents/by-type/:code')
  @RequirePermissions('config_document:create')
  createDoc(@Param('code') code: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.createRecord(code, body, actor);
  }
  @Get('documents/archive/:id')
  @RequirePermissions('config_document:render')
  async archive(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response) { return send(res, await this.output.archived(id, actor)); }
  @Get('documents/:id')
  @RequirePermissions('config_document:read')
  doc(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.detail(id, actor);
  }
  @Patch('documents/:id')
  @RequirePermissions('config_document:update')
  updateDoc(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.updateRecord(id, body, actor);
  }
  @Post('documents/:id/transition')
  @RequirePermissions('config_document:transition')
  transition(@Param('id') id: string, @Body() body: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.transition(id, body, actor);
  }
  @Get('documents/:id/approvals')
  @RequirePermissions('config_document:read')
  documentApprovals(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.approvals(id, actor);
  }
  @Get('documents/:id/available-transitions')
  @RequirePermissions('config_document:read')
  transitions(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.availableTransitions(id, actor);
  }
  @Get('documents/:id/events')
  @RequirePermissions('config_document:read')
  events(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documents.events(id, actor);
  }
  @Get('documents/:id/history')
  @RequirePermissions('config_document:render')
  history(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.output.history(id, actor);
  }
  @Get('documents/:id/output/:format')
  @RequirePermissions('config_document:render')
  async render(@Param('id') id: string, @Param('format') format: string,
    @CurrentUser() actor: AuthenticatedUser, @Res() res: Response) {
    return send(res, await this.output.render(id, format, actor));
  }
}

function send(res: Response, file: { bytes: Buffer; mimeType: string; filename: string; inline: boolean }) {
  res.set({ 'Content-Type': file.mimeType,
    'Content-Disposition': `${file.inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
    'Content-Length': String(file.bytes.length), 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff' });
  return res.status(200).send(file.bytes);
}
