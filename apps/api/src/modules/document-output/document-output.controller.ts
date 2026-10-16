import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DocumentOutputService, type RenderedFile } from './document-output.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';

function send(res: Response, file: RenderedFile) {
  res.set({
    'Content-Type': file.mimeType,
    'Content-Disposition': `${file.inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
    'Content-Length': String(file.bytes.length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return res.status(200).send(file.bytes);
}

/** Protected office output; portal-linked principals are denied even with mistaken grants. */
@ApiTags('document output')
@Controller('documents/output')
@RequirePermissions('document:render')
export class DocumentOutputController {
  constructor(private readonly output: DocumentOutputService, private readonly audit: AuditService) {}

  @Get('catalogue')
  catalogue(@CurrentUser() actor: AuthenticatedUser) { return this.output.catalogue(actor); }

  @Get('archive/:archiveId')
  async archived(@Param('archiveId') id: string, @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response) {
    const file = await this.output.archived(actor, id);
    await this.audit.record({ action: 'document.output.access', entityType: 'DocumentRenderedOutput',
      entityId: id, actorId: actor.id, actorEmail: actor.email,
      metadata: { archived: true, filename: file.filename } });
    return send(res, file);
  }

  @Get(':type/:id/history')
  history(@Param('type') type: string, @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser) {
    return this.output.history(actor, type, id);
  }

  @Get(':type/:id/:format')
  async render(@Param('type') type: string, @Param('id') id: string,
    @Param('format') format: string, @Query('previewVersionId') previewVersionId: string | undefined,
    @Query('fromDate') fromDate: string | undefined, @Query('toDate') toDate: string | undefined,
    @Query('currencyCode') currencyCode: string | undefined,
    @CurrentUser() actor: AuthenticatedUser, @Res() res: Response) {
    const file = await this.output.output(actor, type, id, format,
      { previewVersionId, fromDate, toDate, currencyCode });
    await this.audit.record({ action: 'document.output.access', entityType: 'Document',
      entityId: id, actorId: actor.id, actorEmail: actor.email,
      metadata: { documentType: type, format, previewVersionId: previewVersionId ?? null } });
    return send(res, file);
  }
}
