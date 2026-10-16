import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationRulesService } from './notification-rules.service';
import { NotificationWorkerService } from './notification-worker.service';
import { NotificationEmailService } from './notification-email.service';

// Job transitions enqueue into the same business transaction, so only the
// worker policy is exported. Notification administration stays in this module.
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationRulesService, NotificationWorkerService, NotificationEmailService],
  exports: [NotificationWorkerService],
})
export class NotificationsModule {}
