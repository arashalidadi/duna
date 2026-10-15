import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ConfigDocument, type ConfigDocumentType, type ConfigField } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import { NumberingService } from '../../common/infrastructure/numbering/numbering.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { DOCUMENT_TYPES, READ_PERMISSION, type DocumentLayout } from '../document-output/document-layout';
import { DocumentAssetsService } from '../document-output/document-assets.service';
import { assertTransition, code, customTypeCode, documentSpec, isCoreDocument, type DocumentSpec,
  LINK_SCOPES, object, requireOffice, string, limitJson, workflowDefinition } from './configuration.policy';
import { FieldConfigService, canSeeField, recordState, type Tx } from './field-config.service';
import { WorkflowConfigService } from './workflow-config.service';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const asSpec = (value: Prisma.JsonValue): DocumentSpec => documentSpec(value) as DocumentSpec;
const matchingId = (id: string) => /^[a-zA-Z0-9_-]{5,70}$/.test(id);
const LINK_NAMES = Object.keys(LINK_SCOPES);

@Injectable()
export class DocumentConfigService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly numbering: NumberingService, private readonly fields: FieldConfigService,
    private readonly workflows: WorkflowConfigService, private readonly assets: DocumentAssetsService) {}

  async types(actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:read');
    const rows = await this.prisma.configDocumentType.findMany({
      include: { versions: { orderBy: { version: 'desc' } } }, orderBy: { code: 'asc' }, take: 200 });
    return { coreCatalogue: DOCUMENT_TYPES.map((type) => ({ code: type,
      readPermission: READ_PERMISSION[type],
      // Metadata cannot replace original Phase-8 output or core numbering.
      configured: rows.find((row) => row.code === type) ?? null })),
      customTypes: rows.filter((row) => !row.isCore) };
  }
  async catalogue(actor: AuthenticatedUser) {
    requireOffice(actor, 'config_document:read');
    const rows = await this.prisma.configDocumentType.findMany({ where: { isCore: false },
      include: { versions: { orderBy: { version: 'desc' } }, _count: { select: { records: true } } },
      orderBy: { code: 'asc' }, take: 100 });
    return rows.flatMap((row) => {
      if (!row.isActive && !row._count.records) return [];
      const version = row.versions.find((v) => v.id === row.currentVersionId);
      if (!version) return [];
      const spec = asSpec(version.definition);
      try { this.access(actor, spec, 'read'); }
      catch (error) { if (error instanceof ForbiddenException) return []; throw error; }
      return [{ code: row.code, name: spec.name, category: spec.category, isActive: row.isActive }];
    });
  }
  async formPolicy(typeCode: string, actor: AuthenticatedUser) {
    const type = await this.prisma.configDocumentType.findUnique({ where: { code: code(typeCode, 'document code') } });
    if (!type || type.isCore || !type.currentVersionId) throw new NotFoundException('Document type not found');
    const version = await this.prisma.configDocumentVersion.findUnique({ where: { id: type.currentVersionId } });
    if (!version || version.typeId !== type.id) throw new ConflictException('Document type version is invalid');
    const spec = asSpec(version.definition);
    this.access(actor, spec, 'read');
    return { relationships: spec.relationships, searchable: spec.reporting.searchable,
      exportable: spec.reporting.exportable, layoutTitle: spec.layout.title, isActive: type.isActive };
  }
  async formFields(typeCode: string, actor: AuthenticatedUser, recordId?: string) {
    let currentStatus: string;
    if (recordId) {
      const { row } = await this.record(this.prisma, recordId, actor, 'read');
      if (row.type.code !== typeCode) throw new NotFoundException('Record belongs to another type');
      currentStatus = row.status;
    } else {
      const policy = await this.formPolicy(typeCode, actor);
      if (!policy.isActive) return []; // existing retired records still use recordId/pinned values.
      const flow = await this.workflows.activeIn(this.prisma, `CUSTOM:${typeCode}`);
      currentStatus = flow?.definition.statuses[0].code ?? '';
    }
    const saved = recordId ? await this.prisma.configFieldValue.findMany({ where: { recordId,
      scope: `CUSTOM:${typeCode}` }, select: { fieldId: true, fieldSnapshot: true } }) : [];
    const now = new Date();
    const rows = await this.prisma.configField.findMany({ where: { scope: `CUSTOM:${typeCode}` },
      include: { optionList: { include: { options: { where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] } } } },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }], take: 200 });
    return rows.flatMap((field) => {
      const historical = saved.find((value) => value.fieldId === field.id);
      const effective = field.isActive && field.effectiveFrom <= now && (!field.effectiveUntil || now < field.effectiveUntil);
      if (!effective && !historical || !canSeeField(field, actor, currentStatus)) return [];
      if (historical) {
        const snapshot = historical.fieldSnapshot as Record<string, unknown>;
        if (!canSeeField({ viewPermission: snapshot.viewPermission as string | null ?? null,
          visibility: (snapshot.visibility ?? {}) as Prisma.JsonValue }, actor, currentStatus)) return [];
      }
      return [{ key: field.key, label:
        (historical?.fieldSnapshot as { label?: string } | undefined)?.label ?? field.label,
        kind: field.kind, required: field.required, rules: field.rules,
        active: effective, displayLocation: field.displayLocation, sortOrder: field.sortOrder,
        options: field.optionList?.isActive ? field.optionList.options : [] }];
    });
  }
  async createType(rawCode: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const core = isCoreDocument(rawCode);
    const typeCode = core ? rawCode : customTypeCode(rawCode);
    const spec = documentSpec(input, core);
    return this.prisma.$transaction(async (tx) => {
      await this.assertDocumentPermissions(tx, spec);
      const row = await tx.configDocumentType.create({ data: { code: typeCode, isCore: core,
        createdById: actor.id } });
      const v = await tx.configDocumentVersion.create({ data: { typeId: row.id, version: 1,
        definition: json(spec), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.document_type.create', entityType: 'ConfigDocumentType',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { code: typeCode, isCore: core, version: 1, definition: spec } });
      return { ...row, versions: [v] };
    });
  }
  private async assertDocumentPermissions(tx: Tx, spec: ReturnType<typeof documentSpec>) {
    if (!('permissions' in spec)) return;
    const codes = Object.values(spec.permissions).filter((p): p is string => !!p);
    const found = await tx.permission.count({ where: { code: { in: codes } } });
    if (found !== new Set(codes).size) throw new BadRequestException('Unknown document permission');
  }
  async addVersion(typeCode: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const row = await this.prisma.configDocumentType.findUnique({ where: { code: typeCode } });
    if (!row) throw new NotFoundException('Document type not found');
    const spec = documentSpec(input, row.isCore);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConfigDocumentType" WHERE "id" = ${row.id} FOR UPDATE`;
      await this.assertDocumentPermissions(tx, spec);
      const prior = await tx.configDocumentVersion.findFirst({ where: { typeId: row.id }, orderBy: { version: 'desc' } });
      const version = await tx.configDocumentVersion.create({ data: { typeId: row.id,
        version: (prior?.version ?? 0) + 1, definition: json(spec), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.document_type.version', entityType: 'ConfigDocumentVersion',
        entityId: version.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { code: typeCode, version: version.version, definition: spec } });
      return version;
    });
  }
  async activateType(typeCode: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:manage');
    const d = object(input, ['versionId', 'isActive'], 'document type activation');
    if (typeof d.isActive !== 'boolean') throw new BadRequestException('isActive must be boolean');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.configDocumentType.findUnique({ where: { code: typeCode } });
      if (!row) throw new NotFoundException('Document type not found');
      const version = d.versionId === undefined ? null : await tx.configDocumentVersion.findUnique({
        where: { id: string(d.versionId, 'versionId', 70) } });
      if (version && version.typeId !== row.id) throw new BadRequestException('Version belongs to another document type');
      const currentVersionId = version?.id ?? row.currentVersionId;
      if (d.isActive) {
        if (!currentVersionId) throw new ConflictException('Choose a version to activate');
        if (!row.isCore) {
          if (!await this.workflows.activeIn(tx, `CUSTOM:${row.code}`)) {
            throw new ConflictException('Activate a reviewed workflow before activating this custom type');
          }
          const selected = version ?? await tx.configDocumentVersion.findUniqueOrThrow({ where: { id: currentVersionId } });
          const spec = asSpec(selected.definition);
          await this.assets.assertBindable(spec.layout as unknown as DocumentLayout);
          const fieldKeys = await tx.configField.findMany({ where: { scope: `CUSTOM:${row.code}` }, select: { key: true } });
          if (spec.layout.fields.some((key) => !fieldKeys.some((f) => f.key === key))) {
            throw new BadRequestException('Layout references an unconfigured custom field');
          }
        }
      }
      const after = await tx.configDocumentType.update({ where: { id: row.id }, data: {
        isActive: d.isActive as boolean, currentVersionId, updatedById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.document_type.activate', entityType: 'ConfigDocumentType',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email, beforeData: row, afterData: after });
      return after;
    });
  }
  private async current(tx: Tx, typeCode: string): Promise<{ type: ConfigDocumentType; spec: DocumentSpec; versionId: string }> {
    const type = await tx.configDocumentType.findUnique({ where: { code: code(typeCode, 'document code') } });
    if (!type?.isActive || type.isCore || !type.currentVersionId) {
      throw new NotFoundException('Active custom document type not found');
    }
    const version = await tx.configDocumentVersion.findUnique({ where: { id: type.currentVersionId } });
    if (!version || version.typeId !== type.id) throw new ConflictException('Document type version is invalid');
    return { type, spec: asSpec(version.definition), versionId: version.id };
  }
  private access(actor: AuthenticatedUser, spec: DocumentSpec,
    action: 'read' | 'create' | 'update' | 'transition' | 'approve' | 'render') {
    requireOffice(actor, `config_document:${action}`);
    if (action === 'render') requireOffice(actor, 'document:render');
    const extra = spec.permissions[action === 'render' ? 'read' : action];
    if (extra) requireOffice(actor, extra);
  }
  private async record(tx: Tx, id: string, actor: AuthenticatedUser, action: 'read' | 'update' | 'transition' | 'render') {
    if (!matchingId(id)) throw new BadRequestException('Invalid record ID');
    const row = await tx.configDocument.findUnique({ where: { id }, include: {
      type: true, definition: true, workflowVersion: true } });
    if (!row || row.type.isCore) throw new NotFoundException('Custom document not found');
    const spec = asSpec(row.definition.definition);
    this.access(actor, spec, action);
    if (row.definition.typeId !== row.typeId) throw new ConflictException('Invalid pinned document definition');
    return { row, spec };
  }
  private async linksIn(tx: Tx, input: unknown, spec: DocumentSpec, actor: AuthenticatedUser) {
    const links = object(input, null, 'document relationships');
    limitJson(links, 'relationships', 2048);
    const snapshots: Record<string, unknown> = {};
    for (const [kind, raw] of Object.entries(links)) {
      if (!LINK_NAMES.includes(kind) || !spec.relationships.includes(kind as keyof typeof LINK_SCOPES)) {
        throw new BadRequestException('Unconfigured or forbidden relationship');
      }
      requireOffice(actor, LINK_SCOPES[kind as keyof typeof LINK_SCOPES]);
      const id = string(raw, 'relationship ID', 70);
      const status = await recordState(tx, kind, id);
      // Linking a draft/final-under-review B/L as evidence or output could
      // leak a non-issued document. RELEASED was already approved; ISSUED is
      // the retained legacy equivalent, never a DRAFT alias.
      if (kind === 'BillOfLading' && !['APPROVED', 'RELEASED', 'ISSUED'].includes(status)) {
        throw new ConflictException('Only issued-equivalent B/Ls may be linked to a configured document');
      }
      snapshots[kind] = { id, status };
    }
    return { links: Object.fromEntries(Object.entries(links).map(([kind, id]) => [kind, id])), snapshots };
  }
  private sequenceScope(spec: DocumentSpec, at: Date) {
    const period = spec.numbering.period;
    const date = period === 'NONE' ? '' : period === 'YYYY'
      ? String(at.getUTCFullYear()) : `${at.getUTCFullYear()}${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
    return { period, date };
  }
  async createRecord(typeCode: string, input: unknown, actor: AuthenticatedUser) {
    const d = object(input, ['values', 'links'], 'document');
    return this.prisma.$transaction(async (tx) => {
      const { type, spec, versionId } = await this.current(tx, typeCode);
      this.access(actor, spec, 'create');
      const flow = await this.workflows.activeIn(tx, `CUSTOM:${type.code}`);
      if (!flow) throw new ConflictException('Document workflow is not active');
      const status = flow.definition.statuses[0].code;
      const { links } = await this.linksIn(tx, d.links ?? {}, spec, actor);
      const now = new Date();
      const { period, date } = this.sequenceScope(spec, now);
      const prefix = `${spec.numbering.prefix}${date ? `-${date}` : ''}-`;
      const number = await this.numbering.allocateNumber({ name: `CONFIG:${type.code}:${period}:${date}`,
        documentType: `CUSTOM:${type.code}`, scopeType: period === 'NONE' ? 'GLOBAL' : 'YEAR_PERIOD',
        scopeValue: date || null, prefix, padding: spec.numbering.padding, period: period === 'NONE' ? 'YYYY' : period,
        tx });
      const row = await tx.configDocument.create({ data: { typeId: type.id, versionId, workflowVersionId: flow.id,
        number: number.sequence, status, links: json(links), createdById: actor.id } });
      const values = await this.fields.writeCustomIn(tx, type.code, row.id, d.values ?? {}, actor, {}, 'create', status);
      await this.fields.assertRequiredCustom(tx, type.code, row.id);
      const after = await tx.configDocument.update({ where: { id: row.id }, data: { values: json(values) } });
      await tx.configDocumentEvent.create({ data: { documentId: row.id, actorId: actor.id, kind: 'CREATE',
        afterData: json({ number: row.number, status, values, links, versionId, workflowVersionId: flow.id }) } });
      await this.audit.recordIn(tx, { action: 'configuration.document.create', entityType: 'ConfigDocument',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { number: row.number, status, links, versionId, workflowVersionId: flow.id } });
      return this.summary(after);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async listRecords(typeCode: string, actor: AuthenticatedUser, q?: string) {
    requireOffice(actor, 'config_document:read');
    const type = await this.prisma.configDocumentType.findUnique({ where: { code: code(typeCode, 'document code') } });
    if (!type || type.isCore) throw new NotFoundException('Custom document type not found');
    const search = q ? string(q, 'search', 80) : null;
    const records = await this.prisma.configDocument.findMany({ where: { typeId: type.id,
      ...(search ? { number: { contains: search, mode: 'insensitive' as const } } : {}) },
      include: { definition: true, workflowVersion: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    // A retired type and older versions remain readable, but today's relaxed
    // permissions or reporting flags cannot expose an older restricted record.
    return records.filter((r) => { const spec = asSpec(r.definition.definition);
      if (search && !spec.reporting.searchable) return false;
      try { this.access(actor, spec, 'read'); return true; }
      catch (error) { if (error instanceof ForbiddenException) return false; throw error; }
    }).map((r) => this.summary(r, this.pinnedStatusLabel(r, type.code)));
  }
  private pinnedStatusLabel(row: { status: string; workflowVersion: { definition: Prisma.JsonValue } }, typeCode: string) {
    const flow = workflowDefinition(row.workflowVersion.definition, `CUSTOM:${typeCode}`);
    return flow.statuses.find((state) => state.code === row.status)?.label ?? row.status;
  }
  private summary(row: ConfigDocument, statusLabel?: string) {
    return { id: row.id, typeId: row.typeId, versionId: row.versionId,
      workflowVersionId: row.workflowVersionId, number: row.number, status: row.status,
      statusLabel: statusLabel ?? row.status,
      revision: row.revision, issuedAt: row.issuedAt, createdAt: row.createdAt,
      updatedAt: row.updatedAt };
  }
  async detail(id: string, actor: AuthenticatedUser) {
    const { row, spec } = await this.record(this.prisma, id, actor, 'read');
    const fieldValues = await this.prisma.configFieldValue.findMany({ where: { scope: `CUSTOM:${row.type.code}`, recordId: id },
      include: { field: true } });
    const visible = fieldValues.filter((f) => this.canViewValue(f, actor, row.status));
    const links = Object.fromEntries(Object.entries(row.links as Record<string, unknown>).filter(([kind]) =>
      kind in LINK_SCOPES && (actor.isPrimaryAdmin ||
        actor.permissions.includes(LINK_SCOPES[kind as keyof typeof LINK_SCOPES]))));
    return { ...this.summary(row, this.pinnedStatusLabel(row, row.type.code)), typeCode: row.type.code,
      definition: { id: row.definition.id, version: row.definition.version, definition: spec },
      links, values: Object.fromEntries(visible.map((f) => [f.field.key, f.value])),
      fieldValues: visible.map((f) => ({ key: f.field.key, value: f.value,
        snapshot: f.fieldSnapshot, active: f.field.isActive })) };
  }
  publicRecord(row: ConfigDocument) { return this.summary(row); }
  private canViewValue(f: { field: ConfigField; fieldSnapshot: Prisma.JsonValue },
    actor: AuthenticatedUser, status: string) {
    // Both CURRENT and ORIGINAL visibility are required for historical values.
    const snapshot = f.fieldSnapshot as { viewPermission?: string | null; visibility?: Prisma.JsonValue };
    return canSeeField(f.field, actor, status) && canSeeField({ viewPermission: snapshot.viewPermission ?? null,
      visibility: snapshot.visibility ?? {} }, actor, status);
  }
  async updateRecord(id: string, input: unknown, actor: AuthenticatedUser) {
    const d = object(input, ['values', 'links', 'expectedRevision'], 'document update');
    if (d.values === undefined && d.links === undefined) throw new BadRequestException('No changes');
    const rev = this.revision(d.expectedRevision);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConfigDocument" WHERE "id" = ${id} FOR UPDATE`;
      const { row, spec } = await this.record(tx, id, actor, 'update');
      // A partial read projection must not let an editor silently remove a
      // relationship they cannot see when replacing the document's links.
      for (const kind of Object.keys(row.links as Record<string, unknown>)) {
        if (!(kind in LINK_SCOPES)) throw new ConflictException('Unknown historical relationship');
        requireOffice(actor, LINK_SCOPES[kind as keyof typeof LINK_SCOPES]);
      }
      const flow = await this.workflows.versionIn(tx, row.workflowVersionId);
      if (row.issuedAt || flow.statuses.find((s) => s.code === row.status)?.terminal) {
        throw new ConflictException('Terminal documents are immutable');
      }
      if (row.revision !== rev) throw new ConflictException('Document changed; reload before editing');
      const links = d.links === undefined ? row.links : (await this.linksIn(tx, d.links, spec, actor)).links;
      const values = d.values === undefined ? row.values : await this.fields.writeCustomIn(tx, row.type.code, id,
        d.values, actor, row.values as Record<string, unknown>, 'update', row.status);
      const updated = await tx.configDocument.update({ where: { id }, data: { links: json(links), values: json(values),
        revision: { increment: 1 }, updatedById: actor.id } });
      const stale = await tx.configApproval.findMany({ where: { scope: `CUSTOM:${row.type.code}`, recordId: id,
        status: { in: ['PENDING', 'APPROVED'] }, consumedAt: null }, select: { id: true, status: true } });
      for (const approval of stale) {
        await tx.configApproval.update({ where: { id: approval.id }, data: { status: 'EXPIRED', consumedAt: new Date() } });
        await this.audit.recordIn(tx, { action: 'configuration.approval.expired', entityType: 'ConfigApproval',
          entityId: approval.id, actorId: actor.id, actorEmail: actor.email,
          metadata: { recordId: id, previousStatus: approval.status, reason: 'Document changed' } });
      }
      await tx.configDocumentEvent.create({ data: { documentId: id, actorId: actor.id, kind: 'UPDATE',
        beforeData: json({ values: row.values, links: row.links, revision: row.revision }),
        afterData: json({ values, links, revision: updated.revision }) } });
      await this.audit.recordIn(tx, { action: 'configuration.document.update', entityType: 'ConfigDocument',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { revision: row.revision }, afterData: { revision: updated.revision } });
      return this.summary(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  private revision(value: unknown): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
      throw new BadRequestException('An expectedRevision is required to prevent stale changes');
    }
    return value;
  }
  private async issueSnapshot(tx: Tx, row: ConfigDocument, spec: DocumentSpec,
    actor: AuthenticatedUser, typeCode: string, statusLabel: string) {
    // Capture only currently approved company artwork; future deactivation
    // cannot replace its issue-time bytes when rendering the archived version.
    for (const [field, kind] of [['logoAssetId', 'LOGO'], ['letterheadAssetId', 'LETTERHEAD'],
      ['stampAssetId', 'STAMP'], ['signatureAssetId', 'SIGNATURE']] as const) {
      const assetId = spec.layout[field];
      if (assetId && !await tx.documentAsset.findFirst({ where: { id: assetId, kind,
        isApproved: true, deactivatedAt: null } })) throw new ConflictException('Selected artwork is no longer approved');
    }
    const [identity, values, linkData] = await Promise.all([
      tx.companySettings.findFirst({ select: { companyName: true, legalName: true,
        registrationNumber: true, taxNumber: true, address: true, city: true, country: true,
        phone: true, email: true, defaultCurrency: true } }),
      tx.configFieldValue.findMany({ where: { scope: `CUSTOM:${typeCode}`,
        recordId: row.id }, include: { field: true } }),
      this.linksIn(tx, row.links, spec, actor),
    ]);
    return { number: row.number, status: row.status, statusLabel, definitionVersionId: row.versionId,
      workflowVersionId: row.workflowVersionId, issuedAt: new Date().toISOString(),
      values: values.filter((f) => spec.layout.fields.includes(f.field.key))
        .map((f) => ({ key: f.field.key, value: f.value, snapshot: f.fieldSnapshot })),
      relationships: linkData.snapshots, identity, layout: spec.layout,
      warning: 'Additional configured office document — NOT an invoice, ledger, payment or release authorization. Official company template not supplied.' };
  }
  async transition(id: string, input: unknown, actor: AuthenticatedUser) {
    const d = object(input, ['to', 'expectedRevision', 'approvalId', 'reason'], 'transition');
    const to = code(d.to, 'target status');
    const revision = this.revision(d.expectedRevision);
    let reason = d.reason === undefined ? undefined : string(d.reason, 'exception reason', 1000);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ConfigDocument" WHERE "id" = ${id} FOR UPDATE`;
      const { row, spec } = await this.record(tx, id, actor, 'transition');
      if (row.revision !== revision) throw new ConflictException('Document changed; reload first');
      if (row.issuedAt) throw new ConflictException('Issued documents cannot be transitioned');
      const definition = await this.workflows.versionIn(tx, row.workflowVersionId);
      const rule = definition.transitions.find((t) => t.from === row.status && t.to === to);
      if (rule) await this.fields.assertConditionAccess(tx, `CUSTOM:${row.type.code}`, id, rule, actor, row.status);
      let approved: Awaited<ReturnType<typeof tx.configApproval.findUnique>> = null;
      let approvalId: string | null = null;
      if (d.approvalId !== undefined) {
        approvalId = string(d.approvalId, 'approval ID', 70);
        await tx.$queryRaw`SELECT "id" FROM "ConfigApproval" WHERE "id" = ${approvalId} FOR UPDATE`;
        approved = await tx.configApproval.findUnique({ where: { id: approvalId } });
        if (!approved || approved.recordId !== id || approved.scope !== `CUSTOM:${row.type.code}` ||
          approved.workflowVersionId !== row.workflowVersionId || approved.fromStatus !== row.status ||
          approved.toStatus !== to || approved.status !== 'APPROVED' || approved.consumedAt ||
          (approved.context as Record<string, unknown>).revision !== row.revision) {
          throw new ForbiddenException('Matching unconsumed approval required');
        }
        const recordedReason = (approved.context as Record<string, unknown>).exception_reason;
        if ((recordedReason !== undefined && typeof recordedReason !== 'string') ||
          (reason !== undefined && reason !== recordedReason)) {
          throw new ConflictException('Exception reason does not match approved request');
        }
        reason = typeof recordedReason === 'string' ? recordedReason : undefined;
      }
      const transition = assertTransition(definition, row.status, to, actor, {},
        row.values as Record<string, unknown>, reason);
      if (transition.approval && !approved) {
        const approval = await this.workflows.requestIn(tx, { workflowVersionId: row.workflowVersionId,
          scope: `CUSTOM:${row.type.code}`, recordId: id, from: row.status, to,
          context: { revision: row.revision }, fields: row.values as Record<string, unknown>,
          exceptionReason: reason }, actor);
        return { pendingApproval: approval, document: this.summary(row) };
      }
      if (!transition.approval && approved) throw new BadRequestException('Approval is not required here');
      if (transition.approval) {
        if (!approved || !approvalId) throw new ConflictException('A decided approval is required');
        this.access(actor, spec, 'approve');
        await tx.configApproval.update({ where: { id: approvalId }, data: { status: 'CONSUMED', consumedAt: new Date() } });
        await this.audit.recordIn(tx, { action: 'configuration.approval.consumed', entityType: 'ConfigApproval',
          entityId: approvalId, actorId: actor.id, actorEmail: actor.email,
          metadata: { scope: approved.scope, recordId: id, from: row.status, to } });
      }
      const target = definition.statuses.find((s) => s.code === to)!;
      if (target.issued) {
        await this.fields.assertRequiredCustom(tx, row.type.code, id);
        await this.linksIn(tx, row.links, spec, actor);
      }
      const snapshot = target.issued ? await this.issueSnapshot(tx, { ...row, status: to }, spec,
        actor, row.type.code, target.label) : null;
      const updated = await tx.configDocument.updateMany({ where: { id, status: row.status, revision },
        data: { status: to, revision: { increment: 1 }, updatedById: actor.id,
          ...(target.issued ? { issuedAt: new Date(), issueSnapshot: json(snapshot) } : {}) } });
      if (updated.count !== 1) throw new ConflictException('Document state changed');
      await tx.configDocumentEvent.create({ data: { documentId: id, actorId: actor.id, kind: 'TRANSITION',
        reason, approvalId: d.approvalId as string | undefined,
        beforeData: json({ status: row.status, revision }), afterData: json({ status: to, revision: revision + 1,
          issued: target.issued }) } });
      await this.audit.recordIn(tx, { action: 'configuration.document.transition', entityType: 'ConfigDocument',
        entityId: id, actorId: actor.id, actorEmail: actor.email,
        beforeData: { status: row.status }, afterData: { status: to },
        metadata: { approvalId: d.approvalId ?? null, reason: reason ?? null, workflowVersionId: row.workflowVersionId } });
      return { document: this.summary(await tx.configDocument.findUniqueOrThrow({ where: { id } })) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async approvals(id: string, actor: AuthenticatedUser) {
    const { row } = await this.record(this.prisma, id, actor, 'read');
    const flow = workflowDefinition(row.workflowVersion.definition, `CUSTOM:${row.type.code}`);
    const requests = await this.prisma.configApproval.findMany({ where: {
      scope: `CUSTOM:${row.type.code}`, recordId: id },
      select: { id: true, status: true, fromStatus: true, toStatus: true,
        requestedById: true, requestedAt: true, decidedById: true, decidedAt: true,
        decisionNote: true }, orderBy: { requestedAt: 'desc' }, take: 100 });
    const label = (status: string) => flow.statuses.find((state) => state.code === status)?.label ?? status;
    return requests.map((request) => ({ ...request,
      fromLabel: label(request.fromStatus), toLabel: label(request.toStatus) }));
  }
  async availableTransitions(id: string, actor: AuthenticatedUser) {
    const { row, spec } = await this.record(this.prisma, id, actor, 'read');
    if (row.issuedAt) return [];
    const definition = await this.workflows.versionIn(this.prisma, row.workflowVersionId);
    return definition.transitions.filter((t) => {
      if (t.from !== row.status) return false;
      try { this.access(actor, spec, 'transition'); requireOffice(actor, t.permission); return true; }
      catch (error) { if (error instanceof ForbiddenException) return false; throw error; }
    }).map((t) => ({ to: t.to, label: definition.statuses.find((s) => s.code === t.to)?.label ?? t.to,
      requiresApproval: !!t.approval, supportsException: !!t.exception }));
  }

  /** Internal renderer projection. Never return the raw issued snapshot through
   * an API: archive bytes are shared across viewers, so every viewer must hold
   * BOTH the pinned and the current field and linked-source permissions. */
  async outputSource(id: string, format: 'pdf' | 'print' | 'xlsx', actor: AuthenticatedUser) {
    const { row, spec } = await this.record(this.prisma, id, actor, 'render');
    for (const kind of Object.keys(row.links as Record<string, unknown>)) {
      if (!(kind in LINK_SCOPES)) throw new ConflictException('Unknown historical document relationship');
      requireOffice(actor, LINK_SCOPES[kind as keyof typeof LINK_SCOPES]);
    }
    const values = await this.prisma.configFieldValue.findMany({ where: { recordId: id,
      scope: `CUSTOM:${row.type.code}` }, include: { field: true } });
    for (const name of spec.layout.fields) {
      const value = values.find((v) => v.field.key === name);
      if (!value) continue;
      if (!this.canViewValue(value, actor, row.status)) throw new ForbiddenException('Output contains a restricted field');
      if (format === 'xlsx' && (!value.field.exportable ||
        (value.fieldSnapshot as Record<string, unknown>).exportable !== true)) {
        throw new ForbiddenException('Field is not authorized for spreadsheet export');
      }
    }
    return { row: this.summary(row, this.pinnedStatusLabel(row, row.type.code)),
      typeCode: row.type.code, spec, frozen: row.issueSnapshot,
      values: values.filter((v) => spec.layout.fields.includes(v.field.key))
        .map((v) => ({ key: v.field.key, value: v.value, snapshot: v.fieldSnapshot })),
      links: row.links };
  }
  async events(id: string, actor: AuthenticatedUser) {
    await this.record(this.prisma, id, actor, 'read');
    const events = await this.prisma.configDocumentEvent.findMany({ where: { documentId: id },
      orderBy: { createdAt: 'asc' }, take: 200 });
    // Audit before/after JSON can contain confidential fields: only the event
    // timeline is public under document read; audit:read reviews protected data.
    return events.map(({ id: eventId, kind, actorId, reason, approvalId, createdAt }) =>
      ({ id: eventId, kind, actorId, reason, approvalId, createdAt }));
  }
}
