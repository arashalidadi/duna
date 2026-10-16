import { BadRequestException } from '@nestjs/common';
import { NotificationTrigger, type Prisma } from '@prisma/client';
import { object, limitJson, requireOffice } from '../configuration/configuration.policy';
import type { AuthenticatedUser } from '../../common/auth/types';

/** Rules are a bounded declarative vocabulary, never arbitrary predicates/SQL/templates. */
export type Recipients = { userIds: string[]; roleIds: string[] };
export type Conditions = {
  minUnpaidPercent?: number;
  toStatuses?: Array<'DRAFT' | 'OPEN' | 'COMPLETED' | 'CANCELLED'>;
  approvalScopes?: string[];
};
export type Channel = 'IN_APP' | 'EMAIL';
export type RuleInput = {
  name: string;
  trigger: NotificationTrigger;
  conditions: Conditions;
  recipients: Recipients;
  escalationRecipients: Recipients;
  channels: Channel[];
  delayMinutes: number;
  repeatMinutes: number | null;
  maxPerRecord: number;
  maxPerDay: number | null;
  escalateAfterMinutes: number | null;
};

const triggers = new Set<string>(Object.values(NotificationTrigger));
const channels = new Set(['IN_APP', 'EMAIL']);
const jobStatuses = new Set(['DRAFT', 'OPEN', 'COMPLETED', 'CANCELLED']);
const emptyRecipients = (): Recipients => ({ userIds: [], roleIds: [] });

function keys(o: Record<string, unknown>, allowed: string[], name: string): void {
  for (const key of Object.keys(o)) {
    if (!allowed.includes(key)) throw new BadRequestException(`${name}: unknown field ${key}`);
  }
}
function boundedString(v: unknown, name: string, max: number): string {
  if (typeof v !== 'string' || !v.trim() || v.length > max) throw new BadRequestException(`Invalid ${name}`);
  return v.trim();
}
function integer(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return v;
}
function ids(v: unknown, name: string): string[] {
  if (!Array.isArray(v) || v.length > 50 || v.some((x) => typeof x !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(x)) || new Set(v).size !== v.length) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return v as string[];
}
export function recipients(value: unknown, allowEmpty = false): Recipients {
  const d = object(value, ['userIds', 'roleIds'], 'notification recipients');
  const result = { userIds: ids(d.userIds ?? [], 'recipient userIds'), roleIds: ids(d.roleIds ?? [], 'recipient roleIds') };
  if (!allowEmpty && !result.userIds.length && !result.roleIds.length) {
    throw new BadRequestException('Choose at least one recipient user or role');
  }
  return result;
}
export function conditions(trigger: NotificationTrigger, value: unknown): Conditions {
  const d = object(value, null, 'notification conditions');
  const allowed = trigger === 'JOB_STATUS_CHANGED' ? ['toStatuses']
    : trigger === 'PENDING_APPROVAL' ? ['approvalScopes']
    : trigger === 'OVERDUE_INVOICE' || trigger === 'UNPAID_RELEASE' ? ['minUnpaidPercent'] : [];
  keys(d, allowed, 'notification conditions');
  const result: Conditions = {};
  if (d.minUnpaidPercent !== undefined) {
    result.minUnpaidPercent = integer(d.minUnpaidPercent, 'minUnpaidPercent', 0, 100);
  }
  if (d.toStatuses !== undefined) {
    const list = ids(d.toStatuses, 'toStatuses');
    if (!list.length || list.some((v) => !jobStatuses.has(v))) throw new BadRequestException('Invalid job status');
    result.toStatuses = list as Conditions['toStatuses'];
  }
  if (d.approvalScopes !== undefined) {
    const list = d.approvalScopes;
    if (!Array.isArray(list) || !list.length || list.length > 50 ||
        new Set(list).size !== list.length || list.some((v) => typeof v !== 'string' ||
          !/^(invoice-correction|release-exception|CUSTOM:[A-Z][A-Z0-9_]{0,39})$/.test(v))) {
      throw new BadRequestException('Invalid approval scope');
    }
    result.approvalScopes = list as string[];
  }
  return result;
}

export function parseRule(input: unknown): RuleInput {
  const d = object(input, ['name', 'trigger', 'conditions', 'recipients', 'escalationRecipients', 'channels',
    'delayMinutes', 'repeatMinutes', 'maxPerRecord', 'maxPerDay', 'escalateAfterMinutes'], 'notification rule');
  limitJson(d, 'notification rule', 10 * 1024);
  if (typeof d.trigger !== 'string' || !triggers.has(d.trigger)) throw new BadRequestException('Unsupported trigger');
  const trigger = d.trigger as NotificationTrigger;
  if (!Array.isArray(d.channels) || !d.channels.length || d.channels.length > 2 ||
      d.channels.some((v) => !channels.has(v)) || new Set(d.channels).size !== d.channels.length) {
    throw new BadRequestException('Choose IN_APP and/or EMAIL without duplicates');
  }
  const escalationRecipients = d.escalationRecipients === undefined
    ? emptyRecipients() : recipients(d.escalationRecipients, true);
  const escalateAfterMinutes = d.escalateAfterMinutes == null ? null
    : integer(d.escalateAfterMinutes, 'escalateAfterMinutes', 1, 525600);
  if ((escalateAfterMinutes === null) !== (!escalationRecipients.roleIds.length && !escalationRecipients.userIds.length)) {
    throw new BadRequestException('Escalation delay and escalation recipients must be configured together');
  }
  const repeatMinutes = d.repeatMinutes == null ? null : integer(d.repeatMinutes, 'repeatMinutes', 1, 525600);
  const maxPerRecord = integer(d.maxPerRecord ?? 1, 'maxPerRecord', 1, 100);
  if (repeatMinutes === null && maxPerRecord !== 1) {
    throw new BadRequestException('repeatMinutes is required for multiple notifications per record');
  }
  return {
    name: boundedString(d.name, 'rule name', 160), trigger,
    conditions: conditions(trigger, d.conditions ?? {}),
    recipients: recipients(d.recipients),
    escalationRecipients,
    channels: d.channels as Channel[],
    delayMinutes: integer(d.delayMinutes ?? 0, 'delayMinutes', 0, 525600),
    repeatMinutes, maxPerRecord,
    maxPerDay: d.maxPerDay == null ? null : integer(d.maxPerDay, 'maxPerDay', 1, 1000),
    escalateAfterMinutes,
  };
}

/** Parse stored JSON again: a DBA edit or stale rule must fail closed, not execute. */
export function storedRule(row: {
  name: string; trigger: NotificationTrigger; conditions: Prisma.JsonValue;
  recipients: Prisma.JsonValue; escalationRecipients: Prisma.JsonValue; channels: Prisma.JsonValue;
  delayMinutes: number; repeatMinutes: number | null; maxPerRecord: number;
  maxPerDay: number | null; escalateAfterMinutes: number | null;
}): RuleInput {
  return parseRule({ name: row.name, trigger: row.trigger, conditions: row.conditions,
    recipients: row.recipients, escalationRecipients: row.escalationRecipients,
    channels: row.channels, delayMinutes: row.delayMinutes, repeatMinutes: row.repeatMinutes,
    maxPerRecord: row.maxPerRecord, maxPerDay: row.maxPerDay,
    escalateAfterMinutes: row.escalateAfterMinutes });
}

export const SOURCE_PERMISSIONS: Record<NotificationTrigger, string> = {
  OVERDUE_INVOICE: 'invoice:read',
  PENDING_APPROVAL: 'workflow:read',
  JOB_STATUS_CHANGED: 'job:read',
  UNPAID_RELEASE: 'release:read',
  CARGO_DOCUMENT_PENDING: 'cargo:read',
};
/** Invoice corrections use the dedicated invoice:read permission instead. */
export function sourcePermission(trigger: NotificationTrigger, eventKey: string): string {
  return trigger === 'PENDING_APPROVAL' && eventKey.startsWith('correction:')
    ? 'invoice:read' : SOURCE_PERMISSIONS[trigger];
}
export function canReadSource(actor: Pick<AuthenticatedUser, 'permissions' | 'isPrimaryAdmin'>,
  trigger: NotificationTrigger, eventKey: string): boolean {
  return actor.isPrimaryAdmin || actor.permissions.includes(sourcePermission(trigger, eventKey));
}
export { requireOffice };
