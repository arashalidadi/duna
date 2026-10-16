export type NotificationTrigger = 'OVERDUE_INVOICE' | 'PENDING_APPROVAL' |
  'JOB_STATUS_CHANGED' | 'UNPAID_RELEASE' | 'CARGO_DOCUMENT_PENDING';
export type NotificationChannel = 'IN_APP' | 'EMAIL';
export interface NotificationRecipients { userIds: string[]; roleIds: string[] }
export interface NotificationConditions {
  minUnpaidPercent?: number;
  toStatuses?: Array<'DRAFT' | 'OPEN' | 'COMPLETED' | 'CANCELLED'>;
  approvalScopes?: string[];
}
export interface NotificationRuleInput {
  name: string;
  trigger: NotificationTrigger;
  conditions: NotificationConditions;
  recipients: NotificationRecipients;
  channels: NotificationChannel[];
  delayMinutes: number;
  repeatMinutes: number | null;
  maxPerRecord: number;
  maxPerDay: number | null;
  escalateAfterMinutes: number | null;
  escalationRecipients: NotificationRecipients;
}
export interface NotificationRule extends NotificationRuleInput {
  id: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { events: number; inbox: number };
}
export interface NotificationInboxItem {
  id: string;
  stage: number;
  cycle: number;
  readAt: string | null;
  createdAt: string;
  rule: { name: string; trigger: NotificationTrigger };
  event: { sourceId: string; eventKey: string };
}
export interface NotificationDelivery {
  id: string;
  channel: NotificationChannel;
  status: 'PENDING' | 'SENDING' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED';
  attempts: number;
  lastErrorCode: string | null;
  deliveredAt: string | null;
  createdAt: string;
  inbox: { userId: string; eventId: string; stage: number; cycle: number };
}
