import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Public } from '../../auth/decorators/public.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../auth/types';
import { DEFAULT_MAX_ATTACHMENT_BYTES } from './attachment-policy';
import { AttachmentService } from './attachment.service';
import type { UploadedDocument } from './attachment.types';
import { DownloadQueryDto, ListAttachmentsDto, UploadAttachmentDto } from './dto/attachment.dto';

/** ASCII fallback plus RFC 5987 value, so non-Latin-1 display names cannot break the header. */
function contentDisposition(filename: string): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Attachment API (Phase 4). Identity documents only (DEC-092). Every route requires a base
 * attachment permission; the service adds the identity-document check. Files are never served
 * from a public path: a download needs a short-lived signed token issued to an authorised user.
 */
@ApiTags('attachments')
@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachments: AttachmentService) {}

  @Post()
  @RequirePermissions('attachment:create')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DEFAULT_MAX_ATTACHMENT_BYTES, files: 1, fields: 10 },
    })
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: UploadedDocument | undefined,
    @Req() req: Request
  ) {
    return this.attachments.upload({
      user,
      entityType: dto.entityType,
      entityId: dto.entityId,
      category: dto.category,
      file,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }

  @Get()
  @RequirePermissions('attachment:read')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListAttachmentsDto) {
    return this.attachments.list(user, query);
  }

  /** Public route by design: the signed token is the credential (see AttachmentService). */
  @Public()
  @Get('download')
  async download(@Query() query: DownloadQueryDto, @Req() req: Request, @Res() res: Response) {
    const file = await this.attachments.downloadWithToken(query.token, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
    res.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': contentDisposition(file.filename),
      'Content-Length': String(file.buffer.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.status(HttpStatus.OK).send(file.buffer);
  }

  @Get(':id')
  @RequirePermissions('attachment:read')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.attachments.getById(user, id);
  }

  @Post(':id/url')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('attachment:read')
  issueUrl(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.attachments.issueDownloadToken(user, id, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }

  @Delete(':id')
  @RequirePermissions('attachment:delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Req() req: Request) {
    return this.attachments.softDelete(user, id, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }
}
