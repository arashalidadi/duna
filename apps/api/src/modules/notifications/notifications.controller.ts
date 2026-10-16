import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/auth/decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../common/auth/types';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationWorkerService } from './notification-worker.service';
import { NotificationEmailService } from './notification-email.service';
import { requireOffice } from './notification.policy';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly rules: NotificationRulesService,
    private readonly worker: NotificationWorkerService, private readonly email: NotificationEmailService) {}

  @Get()
  @RequirePermissions('notification:read')
  inbox(@CurrentUser() actor: AuthenticatedUser) { return this.rules.inbox(actor); }

  @Patch(':id/read')
  @RequirePermissions('notification:read')
  read(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.mark(id, false, actor);
  }
  @Patch(':id/dismiss')
  @RequirePermissions('notification:read')
  dismiss(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.mark(id, true, actor);
  }

  @Get('rules')
  @RequirePermissions('notification:manage')
  listRules(@CurrentUser() actor: AuthenticatedUser) { return this.rules.list(actor); }
  @Get('rules/recipients')
  @RequirePermissions(['notification:manage', 'user:read', 'role:read'])
  recipients(@CurrentUser() actor: AuthenticatedUser) { return this.rules.recipients(actor); }
  @Get('rules/:id')
  @RequirePermissions('notification:manage')
  detail(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) { return this.rules.detail(id, actor); }
  @Get('rules/:id/deliveries')
  @RequirePermissions('notification:manage')
  deliveries(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser,
    @Query('page') page?: string) { return this.rules.deliveries(id, actor, page === undefined ? 1 : Number(page)); }
  @Post('rules')
  @RequirePermissions('notification:manage')
  create(@Body() input: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.create(input, actor);
  }
  @Patch('rules/:id')
  @RequirePermissions('notification:manage')
  update(@Param('id') id: string, @Body() input: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.update(id, input, actor);
  }
  @Patch('rules/:id/active')
  @RequirePermissions('notification:manage')
  active(@Param('id') id: string, @Body() input: unknown, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.setActive(id, input, actor);
  }
  @Post('deliveries/:id/retry')
  @RequirePermissions('notification:manage')
  retry(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.rules.retryDelivery(id, actor);
  }
  @Post('tick')
  @RequirePermissions('notification:manage')
  tick(@CurrentUser() actor: AuthenticatedUser) {
    // PermissionGuard alone cannot exclude portal-linked users accidentally
    // assigned a staff permission.
    requireOffice(actor, 'notification:manage');
    return this.worker.tick();
  }
  @Get('health')
  @RequirePermissions('notification:manage')
  health(@CurrentUser() actor: AuthenticatedUser) {
    requireOffice(actor, 'notification:manage');
    return { emailConfigured: this.email.configured() };
  }
}
