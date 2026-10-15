import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DOCUMENT_TYPES } from '../document-output/document-layout';

/** Phase 9 config is data, never executable code, SQL, ORM paths or permission grants. */
export const FIELD_SCOPES = {
  Customer: { read: 'customer:read', edit: 'customer:update' },
  Cargo: { read: 'cargo:read', edit: 'cargo:update' },
  Job: { read: 'job:read', edit: 'job:update' },
  BillOfLading: { read: 'bill:read', edit: 'bill:update' },
  Invoice: { read: 'invoice:read', edit: 'invoice:update' },
  ReleaseOrder: { read: 'release:read', edit: 'release:update' },
} as const;
export const LINK_SCOPES = {
  Customer: 'customer:read', Cargo: 'cargo:read', Job: 'job:read',
  BillOfLading: 'bill:read', Voyage: 'voyage:read', Manifest: 'manifest:read',
} as const;
export const CORE_WORKFLOWS = ['release-exception', 'invoice-correction'] as const;
const KEY = /^[a-z][a-z0-9_]{0,39}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,39}$/;
const PERMISSION = /^[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*$/;
const RESERVED = new Set([
  'id', 'status', 'deleted_at', 'created_at', 'updated_at', 'number', 'invoice_number',
  'bill_number', 'doc_number', 'currency', 'amount', 'total_amount', 'paid_amount',
  'financial_override', 'override_reason', 'payment_state', 'approval', 'approved',
  'release', 'tax', 'tax_id', 'trn_number', 'short_name', 'type', 'ledger',
]);

export function object(value: unknown, allowed: readonly string[] | null, name = 'configuration'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    throw new BadRequestException(`${name} must be an object`);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if ((allowed !== null && !allowed.includes(key)) || ['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new BadRequestException(`Unknown ${name} property: ${key}`);
    }
  }
  return record;
}
export function string(value: unknown, name: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
    [...value].some((char) => { const code = char.charCodeAt(0); return code < 9 || code > 13 && code < 32; })) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return value.trim();
}
export function code(value: unknown, name = 'code'): string {
  const result = string(value, name, 40);
  if (!CODE.test(result)) throw new BadRequestException(`Invalid ${name}`);
  return result;
}
export function key(value: unknown): string {
  const result = string(value, 'field key', 40);
  if (!KEY.test(result) || RESERVED.has(result)) throw new BadRequestException('Reserved or invalid field key');
  return result;
}
export function permission(value: unknown): string {
  const result = string(value, 'permission', 80);
  if (!PERMISSION.test(result)) throw new BadRequestException('Invalid permission code');
  return result;
}
export function optionalPermission(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : permission(value);
}
export function requireOffice(actor: AuthenticatedUser, ...permissions: string[]): void {
  // Portal users never become office principals even if assigned an office role by mistake.
  if (!actor?.id || actor.portalAgentId || actor.portalCustomerId) throw new ForbiddenException('Office access required');
  if (actor.isPrimaryAdmin) return;
  if (permissions.some((p) => !actor.permissions?.includes(p))) {
    throw new ForbiddenException('Insufficient permissions');
  }
}
export function limitJson(value: unknown, name: string, max = 16 * 1024): void {
  let size: number;
  try { const encoded = JSON.stringify(value);
    if (typeof encoded !== 'string') throw new Error('Not JSON');
    size = Buffer.byteLength(encoded);
  } catch { throw new BadRequestException(`Invalid ${name}`); }
  if (size > max) throw new BadRequestException(`${name} exceeds ${max} bytes`);
}
function int(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new BadRequestException(`Invalid ${name}`);
  }
  return value;
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException(`Invalid ${name}`);
  return value;
}
function list(value: unknown, name: string, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new BadRequestException(`Invalid ${name}`);
  return value;
}
function unique(items: string[], name: string): string[] {
  if (new Set(items).size !== items.length) throw new BadRequestException(`Duplicate ${name}`);
  return items;
}
export function scope(value: unknown): string {
  if (typeof value !== 'string') throw new BadRequestException('Invalid field scope');
  if (value in FIELD_SCOPES) return value;
  if (/^CUSTOM:[A-Z][A-Z0-9_]{0,39}$/.test(value)) return value;
  throw new BadRequestException('Unsupported field scope');
}
export function isCoreDocument(value: string): boolean { return (DOCUMENT_TYPES as readonly string[]).includes(value); }
const PROTECTED_DOCUMENT_PREFIXES = new Set(['INV', 'BOL', 'BL', 'RO', 'DO', 'SAL', 'PMT', 'RCP',
  'VOU', 'MAN', 'LOAD', 'LED', 'JRN', 'CREDIT', 'DEBIT']);
export function customTypeCode(value: unknown): string {
  const result = code(value, 'custom document code');
  const coreCodes = DOCUMENT_TYPES.map((c) => c.toUpperCase().replaceAll('-', '_'));
  if (coreCodes.includes(result) || PROTECTED_DOCUMENT_PREFIXES.has(result) ||
      /^(INVOICE|BILL|RELEASE|DELIVERY|PAYMENT|RECEIPT|LEDGER|VOUCHER|SALARY|MANIFEST|LOAD_LIST)(_|$)/.test(result)) {
    throw new BadRequestException('Core financial and release document families cannot be recreated as custom documents');
  }
  return result;
}

export type FieldKind = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SINGLE_SELECT' | 'MULTI_SELECT';
export type FieldRules = { min?: number; max?: number; minLength?: number; maxLength?: number; format?: 'EMAIL' | 'CODE' };
export type FieldVisibility = { roles?: string[]; statuses?: string[] };
export type FieldSpec = {
  scope: string; key: string; label: string; kind: FieldKind; required: boolean;
  optionListId: string | null; rules: FieldRules; displayLocation: 'detail' | 'form' | 'list';
  sortOrder: number; visibility: FieldVisibility; viewPermission: string | null;
  editPermission: string | null; searchable: boolean; filterable: boolean;
  reportable: boolean; exportable: boolean; effectiveFrom: Date; effectiveUntil: Date | null;
};
export function fieldSpec(input: unknown): FieldSpec {
  const d = object(input, ['scope', 'key', 'label', 'kind', 'required', 'optionListId', 'rules',
    'displayLocation', 'sortOrder', 'visibility', 'viewPermission', 'editPermission',
    'searchable', 'filterable', 'reportable', 'exportable', 'effectiveFrom', 'effectiveUntil'], 'field');
  limitJson(d, 'field');
  const kind = string(d.kind, 'field kind') as FieldKind;
  if (!['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SINGLE_SELECT', 'MULTI_SELECT'].includes(kind)) {
    throw new BadRequestException('Unsupported field kind');
  }
  const optionListId = d.optionListId == null ? null : string(d.optionListId, 'option list ID', 70);
  if ((kind === 'SINGLE_SELECT' || kind === 'MULTI_SELECT') !== !!optionListId) {
    throw new BadRequestException('Only select fields may reference an option list; selects require one');
  }
  const r = object(d.rules ?? {}, ['min', 'max', 'minLength', 'maxLength', 'format'], 'field rules');
  const rules: FieldRules = {};
  if (r.min !== undefined) {
    if (typeof r.min !== 'number' || !Number.isFinite(r.min)) throw new BadRequestException('Invalid min');
    rules.min = r.min;
  }
  if (r.max !== undefined) {
    if (typeof r.max !== 'number' || !Number.isFinite(r.max)) throw new BadRequestException('Invalid max');
    rules.max = r.max;
  }
  if (rules.min !== undefined && rules.max !== undefined && rules.min > rules.max) throw new BadRequestException('min exceeds max');
  if (r.minLength !== undefined) rules.minLength = int(r.minLength, 'minLength', 0, 10000);
  if (r.maxLength !== undefined) rules.maxLength = int(r.maxLength, 'maxLength', 1, 10000);
  if (rules.minLength !== undefined && rules.maxLength !== undefined && rules.minLength > rules.maxLength) {
    throw new BadRequestException('minLength exceeds maxLength');
  }
  if (r.format !== undefined) {
    if (r.format !== 'EMAIL' && r.format !== 'CODE') throw new BadRequestException('Unsupported format');
    rules.format = r.format;
  }
  if (kind === 'TEXT' && (rules.min !== undefined || rules.max !== undefined) ||
      kind === 'NUMBER' && (rules.minLength !== undefined || rules.maxLength !== undefined || rules.format) ||
      !['TEXT', 'NUMBER'].includes(kind) && Object.keys(rules).length) {
    throw new BadRequestException('Rules do not apply to this field kind');
  }
  const v = object(d.visibility ?? {}, ['roles', 'statuses'], 'visibility');
  const visibility: FieldVisibility = {};
  if (v.roles !== undefined) visibility.roles = unique(list(v.roles, 'visible roles', 30).map((x) => code(x, 'role code')), 'roles');
  if (v.statuses !== undefined) visibility.statuses = unique(list(v.statuses, 'visible statuses', 30).map((x) => code(x, 'status code')), 'statuses');
  const displayLocation = d.displayLocation ?? 'detail';
  if (!['detail', 'form', 'list'].includes(displayLocation as string)) throw new BadRequestException('Invalid display location');
  function date(value: unknown, name: string): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(T.*Z)?$/.test(value) ||
      Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value.slice(0, 10)) {
      throw new BadRequestException(`Invalid ${name}`);
    }
    return new Date(value);
  }
  const effectiveFrom = d.effectiveFrom === undefined ? new Date() : date(d.effectiveFrom, 'effectiveFrom');
  const effectiveUntil = d.effectiveUntil == null ? null : date(d.effectiveUntil, 'effectiveUntil');
  if (effectiveUntil && effectiveUntil <= effectiveFrom) throw new BadRequestException('End date must follow start date');
  return {
    scope: scope(d.scope), key: key(d.key), label: string(d.label, 'field label'), kind,
    required: d.required === undefined ? false : bool(d.required, 'required'), optionListId, rules,
    displayLocation: displayLocation as FieldSpec['displayLocation'],
    sortOrder: d.sortOrder === undefined ? 0 : int(d.sortOrder, 'sortOrder', -10000, 10000),
    visibility, viewPermission: optionalPermission(d.viewPermission), editPermission: optionalPermission(d.editPermission),
    searchable: d.searchable === undefined ? false : bool(d.searchable, 'searchable'),
    filterable: d.filterable === undefined ? false : bool(d.filterable, 'filterable'),
    reportable: d.reportable === undefined ? false : bool(d.reportable, 'reportable'),
    exportable: d.exportable === undefined ? false : bool(d.exportable, 'exportable'),
    effectiveFrom, effectiveUntil,
  };
}

export type Condition = { source: 'field' | 'context'; key: string; op: 'EQ' | 'NEQ' | 'PRESENT' | 'IN'; value?: string | number | boolean | string[] };
export type WorkflowTransition = { from: string; to: string; permission: string; conditions: Condition[];
  approval: { permission: string; distinctRequester: boolean } | null;
  exception: { permission: string; reasonRequired: true } | null };
export type WorkflowDefinition = {
  statuses: { code: string; label: string; terminal: boolean; issued: boolean }[];
  transitions: WorkflowTransition[];
};
const CORE_STATUS: Record<(typeof CORE_WORKFLOWS)[number], string[]> = {
  'release-exception': ['REQUESTED', 'APPROVED', 'REJECTED'],
  'invoice-correction': ['PENDING_APPROVAL', 'APPLIED', 'REJECTED'],
};
export function workflowDefinition(input: unknown, workflowScope: string): WorkflowDefinition {
  const root = object(input, ['statuses', 'transitions'], 'workflow');
  limitJson(root, 'workflow');
  const statuses = list(root.statuses, 'statuses', 30).map((raw) => {
    const d = object(raw, ['code', 'label', 'terminal', 'issued'], 'status');
    return { code: code(d.code, 'status code'), label: string(d.label, 'status label'),
      terminal: d.terminal === undefined ? false : bool(d.terminal, 'terminal'),
      issued: d.issued === undefined ? false : bool(d.issued, 'issued') };
  });
  if (!statuses.length) throw new BadRequestException('Workflow requires statuses');
  unique(statuses.map((s) => s.code), 'statuses');
  const transitions: WorkflowTransition[] = list(root.transitions, 'transitions', 100).map((raw) => {
    const d = object(raw, ['from', 'to', 'permission', 'conditions', 'approval', 'exception'], 'transition');
    const from = code(d.from, 'from'), to = code(d.to, 'to');
    if (from === to || !statuses.some((s) => s.code === from) || !statuses.some((s) => s.code === to)) {
      throw new BadRequestException('Transition must join distinct configured statuses');
    }
    const conditions = list(d.conditions ?? [], 'conditions', 12).map((rawCondition): Condition => {
      const c = object(rawCondition, ['source', 'key', 'op', 'value'], 'condition');
      if (c.source !== 'field' && c.source !== 'context') throw new BadRequestException('Invalid condition source');
      const conditionKey = string(c.key, 'condition key', 40);
      if (!KEY.test(conditionKey) || (c.source === 'field' && RESERVED.has(conditionKey))) {
        throw new BadRequestException('Invalid condition key');
      }
      if (!['EQ', 'NEQ', 'PRESENT', 'IN'].includes(c.op as string)) throw new BadRequestException('Invalid condition operation');
      if (c.op !== 'PRESENT' && !(typeof c.value === 'string' || typeof c.value === 'number' && Number.isFinite(c.value) ||
        typeof c.value === 'boolean' || c.op === 'IN' && Array.isArray(c.value) &&
          c.value.length <= 20 && c.value.every((v: unknown) => typeof v === 'string'))) {
        throw new BadRequestException('Invalid condition value');
      }
      if (c.op === 'IN' && !Array.isArray(c.value)) throw new BadRequestException('IN requires a list');
      if (c.source === 'context' && !['outstanding', 'payment_state', 'reason', 'reason_length'].includes(conditionKey)) {
        throw new BadRequestException('Unknown trusted context field');
      }
      return { source: c.source, key: conditionKey, op: c.op as Condition['op'],
        ...(c.op === 'PRESENT' ? {} : { value: c.value as Condition['value'] }) };
    });
    let approval: WorkflowTransition['approval'] = null;
    if (d.approval != null) {
      const a = object(d.approval, ['permission', 'distinctRequester'], 'approval');
      approval = { permission: permission(a.permission), distinctRequester: a.distinctRequester === undefined
        ? true : bool(a.distinctRequester, 'distinctRequester') };
    }
    let exception: WorkflowTransition['exception'] = null;
    if (d.exception != null) {
      const e = object(d.exception, ['permission', 'reasonRequired'], 'exception');
      if (e.reasonRequired !== true) throw new BadRequestException('Exceptions always need a reason');
      exception = { permission: permission(e.permission), reasonRequired: true };
    }
    return { from, to, permission: permission(d.permission), conditions, approval, exception };
  });
  unique(transitions.map((t) => `${t.from}->${t.to}`), 'transitions');
  if (!transitions.length) throw new BadRequestException('Workflow requires transitions');
  if (workflowScope in CORE_STATUS) {
    const core = CORE_STATUS[workflowScope as keyof typeof CORE_STATUS];
    if (statuses.length !== core.length || core.some((s) => !statuses.some((x) => x.code === s))) {
      throw new BadRequestException('Core workflow statuses cannot be changed');
    }
    if (statuses.some((s) => s.issued)) throw new BadRequestException('Core issuance is never configurable');
    const expected = workflowScope === 'release-exception'
      ? [['REQUESTED', 'APPROVED', 'release:override'], ['REQUESTED', 'REJECTED', 'release:override']]
      : [['PENDING_APPROVAL', 'APPLIED', 'invoice:approve_correction'],
        ['PENDING_APPROVAL', 'REJECTED', 'invoice:approve_correction']];
    if (transitions.length !== expected.length || expected.some(([from, to, permissionCode]) =>
      !transitions.some((t) => t.from === from && t.to === to && t.permission === permissionCode)) ||
      transitions.some((t) => t.exception || t.conditions.some((c) => c.source === 'field') ||
        (t.to === 'APPROVED' || t.to === 'APPLIED') &&
        (!t.approval || t.approval.permission !== t.permission || !t.approval.distinctRequester))) {
      throw new BadRequestException('Core approvals, permissions and transitions cannot be weakened');
    }
  } else if (!/^CUSTOM:[A-Z][A-Z0-9_]{0,39}$/.test(workflowScope)) {
    throw new BadRequestException('Unsupported workflow scope');
  } else {
    // Custom-document callers provide only revision-bound field values. Core
    // payment/reason context keys have no trusted counterpart on these records.
    if (transitions.some((t) => t.conditions.some((c) => c.source === 'context'))) {
      throw new BadRequestException('Custom document conditions must reference configured fields');
    }
    if (!statuses[0] || statuses[0].terminal || statuses[0].issued ||
      statuses.some((s) => s.issued && !s.terminal) ||
      transitions.some((t) => statuses.find((s) => s.code === t.from)?.terminal)) {
      throw new BadRequestException('Initial state and issued/terminal states cannot be bypassed');
    }
    // No direct issuance without a distinct, explicitly approved transition.
    if (transitions.some((t) => statuses.find((s) => s.code === t.to)?.issued && !t.approval)) {
      throw new BadRequestException('Issuance requires an approval step');
    }
  }
  return { statuses, transitions };
}

export function assertTransition(definition: WorkflowDefinition, from: string, to: string,
  actor: AuthenticatedUser, context: Record<string, unknown> = {}, fields: Record<string, unknown> = {}, reason?: string): WorkflowTransition {
  const transition = definition.transitions.find((t) => t.from === from && t.to === to);
  if (!transition) throw new BadRequestException(`Transition ${from} → ${to} is not configured`);
  requireOffice(actor, transition.permission);
  for (const c of transition.conditions) {
    const actual = (c.source === 'context' ? context : fields)[c.key];
    const ok = c.op === 'PRESENT' ? actual !== null && actual !== undefined && actual !== ''
      : c.op === 'EQ' ? actual === c.value : c.op === 'NEQ' ? actual !== c.value
        : Array.isArray(c.value) && c.value.includes(actual as string);
    if (!ok) {
      // Exceptions only waive additional CONFIGURED conditions. They cannot
      // waive a core transition, an approval, a posting or the base permission.
      if (!transition.exception || !reason?.trim()) throw new ForbiddenException(`Workflow condition not met: ${c.key}`);
      requireOffice(actor, transition.exception.permission);
    }
  }
  // A normal explanatory note is not an exception. Require the special grant
  // only if at least one extra configured condition was actually waived.
  return transition;
}

export type DocumentSpec = { name: string; category: string; description: string | null;
  numbering: { prefix: string; padding: number; period: 'NONE' | 'YYYY' | 'YYYYMM' };
  permissions: { read: string | null; create: string | null; update: string | null; transition: string | null; approve: string | null };
  relationships: (keyof typeof LINK_SCOPES)[]; reporting: { searchable: boolean; exportable: boolean };
  layout: { title: string; note: string | null; fields: string[];
    logoAssetId: string | null; letterheadAssetId: string | null;
    stampAssetId: string | null; signatureAssetId: string | null } };
export function documentSpec(input: unknown, isCore = false): DocumentSpec | { name: string; category: string; description: string | null } {
  const d = object(input, isCore ? ['name', 'category', 'description'] :
    ['name', 'category', 'description', 'numbering', 'permissions', 'relationships', 'reporting', 'layout'], 'document type');
  limitJson(d, 'document type');
  const shared = { name: string(d.name, 'document display name'), category: string(d.category, 'category'),
    description: d.description == null || d.description === '' ? null : string(d.description, 'description', 1000) };
  if (isCore) return shared; // P8 templates/numbering and all core guards remain authoritative.
  const n = object(d.numbering, ['prefix', 'padding', 'period'], 'numbering');
  const prefix = string(n.prefix, 'number prefix', 12);
  if (!/^[A-Z][A-Z0-9-]{0,11}$/.test(prefix) || [...PROTECTED_DOCUMENT_PREFIXES]
    .some((protectedCode) => prefix === protectedCode || prefix.startsWith(`${protectedCode}-`)) ||
    /^(INVOICE|BILL|RELEASE|DELIVERY|PAYMENT|RECEIPT|LEDGER|VOUCHER|SALARY|MANIFEST|LOAD-?LIST)(-|$)/.test(prefix)) {
    throw new BadRequestException('Invalid or protected number prefix');
  }
  if (!['NONE', 'YYYY', 'YYYYMM'].includes(n.period as string)) throw new BadRequestException('Invalid number period');
  const p = object(d.permissions ?? {}, ['read', 'create', 'update', 'transition', 'approve'], 'document permissions');
  const permissions = { read: optionalPermission(p.read), create: optionalPermission(p.create),
    update: optionalPermission(p.update), transition: optionalPermission(p.transition),
    approve: optionalPermission(p.approve) };
  const relationships = unique(list(d.relationships ?? [], 'relationships', 6)
    .map((s) => string(s, 'relationship', 30)), 'relationships') as (keyof typeof LINK_SCOPES)[];
  if (relationships.some((s) => !(s in LINK_SCOPES))) throw new BadRequestException('Unsupported relationship');
  const r = object(d.reporting ?? {}, ['searchable', 'exportable'], 'reporting');
  const l = object(d.layout, ['title', 'note', 'fields', 'logoAssetId', 'letterheadAssetId',
    'stampAssetId', 'signatureAssetId'], 'layout');
  const fields = unique(list(l.fields ?? [], 'layout fields', 40).map((x) => key(x)), 'layout fields');
  const asset = (id: unknown) => id == null || id === '' ? null : string(id, 'approved artwork ID', 70);
  return { ...shared, numbering: { prefix, padding: int(n.padding, 'padding', 2, 12),
    period: n.period as DocumentSpec['numbering']['period'] }, permissions, relationships,
    reporting: { searchable: r.searchable === undefined ? false : bool(r.searchable, 'searchable'),
      exportable: r.exportable === undefined ? false : bool(r.exportable, 'exportable') },
    layout: { title: string(l.title, 'layout title'), note: l.note == null || l.note === ''
      ? null : string(l.note, 'layout note', 500), fields,
      logoAssetId: asset(l.logoAssetId), letterheadAssetId: asset(l.letterheadAssetId),
      stampAssetId: asset(l.stampAssetId), signatureAssetId: asset(l.signatureAssetId) } };
}
