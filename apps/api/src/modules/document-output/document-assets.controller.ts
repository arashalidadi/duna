import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { ASSET_KINDS, DocumentAssetsService, MAX_ASSET_BYTES,
  type AssetKind, type UploadedAsset } from './document-assets.service';

class AssetUploadDto {
  @IsIn(ASSET_KINDS)
  kind!: AssetKind;
  @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;
}

/** Artwork is server-private; no storage paths or public image URLs. */
@ApiTags('document assets')
@Controller('documents/assets')
@RequirePermissions('document:manage')
export class DocumentAssetsController {
  constructor(private readonly assets: DocumentAssetsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.assets.list(user); }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_ASSET_BYTES, files: 1, fields: 5 } }))
  upload(@Body() dto: AssetUploadDto, @UploadedFile() file: UploadedAsset | undefined,
    @CurrentUser() user: AuthenticatedUser) {
    return this.assets.upload(user, dto.kind, dto.name, file);
  }

  @Post(':id/approve')
  @RequirePermissions(['document:manage', 'document:approve'])
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.approve(id, user);
  }

  @Post(':id/retire')
  @RequirePermissions(['document:manage', 'document:approve'])
  retire(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.assets.retire(id, user);
  }
}
