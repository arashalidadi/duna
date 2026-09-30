import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { AttachmentService } from './attachment.service';

/**
 * Read/delete surface for stored attachments. Upload happens through the
 * domain modules that own the entity (multipart handling lives there).
 */
@Controller('api/v1/attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @Get()
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ) {
    return this.attachmentService.list({ entityType, entityId, category, limit, offset });
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentService.getById(id);
  }

  @Get(':id/content')
  async getContent(@Param('id', ParseUUIDPipe) id: string) {
    const stream = await this.attachmentService.getFileStream(id);
    return {
      filename: stream.filename,
      mimeType: stream.mimeType,
      buffer: stream.buffer.toString('base64'),
    };
  }

  @Delete(':id')
  softDelete(@Param('id', ParseUUIDPipe) id: string) {
    return this.attachmentService.softDelete(id);
  }
}
