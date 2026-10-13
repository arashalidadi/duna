import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/company-settings.dto';

@ApiTags('company-settings')
@Controller('company-settings')
export class CompanySettingsController {
  constructor(private readonly service: CompanySettingsService) {}

  @Get()
  @RequirePermissions('settings:read')
  get() {
    return this.service.get();
  }

  @Patch()
  @RequirePermissions('settings:update')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanySettingsDto,
    @Req() req: Request
  ) {
    return this.service.update(user, dto, {
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    });
  }
}
