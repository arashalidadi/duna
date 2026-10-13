import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import { AuthenticatedUser } from '../../common/auth/types';
import { ListPortalDocumentsQueryDto } from './dto/portal-read.dto';
import { PortalDocumentsService } from './portal-documents.service';

/** Read-only agent document views. Office document endpoints retain their separate permissions. */
@ApiTags('portal')
@Controller('portal')
@RequirePermissions('portal:access')
export class PortalDocumentsController {
  constructor(private readonly documents: PortalDocumentsService) {}

  @Get('bills-of-lading')
  billsOfLading(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPortalDocumentsQueryDto) {
    return this.documents.billsOfLading(user.id, query);
  }

  @Get('release-orders')
  releaseOrders(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPortalDocumentsQueryDto) {
    return this.documents.releaseOrders(user.id, query);
  }

  @Get('manifests')
  manifests(@CurrentUser() user: AuthenticatedUser, @Query() query: ListPortalDocumentsQueryDto) {
    return this.documents.manifests(user.id, query);
  }

  @Get('bl-labels')
  blLabels(@CurrentUser() user: AuthenticatedUser) {
    return this.documents.blLabels(user.id);
  }
}
