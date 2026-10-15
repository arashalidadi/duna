import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ConfigField, type ConfigFieldValue } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { FIELD_SCOPES, type FieldRules, type FieldVisibility, type WorkflowTransition, fieldSpec, code, key, limitJson,
  object, requireOffice, scope, string, optionalPermission } from './configuration.policy';

export type Tx = Prisma.TransactionClient;
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const SLICE = 100;

/** No arbitrary model/table name is ever accepted from the URL. */
export async function recordState(tx: Tx, kind: string, recordId: string): Promise<string> {
  let row: { status: string } | { id: string } | null = null;
  switch (kind) {
    case 'Customer': row = await tx.customer.findFirst({ where: { id: recordId, deletedAt: null }, select: { id: true } }); break;
    case 'Cargo': row = await tx.cargo.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    case 'Job': row = await tx.job.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    case 'BillOfLading': row = await tx.billOfLading.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    case 'Invoice': row = await tx.invoice.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    case 'ReleaseOrder': row = await tx.releaseOrder.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    case 'Voyage': row = await tx.voyage.findUnique({ where: { id: recordId }, select: { status: true } }); break;
    case 'Manifest': row = await tx.manifest.findFirst({ where: { id: recordId, deletedAt: null }, select: { status: true } }); break;
    default: throw new BadRequestException('Unsupported business record');
  }
  if (!row) throw new NotFoundException('Business record not found');
  return 'status' in row ? row.status : '';
}

export function canSeeField(field: Pick<ConfigField, 'viewPermission' | 'visibility'>,
  actor: AuthenticatedUser, status: string): boolean {
  if (field.viewPermission && !actor.isPrimaryAdmin && !actor.permissions.includes(field.viewPermission)) return false;
  const v = field.visibility as FieldVisibility;
  if (v?.roles?.length && !actor.isPrimaryAdmin && !v.roles.some((r) => actor.roles.some((role) => role.code === r))) return false;
  if (v?.statuses?.length && !v.statuses.includes(status)) return false;
  return true;
}
function active(field: Pick<ConfigField, 'isActive' | 'effectiveFrom' | 'effectiveUntil'>): boolean {
  const now = new Date();
  return field.isActive && field.effectiveFrom <= now && (!field.effectiveUntil || now < field.effectiveUntil);
}

@Injectable()
export class FieldConfigService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async lists(actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:read');
    return this.prisma.configOptionList.findMany({ include: { options: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } },
      orderBy: { code: 'asc' }, take: 200 });
  }
  async createList(input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const d = object(input, ['code', 'label'], 'option list');
    const listCode = code(d.code), label = string(d.label, 'list label');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.configOptionList.create({ data: { code: listCode, label, createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.list.create', entityType: 'ConfigOptionList',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email, afterData: row });
      return row;
    });
  }
  async updateList(id: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const d = object(input, ['label', 'isActive'], 'option list');
    if (!Object.keys(d).length) throw new BadRequestException('No changes');
    const data = { ...(d.label !== undefined ? { label: string(d.label, 'list label') } : {}),
      ...(d.isActive !== undefined ? { isActive: this.boolean(d.isActive) } : {}), updatedById: actor.id };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.configOptionList.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Option list not found');
      const after = await tx.configOptionList.update({ where: { id }, data });
      await this.audit.recordIn(tx, { action: 'configuration.list.update', entityType: 'ConfigOptionList',
        entityId: id, actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after });
      return after;
    });
  }
  async addOption(listId: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const d = object(input, ['code', 'label', 'sortOrder'], 'option');
    const optionCode = code(d.code), label = string(d.label, 'option label');
    const sortOrder = d.sortOrder === undefined ? 0 : this.sort(d.sortOrder);
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.configOptionList.findUnique({ where: { id: listId } });
      if (!list?.isActive) throw new ConflictException('Option list is inactive or missing');
      const row = await tx.configOption.create({ data: { listId, code: optionCode, label, sortOrder } });
      await this.audit.recordIn(tx, { action: 'configuration.option.create', entityType: 'ConfigOption',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email, afterData: row });
      return row;
    });
  }
  async updateOption(id: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    // Codes and IDs are immutable. Historical values snapshot the label as it was.
    const d = object(input, ['label', 'sortOrder', 'isActive'], 'option');
    if (!Object.keys(d).length) throw new BadRequestException('No changes');
    const data = { ...(d.label !== undefined ? { label: string(d.label, 'option label') } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: this.sort(d.sortOrder) } : {}),
      ...(d.isActive !== undefined ? { isActive: this.boolean(d.isActive) } : {}) };
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.configOption.findUnique({ where: { id }, include: { list: true } });
      if (!before) throw new NotFoundException('Option not found');
      if (data.isActive && !before.list.isActive) throw new ConflictException('Activate the list first');
      const after = await tx.configOption.update({ where: { id }, data });
      await this.audit.recordIn(tx, { action: 'configuration.option.update', entityType: 'ConfigOption',
        entityId: id, actorId: actor.id, actorEmail: actor.email, beforeData: before, afterData: after });
      return after;
    });
  }
  private boolean(value: unknown): boolean {
    if (typeof value !== 'boolean') throw new BadRequestException('Expected a boolean');
    return value;
  }
  private sort(value: unknown): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || Math.abs(value) > 10000) {
      throw new BadRequestException('Invalid sort order');
    }
    return value;
  }
  private async checkSpec(tx: Tx, spec: ReturnType<typeof fieldSpec>, existing = false) {
    if (spec.scope.startsWith('CUSTOM:')) {
      const type = await tx.configDocumentType.findUnique({ where: { code: spec.scope.slice(7) } });
      if (!type || type.isCore) throw new NotFoundException('Custom document type not found');
    }
    if (spec.optionListId) {
      const list = await tx.configOptionList.findUnique({ where: { id: spec.optionListId } });
      if (!list || !existing && !list.isActive) throw new ConflictException('Select requires an active option list');
    }
    for (const permissionCode of [spec.viewPermission, spec.editPermission].filter((p): p is string => !!p)) {
      if (!await tx.permission.findUnique({ where: { code: permissionCode } })) {
        throw new BadRequestException(`Unknown permission: ${permissionCode}`);
      }
    }
    if (spec.visibility.roles?.length) {
      const roles = await tx.role.count({ where: { code: { in: spec.visibility.roles } } });
      if (roles !== spec.visibility.roles.length) throw new BadRequestException('Unknown visibility role');
    }
    if (spec.visibility.statuses?.length && spec.scope === 'Customer') {
      throw new BadRequestException('Customers do not have a workflow status');
    }
  }
  async fields(kind: string, actor: AuthenticatedUser) {
    const fieldScope = scope(kind);
    requireOffice(actor, 'configuration:read');
    if (fieldScope in FIELD_SCOPES) requireOffice(actor, FIELD_SCOPES[fieldScope as keyof typeof FIELD_SCOPES].read);
    else requireOffice(actor, 'config_document:read');
    return this.prisma.configField.findMany({ where: { scope: fieldScope }, include: { optionList: { include: {
      options: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } } } },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], take: 200 }).then((fields) =>
        fields.filter((field) => canSeeField(field, actor, '') || actor.isPrimaryAdmin));
  }
  /** R/O has no draft stage. Display only fields a creator can see at ISSUED
   * so optional values can be validated in the original release transaction. */
  async releaseCreateFields(actor: AuthenticatedUser) {
    requireOffice(actor, 'release:read', 'release:create');
    const now = new Date();
    const rows = await this.prisma.configField.findMany({ where: { scope: 'ReleaseOrder', isActive: true,
      effectiveFrom: { lte: now }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
      include: { optionList: { include: { options: { where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } } } },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], take: 200 });
    return rows.filter((field) => canSeeField(field, actor, 'ISSUED')).map((field) => ({
      key: field.key, label: field.label, kind: field.kind, required: field.required,
      rules: field.rules, displayLocation: field.displayLocation, sortOrder: field.sortOrder,
      editable: actor.isPrimaryAdmin || actor.permissions.includes('configuration:value_write') &&
        (!field.editPermission || actor.permissions.includes(field.editPermission)),
      options: field.optionList?.isActive ? field.optionList.options : [],
    }));
  }
  async createField(input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const spec = fieldSpec(input);
    return this.prisma.$transaction(async (tx) => {
      await this.checkSpec(tx, spec);
      const row = await tx.configField.create({ data: { ...spec, rules: asJson(spec.rules), visibility: asJson(spec.visibility),
        createdById: actor.id } });
      await tx.configFieldRevision.create({ data: { fieldId: row.id, version: 1,
        definition: asJson(spec), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.field.create', entityType: 'ConfigField',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email, afterData: spec });
      return row;
    });
  }
  async updateField(id: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const d = object(input, ['label', 'required', 'rules', 'displayLocation', 'sortOrder', 'visibility',
      'viewPermission', 'editPermission', 'searchable', 'filterable', 'reportable', 'exportable',
      'effectiveFrom', 'effectiveUntil', 'isActive'], 'field update');
    if (!Object.keys(d).length) throw new BadRequestException('No changes');
    const { isActive, ...definitionPatch } = d;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConfigField" WHERE "id" = ${id} FOR UPDATE`;
      const old = await tx.configField.findUnique({ where: { id } });
      if (!old) throw new NotFoundException('Field not found');
      // Build the *public* spec explicitly; Prisma also returns id/timestamps,
      // which must not be interpreted as editable configuration properties.
      const spec = fieldSpec({ scope: old.scope, key: old.key, label: old.label, kind: old.kind,
        required: old.required, rules: old.rules, optionListId: old.optionListId,
        displayLocation: old.displayLocation, sortOrder: old.sortOrder, visibility: old.visibility,
        viewPermission: old.viewPermission, editPermission: old.editPermission,
        searchable: old.searchable, filterable: old.filterable, reportable: old.reportable,
        exportable: old.exportable, effectiveFrom: old.effectiveFrom.toISOString(),
        effectiveUntil: old.effectiveUntil?.toISOString() ?? null, ...definitionPatch });
      await this.checkSpec(tx, spec, true);
      // Read permission cannot be relaxed on a field holding older, potentially
      // sensitive values. The snapshot adds the original permission as well.
      if (old.viewPermission && old.viewPermission !== spec.viewPermission &&
        await tx.configFieldValue.count({ where: { fieldId: id } })) {
        throw new ConflictException('View permission cannot be relaxed or changed while values exist');
      }
      const version = old.version + 1;
      const after = await tx.configField.update({ where: { id }, data: { ...spec,
        rules: asJson(spec.rules), visibility: asJson(spec.visibility), isActive: isActive === undefined
          ? old.isActive : this.boolean(isActive), version, updatedById: actor.id } });
      await tx.configFieldRevision.create({ data: { fieldId: id, version,
        definition: asJson({ ...spec, isActive: after.isActive }), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.field.update', entityType: 'ConfigField',
        entityId: id, actorId: actor.id, actorEmail: actor.email, beforeData: old, afterData: after });
      return after;
    });
  }
  async history(fieldId: string, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    return this.prisma.configFieldRevision.findMany({ where: { fieldId }, orderBy: { version: 'desc' }, take: 100 });
  }

  private visible(field: ConfigField, actor: AuthenticatedUser, status: string,
    prior?: ConfigFieldValue | null): boolean {
    if (!canSeeField(field, actor, status)) return false;
    if (!prior) return true;
    const snapshot = prior.fieldSnapshot as Record<string, unknown>;
    return canSeeField({ viewPermission: optionalPermission(snapshot.viewPermission),
      visibility: snapshot.visibility as Prisma.JsonValue }, actor, status);
  }
  async values(kind: string, recordId: string, actor: AuthenticatedUser) {
    const kindName = scope(kind);
    if (!(kindName in FIELD_SCOPES)) throw new BadRequestException('Use the custom document endpoint for document values');
    requireOffice(actor, FIELD_SCOPES[kindName as keyof typeof FIELD_SCOPES].read);
    const status = await recordState(this.prisma, kindName, recordId);
    const fields = await this.prisma.configField.findMany({ where: { scope: kindName },
      include: { optionList: { include: { options: { orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } } },
        values: { where: { recordId } } }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], take: 200 });
    return fields.filter((f) => (active(f) || f.values.length) && this.visible(f, actor, status, f.values[0]))
      .map((f) => ({ field: { id: f.id, key: f.key, label: f.label, kind: f.kind, required: f.required,
        displayLocation: f.displayLocation, sortOrder: f.sortOrder, version: f.version, active: active(f),
        rules: f.rules, visibility: f.visibility, searchable: f.searchable, filterable: f.filterable,
        reportable: f.reportable, exportable: f.exportable,
        options: f.optionList?.options.map((option) => ({ ...option,
          isActive: option.isActive && f.optionList!.isActive })) ?? [] },
      value: f.values[0] ?? null, editable: active(f) && (actor.isPrimaryAdmin ||
        actor.permissions.includes('configuration:value_write') && actor.permissions.includes(FIELD_SCOPES[kindName as keyof typeof FIELD_SCOPES].edit) &&
        (!f.editPermission || actor.permissions.includes(f.editPermission))) &&
        !this.immutable(kindName, status) }));
  }
  private immutable(kind: string, status: string): boolean {
    if (kind === 'BillOfLading' || kind === 'Invoice') return status !== 'DRAFT';
    if (kind === 'ReleaseOrder') return true; // issued on create; no sidecar mutation after release.
    if (kind === 'Job') return status === 'COMPLETED' || status === 'CANCELLED';
    if (kind === 'Cargo') return status === 'CANCELLED' || status === 'RELEASED';
    return false;
  }

  /** Validate one value against the *current* list. Never trust option text from clients. */
  async validateValue(tx: Tx, field: ConfigField, incoming: unknown, old?: ConfigFieldValue | null) {
    if (!active(field)) throw new ConflictException('Field is not effective or has been deactivated');
    limitJson(incoming, 'field value', 4096);
    const rules = field.rules as FieldRules;
    let snapshotOptions: { id: string; code: string; label: string }[] = [];
    if (incoming === null) {
      if (field.required) throw new BadRequestException('Required field cannot be cleared');
      incoming = { cleared: true }; // keep row, revisions, and audit; never delete data.
    } else if (field.kind === 'TEXT') {
      if (typeof incoming !== 'string' || incoming.length > 10000 || incoming.length < (rules.minLength ?? 0) ||
        incoming.length > (rules.maxLength ?? 10000) || rules.format === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(incoming) ||
        rules.format === 'CODE' && !/^[a-zA-Z0-9_-]+$/.test(incoming)) throw new BadRequestException('Invalid text value');
      if (field.required && !incoming.trim()) throw new BadRequestException('Required text cannot be blank');
    } else if (field.kind === 'NUMBER') {
      if (typeof incoming !== 'number' || !Number.isFinite(incoming) || incoming < (rules.min ?? -Infinity) ||
        incoming > (rules.max ?? Infinity)) throw new BadRequestException('Invalid number value');
    } else if (field.kind === 'DATE') {
      if (typeof incoming !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(incoming) ||
        Number.isNaN(Date.parse(`${incoming}T00:00:00.000Z`)) ||
        new Date(`${incoming}T00:00:00.000Z`).toISOString().slice(0, 10) !== incoming) {
        throw new BadRequestException('Invalid date value');
      }
    } else if (field.kind === 'BOOLEAN') {
      if (typeof incoming !== 'boolean') throw new BadRequestException('Invalid boolean value');
    } else if (field.kind === 'SINGLE_SELECT' || field.kind === 'MULTI_SELECT') {
      const ids = field.kind === 'SINGLE_SELECT' ? [incoming] : incoming;
      if (!Array.isArray(ids) || !ids.length || ids.length > 40 || ids.some((i) => typeof i !== 'string') ||
        new Set(ids).size !== ids.length) throw new BadRequestException('Invalid selected options');
      const options = await tx.configOption.findMany({ where: { listId: field.optionListId!, id: { in: ids as string[] } },
        include: { list: { select: { isActive: true } } } });
      if (options.length !== ids.length) throw new BadRequestException('Option not in this list');
      const prior = old?.fieldSnapshot as { options?: { id: string; code: string; label: string }[] } | undefined;
      const retained = old && old.value && !Array.isArray(old.value) ? [old.value] : old?.value;
      snapshotOptions = (ids as string[]).map((id) => {
        const option = options.find((o) => o.id === id)!;
        if (!option.isActive || !option.list.isActive) {
          // Previously saved inactive IDs may be retained, but never introduced
          // on another record. Retain their original historical display label.
          if (!Array.isArray(retained) || !retained.includes(id)) throw new ConflictException('Option is inactive');
          return prior?.options?.find((o) => o.id === id) ?? { id, code: option.code, label: option.label };
        }
        return { id, code: option.code, label: option.label };
      });
    } else throw new BadRequestException('Unsupported field type');
    return { value: incoming as Prisma.InputJsonValue,
      snapshot: { fieldId: field.id, key: field.key, label: field.label, version: field.version,
        kind: field.kind, viewPermission: field.viewPermission, visibility: field.visibility,
        exportable: field.exportable, reportable: field.reportable,
        searchable: field.searchable, filterable: field.filterable,
        options: snapshotOptions }, searchText: field.searchable || field.filterable || field.reportable || field.exportable
        ? (snapshotOptions.length ? snapshotOptions.map((o) => `${o.code} ${o.label}`).join(' | ') :
          typeof incoming === 'string' || typeof incoming === 'number' || typeof incoming === 'boolean'
            ? String(incoming) : null)?.slice(0, 512) ?? null : null };
  }

  /** Called only on draft/editable core records. All writes and audit are atomic. */
  async writeValues(kind: string, recordId: string, input: unknown, actor: AuthenticatedUser) {
    const kindName = scope(kind);
    if (!(kindName in FIELD_SCOPES)) throw new BadRequestException('Use the custom document endpoint for document values');
    const perms = FIELD_SCOPES[kindName as keyof typeof FIELD_SCOPES];
    requireOffice(actor, perms.read, perms.edit, 'configuration:value_write');
    const body = object(input, ['values'], 'value write');
    const values = object(body.values, null, 'values'); // keys are dynamic, validated below
    if (!Object.keys(values).length || Object.keys(values).length > 30) throw new BadRequestException('Provide 1–30 values');
    for (const k of Object.keys(values)) key(k);
    return this.prisma.$transaction(async (tx) => {
      const status = await recordState(tx, kindName, recordId);
      if (this.immutable(kindName, status)) throw new ConflictException('Issued or terminal core records cannot be edited through configuration');
      await this.writeValidatedIn(tx, kindName as keyof typeof FIELD_SCOPES, recordId, values, actor, status);
      return { updated: Object.keys(values).length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  /** Release orders have no editable draft. Write optional sidecars only inside
   * the *original* creation transaction after every financial/approval gate and
   * before the immutable Phase-8 issue snapshot; never permit a later PATCH. */
  async writeNewReleaseIn(tx: Tx, recordId: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'release:create');
    const values = input === undefined ? {} : object(input, null, 'release custom values');
    if (Object.keys(values).length > 30) throw new BadRequestException('Too many release values');
    for (const name of Object.keys(values)) key(name);
    if (Object.keys(values).length) {
      requireOffice(actor, 'configuration:value_write');
      await this.writeValidatedIn(tx, 'ReleaseOrder', recordId, values, actor, 'ISSUED');
    }
    await this.assertRequiredAtIssue(tx, 'ReleaseOrder', recordId);
  }

  private async writeValidatedIn(tx: Tx, kindName: keyof typeof FIELD_SCOPES, recordId: string,
    values: Record<string, unknown>, actor: AuthenticatedUser, status: string) {
    const definitions = await tx.configField.findMany({ where: { scope: kindName, key: { in: Object.keys(values) } } });
    if (definitions.length !== Object.keys(values).length) throw new BadRequestException('Unknown field key');
    for (const field of definitions) {
      if (!this.visible(field, actor, status)) throw new ForbiddenException('Field not visible to actor');
      if (field.editPermission) requireOffice(actor, field.editPermission);
      const old = await tx.configFieldValue.findUnique({ where: { fieldId_recordId: { fieldId: field.id, recordId } } });
      if (old && !this.visible(field, actor, status, old)) throw new ForbiddenException('Historical field is restricted');
      // Sending an unchanged value cannot reintroduce an inactive option or
      // silently replace its snapshot after a label or config change.
      if (old && JSON.stringify(old.value) === JSON.stringify(values[field.key])) continue;
      const checked = await this.validateValue(tx, field, values[field.key], old);
      const current = await tx.configFieldValue.upsert({ where: { fieldId_recordId: { fieldId: field.id, recordId } },
        create: { fieldId: field.id, recordId, scope: kindName, value: checked.value,
          searchText: checked.searchText, fieldSnapshot: asJson(checked.snapshot), updatedById: actor.id },
        update: { value: checked.value, searchText: checked.searchText,
          fieldSnapshot: asJson(checked.snapshot), updatedById: actor.id } });
      await tx.configFieldValueRevision.create({ data: { valueId: current.id, value: checked.value,
        snapshot: asJson(checked.snapshot), actorId: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.value.write', entityType: kindName,
        entityId: recordId, actorId: actor.id, actorEmail: actor.email,
        beforeData: old ? { value: old.value, snapshot: old.fieldSnapshot } : null,
        afterData: { value: checked.value, snapshot: checked.snapshot }, metadata: { fieldId: field.id } });
    }
  }
  async valueHistory(kind: string, recordId: string, fieldKey: string, actor: AuthenticatedUser) {
    const kindName = scope(kind);
    if (!(kindName in FIELD_SCOPES)) throw new BadRequestException('Unsupported scope');
    requireOffice(actor, FIELD_SCOPES[kindName as keyof typeof FIELD_SCOPES].read);
    const status = await recordState(this.prisma, kindName, recordId);
    const field = await this.prisma.configField.findUnique({ where: { scope_key: { scope: kindName, key: key(fieldKey) } } });
    if (!field || !this.visible(field, actor, status)) throw new NotFoundException('Field not found');
    const value = await this.prisma.configFieldValue.findUnique({ where: { fieldId_recordId: { fieldId: field.id, recordId } } });
    if (!value || !this.visible(field, actor, status, value)) return [];
    const revisions = await this.prisma.configFieldValueRevision.findMany({ where: { valueId: value.id },
      orderBy: { createdAt: 'desc' }, take: 100 });
    return revisions.filter((r) => canSeeField({ viewPermission: optionalPermission(
      (r.snapshot as Record<string, unknown>).viewPermission),
      visibility: ((r.snapshot as Record<string, unknown>).visibility ?? {}) as Prisma.JsonValue }, actor, status));
  }
  async search(kind: string, fieldKey: string, term: unknown, actor: AuthenticatedUser,
    flag: 'searchable' | 'filterable' | 'reportable' | 'exportable', pageInput: unknown = 1) {
    const page = typeof pageInput === 'string' && /^\d+$/.test(pageInput) ? Number(pageInput) : pageInput;
    if (typeof page !== 'number' || !Number.isSafeInteger(page) || page < 1 || page > 10000) {
      throw new BadRequestException('Invalid field query page');
    }
    const kindName = scope(kind);
    if (!(kindName in FIELD_SCOPES)) throw new BadRequestException('Unsupported search scope');
    requireOffice(actor, FIELD_SCOPES[kindName as keyof typeof FIELD_SCOPES].read);
    if (flag === 'reportable') requireOffice(actor, 'report:read');
    if (flag === 'exportable') requireOffice(actor, 'report:export');
    const field = await this.prisma.configField.findUnique({ where: { scope_key: { scope: kindName, key: key(fieldKey) } } });
    if (!field || !field[flag] || !active(field)) throw new NotFoundException('Field is not enabled for this query');
    const search = term === undefined || term === '' ? '' : string(term, 'query', 100);
    const rows = await this.prisma.configFieldValue.findMany({ where: { fieldId: field.id,
      ...(search ? { searchText: { contains: search, mode: 'insensitive' } } : {}) },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * SLICE, take: SLICE });
    const allowed = [];
    for (const row of rows) {
      try {
        const status = await recordState(this.prisma, kindName, row.recordId);
        const original = row.fieldSnapshot as Record<string, unknown>;
        if (this.visible(field, actor, status, row) && original[flag] === true) {
          allowed.push({ recordId: row.recordId, value: row.value, snapshot: row.fieldSnapshot });
        }
      } catch (error) { if (!(error instanceof NotFoundException)) throw error; }
    }
    return { items: allowed, page, pageSize: SLICE, truncated: rows.length === SLICE,
      nextPage: rows.length === SLICE ? page + 1 : null };
  }

  async assertConditionAccess(tx: Tx, kindName: string, recordId: string,
    transition: WorkflowTransition, actor: AuthenticatedUser, status: string) {
    for (const condition of transition.conditions.filter((c) => c.source === 'field')) {
      const field = await tx.configField.findUnique({ where: { scope_key: {
        scope: kindName, key: condition.key } } });
      if (!field) throw new ConflictException('Workflow condition references an unavailable field');
      const value = await tx.configFieldValue.findUnique({ where: { fieldId_recordId: {
        fieldId: field.id, recordId } } });
      if (!this.visible(field, actor, status, value)) {
        throw new ForbiddenException('Workflow condition references a restricted field');
      }
    }
  }

  /** Configurable documents share the same managed lists, value snapshots,
   * immutable revisions and audit mechanism as core-record sidecars. */
  async writeCustomIn(tx: Tx, docCode: string, recordId: string, input: unknown,
    actor: AuthenticatedUser, previous: Record<string, unknown> = {},
    operation: 'create' | 'update' = 'update', status = ''): Promise<Record<string, unknown>> {
    requireOffice(actor, 'config_document:read', `config_document:${operation}`);
    const kindName = scope(`CUSTOM:${docCode}`);
    const values = object(input, null, 'document values');
    limitJson(values, 'document values', 32 * 1024);
    if (Object.keys(values).length > 40) throw new BadRequestException('Too many document values');
    for (const name of Object.keys(values)) key(name);
    const definitions = await tx.configField.findMany({ where: { scope: kindName,
      key: { in: Object.keys(values) } } });
    if (definitions.length !== Object.keys(values).length) throw new BadRequestException('Unknown document field');
    const next = { ...previous };
    for (const field of definitions) {
      const before = await tx.configFieldValue.findUnique({ where: { fieldId_recordId: { fieldId: field.id, recordId } } });
      if (!this.visible(field, actor, status, before)) throw new ForbiddenException('Document field is not visible');
      if (field.editPermission) requireOffice(actor, field.editPermission);
      if (before && JSON.stringify(before.value) === JSON.stringify(values[field.key])) continue;
      const checked = await this.validateValue(tx, field, values[field.key], before);
      next[field.key] = checked.value;
      const current = await tx.configFieldValue.upsert({ where: { fieldId_recordId: { fieldId: field.id, recordId } },
        create: { fieldId: field.id, recordId, scope: kindName, value: checked.value,
          searchText: checked.searchText, fieldSnapshot: asJson(checked.snapshot), updatedById: actor.id },
        update: { value: checked.value, searchText: checked.searchText,
          fieldSnapshot: asJson(checked.snapshot), updatedById: actor.id } });
      await tx.configFieldValueRevision.create({ data: { valueId: current.id, value: checked.value,
        snapshot: asJson(checked.snapshot), actorId: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.value.write', entityType: 'ConfigDocument',
        entityId: recordId, actorId: actor.id, actorEmail: actor.email,
        beforeData: before ? { value: before.value, snapshot: before.fieldSnapshot } : null,
        afterData: { value: checked.value, snapshot: checked.snapshot }, metadata: { fieldId: field.id } });
    }
    return next;
  }
  async assertRequiredCustom(tx: Tx, docCode: string, recordId: string): Promise<void> {
    const fields = await tx.configField.findMany({ where: { scope: `CUSTOM:${docCode}`, required: true,
      isActive: true, effectiveFrom: { lte: new Date() },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] } });
    for (const field of fields) {
      const value = await tx.configFieldValue.findUnique({ where: { fieldId_recordId: { fieldId: field.id, recordId } } });
      if (!value || (value.value && typeof value.value === 'object' && !Array.isArray(value.value) &&
        (value.value as Record<string, unknown>).cleared === true)) {
        throw new ConflictException(`Required custom field ${field.key} is missing`);
      }
    }
  }

  /** Called inside actual issuance transactions. Required configuration adds a
   * gate; it never substitutes for existing eligibility or financial checks. */
  async assertRequiredAtIssue(tx: Tx, kind: 'Invoice' | 'BillOfLading' | 'ReleaseOrder', recordId: string) {
    const fields = await tx.configField.findMany({ where: { scope: kind, isActive: true, required: true,
      effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] } });
    for (const field of fields) {
      const value = await tx.configFieldValue.findUnique({ where: { fieldId_recordId: { fieldId: field.id, recordId } } });
      if (!value || (value.value && typeof value.value === 'object' && !Array.isArray(value.value) &&
        (value.value as Record<string, unknown>).cleared === true)) {
        throw new ConflictException(`Required custom field ${field.key} is missing`);
      }
    }
  }
}
