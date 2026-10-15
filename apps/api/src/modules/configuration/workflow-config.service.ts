import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type ConfigApproval } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/types';
import { RELEASE_ORDER_ELIGIBILITY_POLICY } from '../delivery-release/release-order.policy';
import { assertTransition, type WorkflowDefinition,
  object, requireOffice, string, workflowDefinition } from './configuration.policy';
import { FieldConfigService, type Tx } from './field-config.service';
import { documentSpec, type DocumentSpec } from './configuration.policy';

const json = (value: unknown) => value as Prisma.InputJsonValue;
const isCustom = (s: string) => /^CUSTOM:[A-Z][A-Z0-9_]{0,39}$/.test(s);

@Injectable()
export class WorkflowConfigService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly fields: FieldConfigService) {}

  private checkedScope(value: string): string {
    if (value !== 'release-exception' && value !== 'invoice-correction' && !isCustom(value)) {
      throw new BadRequestException('Unsupported workflow scope');
    }
    return value;
  }
  async list(actor: AuthenticatedUser) {
    requireOffice(actor, 'configuration:read');
    return this.prisma.configWorkflow.findMany({ include: { versions: { orderBy: { version: 'desc' } } },
      orderBy: { scope: 'asc' }, take: 200 });
  }
  async create(scope: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'workflow:manage');
    this.checkedScope(scope);
    const definition = workflowDefinition(input, scope);
    return this.prisma.$transaction(async (tx) => {
      if (isCustom(scope)) {
        const docType = await tx.configDocumentType.findUnique({ where: { code: scope.slice(7) } });
        if (!docType || docType.isCore) throw new NotFoundException('Custom document type not found');
      }
      await this.assertRegisteredPermissions(tx, definition);
      const row = await tx.configWorkflow.create({ data: { scope, createdById: actor.id } });
      const version = await tx.configWorkflowVersion.create({ data: { workflowId: row.id, version: 1,
        definition: json(definition), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.workflow.create', entityType: 'ConfigWorkflow',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { scope, version: 1, definition } });
      return { ...row, versions: [version] };
    });
  }
  async addVersion(scope: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'workflow:manage');
    this.checkedScope(scope);
    const definition = workflowDefinition(input, scope);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.configWorkflow.findUnique({ where: { scope } });
      if (!row) throw new NotFoundException('Workflow not found');
      await tx.$queryRaw`SELECT "id" FROM "ConfigWorkflow" WHERE "id" = ${row.id} FOR UPDATE`;
      await this.assertRegisteredPermissions(tx, definition);
      const prior = await tx.configWorkflowVersion.findFirst({ where: { workflowId: row.id }, orderBy: { version: 'desc' } });
      const created = await tx.configWorkflowVersion.create({ data: { workflowId: row.id,
        version: (prior?.version ?? 0) + 1, definition: json(definition), createdById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.workflow.version', entityType: 'ConfigWorkflowVersion',
        entityId: created.id, actorId: actor.id, actorEmail: actor.email,
        afterData: { scope, version: created.version, definition } });
      return created;
    });
  }
  private async assertRegisteredPermissions(tx: Tx, d: WorkflowDefinition) {
    const codes = [...new Set(d.transitions.flatMap((t) => [t.permission, t.approval?.permission, t.exception?.permission]
      .filter((v): v is string => !!v)))];
    const present = await tx.permission.count({ where: { code: { in: codes } } });
    if (present !== codes.length) throw new BadRequestException('Workflow references an unknown permission');
  }
  async activate(scope: string, input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'workflow:manage');
    this.checkedScope(scope);
    const d = object(input, ['versionId', 'isActive'], 'workflow activation');
    if (typeof d.isActive !== 'boolean') throw new BadRequestException('isActive must be boolean');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.configWorkflow.findUnique({ where: { scope } });
      if (!row) throw new NotFoundException('Workflow not found');
      const version = d.versionId === undefined ? null : await tx.configWorkflowVersion.findUnique({
        where: { id: string(d.versionId, 'versionId', 70) } });
      if (version && version.workflowId !== row.id) throw new BadRequestException('Version belongs to another workflow');
      const currentVersionId = version?.id ?? row.currentVersionId;
      if (d.isActive && !currentVersionId) throw new ConflictException('Select a reviewed version to activate');
      const after = await tx.configWorkflow.update({ where: { id: row.id }, data: {
        currentVersionId, isActive: d.isActive as boolean, updatedById: actor.id } });
      await this.audit.recordIn(tx, { action: 'configuration.workflow.activate', entityType: 'ConfigWorkflow',
        entityId: row.id, actorId: actor.id, actorEmail: actor.email, beforeData: row, afterData: after });
      return after;
    });
  }

  /** An older instance/request keeps its exact immutable definition version. */
  async versionIn(tx: Tx, id: string) {
    const row = await tx.configWorkflowVersion.findUnique({ where: { id } });
    if (!row) throw new ConflictException('Pinned workflow version is unavailable');
    return workflowDefinition(row.definition, (await tx.configWorkflow.findUniqueOrThrow({ where: { id: row.workflowId } })).scope);
  }
  async activeIn(tx: Tx, scope: string) {
    this.checkedScope(scope);
    const row = await tx.configWorkflow.findUnique({ where: { scope } });
    if (!row?.isActive) return null;
    if (!row.currentVersionId) throw new ConflictException('Active workflow has no version');
    const version = await tx.configWorkflowVersion.findUnique({ where: { id: row.currentVersionId } });
    if (!version || version.workflowId !== row.id) throw new ConflictException('Workflow version does not belong to scope');
    return { id: version.id, definition: workflowDefinition(version.definition, scope) };
  }

  async requestIn(tx: Tx, params: { workflowVersionId: string; scope: string; recordId: string;
    from: string; to: string; context: Record<string, unknown>; fields?: Record<string, unknown>;
    exceptionReason?: string }, actor: AuthenticatedUser): Promise<ConfigApproval> {
    const definition = await this.versionIn(tx, params.workflowVersionId);
    const transition = assertTransition(definition, params.from, params.to, actor,
      params.context, params.fields ?? {}, params.exceptionReason);
    if (!transition.approval) throw new BadRequestException('Transition does not require an approval');
    const open = await tx.configApproval.findFirst({ where: { scope: params.scope, recordId: params.recordId,
      fromStatus: params.from, toStatus: params.to, status: { in: ['PENDING', 'APPROVED'] }, consumedAt: null },
      select: { id: true } });
    if (open) throw new ConflictException('An unconsumed request already exists');
    const row = await tx.configApproval.create({ data: { workflowVersionId: params.workflowVersionId,
      scope: params.scope, recordId: params.recordId, fromStatus: params.from, toStatus: params.to,
      context: json({ ...params.context,
        ...(params.exceptionReason ? { exception_reason: params.exceptionReason } : {}) }),
      requestedById: actor.id } });
    await this.audit.recordIn(tx, { action: 'configuration.approval.request', entityType: 'ConfigApproval',
      entityId: row.id, actorId: actor.id, actorEmail: actor.email,
      afterData: { scope: row.scope, recordId: row.recordId, from: row.fromStatus, to: row.toStatus,
        context: row.context, workflowVersionId: row.workflowVersionId } });
    return row;
  }
  private async lockApproval(tx: Tx, id: string): Promise<ConfigApproval> {
    await tx.$queryRaw`SELECT "id" FROM "ConfigApproval" WHERE "id" = ${id} FOR UPDATE`;
    const row = await tx.configApproval.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Approval request not found');
    return row;
  }
  async decideIn(tx: Tx, id: string, approve: boolean, actor: AuthenticatedUser,
    note?: string): Promise<ConfigApproval> {
    requireOffice(actor, 'workflow:approve');
    const row = await this.lockApproval(tx, id);
    if (row.status !== 'PENDING') throw new ConflictException('Approval request is already decided');
    if (row.scope === 'invoice-correction') {
      throw new ForbiddenException('Use the existing invoice correction approval endpoint');
    }
    const definition = await this.versionIn(tx, row.workflowVersionId);
    const context = row.context as Record<string, unknown>;
    const rejectTo = row.scope === 'release-exception' ? 'REJECTED'
      : definition.statuses.find((s) => s.code === 'REJECTED')?.code;
    if (!approve && !rejectTo) throw new BadRequestException('Workflow does not configure a rejection transition');
    const to = approve ? row.toStatus : rejectTo!;
    const fields: Record<string, unknown> = {};
    if (row.scope === 'release-exception') {
      requireOffice(actor, 'release:override'); // DEC-116 explicit owner grant or the owner themselves.
      const bill = await tx.billOfLading.findFirst({ where: { id: row.recordId, deletedAt: null }, select: { status: true } });
      if (bill?.status !== 'APPROVED') throw new ConflictException('B/L is not approved');
      if (approve && (await this.outstanding(tx, row.recordId)) !== context.outstanding) {
        throw new ConflictException('Outstanding amount changed; submit a new exception request');
      }
    } else if (isCustom(row.scope)) {
      const doc = await tx.configDocument.findUnique({ where: { id: row.recordId },
        include: { definition: true, type: true } });
      if (!doc || doc.status !== row.fromStatus || doc.workflowVersionId !== row.workflowVersionId ||
        doc.revision !== context.revision || row.scope !== `CUSTOM:${doc.type.code}`) {
        throw new ConflictException('Document changed; approval request is stale');
      }
      requireOffice(actor, 'config_document:approve', 'config_document:read');
      const spec = documentSpec(doc.definition.definition) as DocumentSpec;
      if (spec.permissions.read) requireOffice(actor, spec.permissions.read);
      if (spec.permissions.approve) requireOffice(actor, spec.permissions.approve);
      Object.assign(fields, doc.values as Record<string, unknown>);
      const rule = definition.transitions.find((t) => t.from === row.fromStatus && t.to === to);
      if (rule) await this.fields.assertConditionAccess(tx, row.scope, row.recordId, rule, actor, doc.status);
    } else throw new BadRequestException('Unsupported approval scope');
    const exceptionReason = approve && typeof context.exception_reason === 'string'
      ? context.exception_reason : undefined;
    const transition = assertTransition(definition, row.fromStatus, to, actor, context, fields, exceptionReason);
    if (approve) {
      if (!transition.approval) throw new ConflictException('Approval step is missing');
      requireOffice(actor, transition.approval.permission);
      if (transition.approval.distinctRequester && row.requestedById === actor.id && !actor.isPrimaryAdmin) {
        throw new ForbiddenException('Requester cannot approve their own request');
      }
    }
    const status = approve ? 'APPROVED' : 'REJECTED';
    const decided = await tx.configApproval.update({ where: { id }, data: {
      status, decidedAt: new Date(), decidedById: actor.id,
      decisionNote: note ? string(note, 'decision note', 1000) : null } });
    await this.audit.recordIn(tx, { action: `configuration.approval.${status.toLowerCase()}`,
      entityType: 'ConfigApproval', entityId: id, actorId: actor.id, actorEmail: actor.email,
      beforeData: { status: row.status }, afterData: { status, decidedById: actor.id, note: decided.decisionNote },
      metadata: { scope: row.scope, recordId: row.recordId, requestedById: row.requestedById } });
    return decided;
  }
  async decide(id: string, approve: boolean, actor: AuthenticatedUser, note?: string) {
    return this.prisma.$transaction((tx) => this.decideIn(tx, id, approve, actor, note));
  }
  async approvals(scope: string, recordId: string, actor: AuthenticatedUser) {
    this.checkedScope(scope);
    requireOffice(actor, 'workflow:read');
    if (scope === 'release-exception') requireOffice(actor, 'release:read');
    else if (scope === 'invoice-correction') requireOffice(actor, 'invoice:read');
    else requireOffice(actor, 'config_document:read');
    // Never disclose another actor's portal record through this generic endpoint.
    if (scope === 'release-exception') await recordExists(this.prisma, 'BillOfLading', recordId);
    else if (scope === 'invoice-correction') {
      if (!await this.prisma.invoiceCorrection.findUnique({ where: { id: recordId } })) throw new NotFoundException();
    } else {
      const doc = await this.prisma.configDocument.findUnique({ where: { id: recordId },
        include: { definition: true, type: true } });
      if (!doc || doc.type.isCore || scope !== `CUSTOM:${doc.type.code}` ||
        doc.definition.typeId !== doc.typeId) throw new NotFoundException();
      const spec = documentSpec(doc.definition.definition) as DocumentSpec;
      if (spec.permissions.read) requireOffice(actor, spec.permissions.read);
    }
    return this.prisma.configApproval.findMany({ where: { scope, recordId },
      orderBy: { requestedAt: 'desc' }, take: 100 });
  }

  async releasePolicy(actor: AuthenticatedUser) {
    requireOffice(actor, 'release:read');
    const flow = await this.activeIn(this.prisma, 'release-exception');
    return { extraApprovalRequiredForDelegates: !!flow,
      ownerMayApproveDirectly: true };
  }
  async pending(scope: string, actor: AuthenticatedUser) {
    this.checkedScope(scope);
    requireOffice(actor, 'workflow:approve');
    if (scope === 'release-exception') requireOffice(actor, 'release:override');
    else if (scope === 'invoice-correction') {
      throw new BadRequestException('Use the existing invoice correction approval screen');
    } else requireOffice(actor, 'config_document:approve', 'config_document:read');
    const rows = await this.prisma.configApproval.findMany({ where: { scope, status: 'PENDING' },
      orderBy: { requestedAt: 'asc' }, take: 100 });
    if (scope === 'release-exception') return rows;
    const allowed: ConfigApproval[] = [];
    for (const row of rows) {
      const record = await this.prisma.configDocument.findUnique({ where: { id: row.recordId },
        include: { definition: true, type: true } });
      if (!record || record.type.isCore || row.scope !== `CUSTOM:${record.type.code}` ||
        record.definition.typeId !== record.typeId) continue;
      const definition = documentSpec(record.definition.definition) as DocumentSpec;
      try {
        if (definition.permissions?.read) requireOffice(actor, definition.permissions.read);
        if (definition.permissions?.approve) requireOffice(actor, definition.permissions.approve);
        allowed.push(row);
      } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    }
    return allowed;
  }

  /** Original financial policy still runs inside ReleaseOrder.createRelease.
   * This optional approval is an EXTRA requirement for delegates, not a substitute
   * for force + reason + release:override + audit. The owner remains direct. */
  async requestRelease(input: unknown, actor: AuthenticatedUser) {
    requireOffice(actor, 'release:create', 'release:override');
    const d = object(input, ['billOfLadingId', 'paymentState', 'reason'], 'release exception request');
    const billId = string(d.billOfLadingId, 'B/L ID', 70);
    const reason = string(d.reason, 'release exception reason', 1000);
    if (!['PAID', 'PARTIAL', 'UNPAID'].includes(d.paymentState as string)) throw new BadRequestException('Invalid payment state');
    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.billOfLading.findFirst({ where: { id: billId, deletedAt: null }, select: { status: true } });
      if (bill?.status !== 'APPROVED') throw new ConflictException('Only approved B/Ls may request release');
      const outstanding = await this.outstanding(tx, billId);
      if (new Prisma.Decimal(outstanding).lessThanOrEqualTo(RELEASE_ORDER_ELIGIBILITY_POLICY.paymentTolerance)) {
        throw new BadRequestException('No financial release exception is needed');
      }
      const active = await this.activeIn(tx, 'release-exception');
      if (!active) throw new ConflictException('No release exception workflow is active; use the original authorized override');
      const context = { outstanding, payment_state: d.paymentState as string, reason, reason_length: reason.length };
      const prior = await tx.configApproval.findFirst({ where: { scope: 'release-exception', recordId: billId,
        fromStatus: 'REQUESTED', toStatus: 'APPROVED', status: { in: ['PENDING', 'APPROVED'] }, consumedAt: null } });
      if (prior && prior.requestedById === actor.id) {
        const old = prior.context as Record<string, unknown>;
        if (prior.workflowVersionId !== active.id || old.outstanding !== outstanding ||
          old.payment_state !== context.payment_state || old.reason !== reason) {
          await tx.configApproval.update({ where: { id: prior.id }, data: { status: 'EXPIRED', consumedAt: new Date() } });
          await this.audit.recordIn(tx, { action: 'configuration.approval.expired', entityType: 'ConfigApproval',
            entityId: prior.id, actorId: actor.id, actorEmail: actor.email,
            metadata: { scope: 'release-exception', recordId: billId, reason: 'Request context changed' } });
        }
      }
      return this.requestIn(tx, { workflowVersionId: active.id, scope: 'release-exception', recordId: billId,
        from: 'REQUESTED', to: 'APPROVED', context }, actor);
    });
  }
  private async outstanding(tx: Tx, billId: string): Promise<string> {
    const invoices = await tx.invoice.findMany({ where: { billOfLadingId: billId, deletedAt: null, status: 'ISSUED' },
      select: { totalAmount: true, paidAmount: true } });
    let remaining = new Prisma.Decimal(0);
    for (const invoice of invoices) remaining = remaining.plus(invoice.totalAmount.minus(invoice.paidAmount));
    return Prisma.Decimal.max(remaining, new Prisma.Decimal(0)).toFixed(2);
  }
  async consumeRelease(tx: Tx, billId: string, paymentState: string, reason: string,
    outstanding: string, actor: AuthenticatedUser | null): Promise<string | null> {
    const active = await this.activeIn(tx, 'release-exception');
    if (!active) return null;
    if (!actor) throw new ForbiddenException('Authenticated actor required for configured release approval');
    if (actor.isPrimaryAdmin) return null; // DEC-116 owner acts directly.
    requireOffice(actor, 'release:override');
    const request = await tx.configApproval.findFirst({ where: { scope: 'release-exception', recordId: billId,
      fromStatus: 'REQUESTED', toStatus: 'APPROVED', requestedById: actor.id,
      status: 'APPROVED', consumedAt: null }, orderBy: { requestedAt: 'desc' } });
    if (!request) throw new ForbiddenException('An approved release exception request is required');
    const row = await this.lockApproval(tx, request.id);
    const ctx = row.context as Record<string, unknown>;
    if (row.status !== 'APPROVED' || row.consumedAt || row.workflowVersionId !== active.id ||
      ctx.outstanding !== outstanding || ctx.payment_state !== paymentState || ctx.reason !== reason.trim()) {
      throw new ConflictException('Release exception approval is stale or does not match this release');
    }
    await tx.configApproval.update({ where: { id: row.id }, data: { status: 'CONSUMED', consumedAt: new Date() } });
    await this.audit.recordIn(tx, { action: 'configuration.approval.consumed', entityType: 'ConfigApproval',
      entityId: row.id, actorId: actor.id, actorEmail: actor.email,
      metadata: { scope: row.scope, recordId: billId, outstanding, reason, paymentState } });
    return row.id;
  }

  /** Existing correction settings AND the original approve/reject permissions
   * stay authoritative. When active, the configured approval is an extra gate. */
  async requestCorrectionIn(tx: Tx, correctionId: string, reason: string, actor: AuthenticatedUser) {
    const active = await this.activeIn(tx, 'invoice-correction');
    if (!active) return false;
    // A requester needs invoice:correct, NOT invoice:approve_correction. The
    // latter is checked only when a different approver makes the decision.
    requireOffice(actor, 'invoice:correct');
    const context = { reason, reason_length: reason.length };
    const request = await tx.configApproval.create({ data: { workflowVersionId: active.id,
      scope: 'invoice-correction', recordId: correctionId, fromStatus: 'PENDING_APPROVAL',
      toStatus: 'APPLIED', context: json(context), requestedById: actor.id } });
    await this.audit.recordIn(tx, { action: 'configuration.approval.request', entityType: 'ConfigApproval',
      entityId: request.id, actorId: actor.id, actorEmail: actor.email,
      afterData: { scope: request.scope, recordId: correctionId, workflowVersionId: active.id } });
    return true;
  }
  async decideCorrectionIn(tx: Tx, correctionId: string, approve: boolean, reason: string,
    actor: AuthenticatedUser) {
    const request = await tx.configApproval.findFirst({ where: { scope: 'invoice-correction', recordId: correctionId,
      status: 'PENDING' } });
    if (!request) return; // older requests predate optional configuration.
    const row = await this.lockApproval(tx, request.id);
    const correction = await tx.invoiceCorrection.findUnique({ where: { id: correctionId } });
    if (!correction || correction.status !== 'PENDING_APPROVAL' || correction.requestedById !== row.requestedById) {
      throw new ConflictException('Correction request changed');
    }
    const definition = await this.versionIn(tx, row.workflowVersionId);
    const to = approve ? 'APPLIED' : 'REJECTED';
    const transition = assertTransition(definition, 'PENDING_APPROVAL', to, actor,
      { reason: correction.reason, reason_length: correction.reason.length });
    if (approve) {
      if (!transition.approval) throw new ConflictException('Correction approval step missing');
      requireOffice(actor, transition.approval.permission);
      if (row.requestedById === actor.id && !actor.isPrimaryAdmin) throw new ForbiddenException('Requester cannot approve own correction');
    }
    const decidedAt = new Date();
    if (approve) {
      // The database forbids PENDING -> CONSUMED: record the immutable approval
      // decision first, then consume it in this SAME correction transaction.
      await tx.configApproval.update({ where: { id: row.id }, data: {
        status: 'APPROVED', decidedAt, decidedById: actor.id, decisionNote: null } });
      await tx.configApproval.update({ where: { id: row.id }, data: {
        status: 'CONSUMED', consumedAt: decidedAt } });
    } else {
      await tx.configApproval.update({ where: { id: row.id }, data: {
        status: 'REJECTED', decidedAt, decidedById: actor.id, decisionNote: reason } });
    }
    await this.audit.recordIn(tx, { action: `configuration.approval.${approve ? 'consumed' : 'rejected'}`,
      entityType: 'ConfigApproval', entityId: row.id, actorId: actor.id, actorEmail: actor.email,
      metadata: { scope: 'invoice-correction', correctionId, decidedById: actor.id, reason } });
  }
}

async function recordExists(tx: Tx, kind: 'BillOfLading', id: string) {
  if (kind === 'BillOfLading' && !await tx.billOfLading.findFirst({ where: { id, deletedAt: null } })) {
    throw new NotFoundException('B/L not found');
  }
}
