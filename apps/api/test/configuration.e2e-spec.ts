import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma, type ConfigField } from '@prisma/client';
import type { AuthenticatedUser } from '../src/common/auth/types';
import { FieldConfigService } from '../src/modules/configuration/field-config.service';
import { WorkflowConfigService } from '../src/modules/configuration/workflow-config.service';
import { DocumentConfigService } from '../src/modules/configuration/document-config.service';
import { CoreLabelService } from '../src/modules/configuration/core-label.service';
// A test-only require keeps the external seed module out of Nest's emitted
// sources; a TS import here would move dist/src/main.js into dist/apps/api/src.
const { seedPhase9Permissions, phase9Permissions } = require('../../../prisma/seed/phase9-permissions') as {
  seedPhase9Permissions: (tx: any) => Promise<{ created: number; granted: number }>;
  phase9Permissions: { code: string }[];
};
import { ConfigDocumentOutputService } from '../src/modules/configuration/config-document-output.service';
import { assertTransition, customTypeCode, documentSpec, fieldSpec, requireOffice,
  workflowDefinition } from '../src/modules/configuration/configuration.policy';

/** Fully in-memory Phase 9 lifecycle and negative bypass cases. Neither this
 * suite nor its fixtures open a database, delete business data or seed a row.
 * DB migration execution still needs a separately inspected isolated database. */
const owner: AuthenticatedUser = { id: 'owner', email: 'owner@example.test', isPrimaryAdmin: true,
  roles: [], permissions: [] };
const manager: AuthenticatedUser = { id: 'manager', email: 'manager@example.test', isPrimaryAdmin: false,
  roles: [], permissions: ['release:read', 'release:create', 'release:override', 'workflow:approve',
    'config_document:read', 'config_document:create', 'config_document:update',
    'config_document:transition', 'config_document:approve', 'config_document:render',
    'document:render', 'customer:read', 'customer:update', 'configuration:value_write'] };
const portal: AuthenticatedUser = { ...manager, id: 'portal', portalAgentId: 'agent',
  permissions: [...manager.permissions, 'configuration:manage'] };
const audit = { recordIn: jest.fn().mockResolvedValue(undefined) } as any;
const field = (kind: ConfigField['kind'] = 'SINGLE_SELECT'): ConfigField => ({ id: 'field',
  scope: 'Customer', key: 'city_choice', label: 'City', kind, optionListId: 'list', required: false,
  rules: {}, displayLocation: 'detail', sortOrder: 0, visibility: {}, viewPermission: null,
  editPermission: null, searchable: true, filterable: true, reportable: true, exportable: true,
  effectiveFrom: new Date('2026-01-01T00:00:00Z'), effectiveUntil: null, isActive: true, version: 1,
  createdById: 'owner', updatedById: null, createdAt: new Date(), updatedAt: new Date() });
const customDefinition = () => ({ statuses: [
  { code: 'DRAFT', label: 'Draft (technical)', terminal: false },
  { code: 'REVIEW', label: 'Review (technical)' },
  { code: 'ISSUED', label: 'Issued (technical)', terminal: true, issued: true },
], transitions: [
  { from: 'DRAFT', to: 'REVIEW', permission: 'config_document:transition' },
  { from: 'REVIEW', to: 'ISSUED', permission: 'config_document:transition',
    approval: { permission: 'config_document:approve', distinctRequester: true } },
] });
const coreRelease = () => ({ statuses: [
  { code: 'REQUESTED', label: 'Requested (technical)' },
  { code: 'APPROVED', label: 'Approved (technical)' },
  { code: 'REJECTED', label: 'Rejected (technical)' },
], transitions: [
  { from: 'REQUESTED', to: 'APPROVED', permission: 'release:override',
    approval: { permission: 'release:override', distinctRequester: true } },
  { from: 'REQUESTED', to: 'REJECTED', permission: 'release:override' },
] });
const coreCorrection = () => ({ statuses: [
  { code: 'PENDING_APPROVAL', label: 'Pending (technical)' },
  { code: 'APPLIED', label: 'Applied (technical)' },
  { code: 'REJECTED', label: 'Rejected (technical)' },
], transitions: [
  { from: 'PENDING_APPROVAL', to: 'APPLIED', permission: 'invoice:approve_correction',
    approval: { permission: 'invoice:approve_correction', distinctRequester: true } },
  { from: 'PENDING_APPROVAL', to: 'REJECTED', permission: 'invoice:approve_correction' },
] });
const customSpec = () => ({ name: 'Additional certificate', category: 'Operations',
  numbering: { prefix: 'CERT', padding: 5, period: 'YYYY' }, relationships: ['Customer'],
  layout: { title: 'Additional certificate', fields: ['city_choice'] } });

beforeEach(() => audit.recordIn.mockClear());

describe('Phase 9 add-only permission bootstrap (in memory)', () => {
  it('registers only new Phase 9 codes for ADMIN, is idempotent, and rejects semantic conflicts', async () => {
    const permissions = new Map<string, { id: string; code: string; module: string; action: string }>();
    const grants = new Set<string>();
    const tx = { role: { findUnique: jest.fn(async () => ({ id: 'admin-role', deletedAt: null })) },
      permission: { findUnique: jest.fn(async ({ where }: any) => permissions.get(where.code) ?? null),
        create: jest.fn(async ({ data }: any) => { const row = { ...data, id: `id-${data.code}` };
          permissions.set(data.code, row); return row; }) },
      rolePermission: { findUnique: jest.fn(async ({ where }: any) =>
        grants.has(where.roleId_permissionId.permissionId) ? { roleId: 'admin-role' } : null),
        create: jest.fn(async ({ data }: any) => { grants.add(data.permissionId); return data; }) } };
    expect(await seedPhase9Permissions(tx as any)).toEqual({ created: phase9Permissions.length,
      granted: phase9Permissions.length });
    expect(await seedPhase9Permissions(tx as any)).toEqual({ created: 0, granted: 0 });
    expect(permissions.size).toBe(phase9Permissions.length);
    permissions.get('workflow:manage')!.action = 'override';
    await expect(seedPhase9Permissions(tx as any)).rejects.toThrow('different semantics');
    tx.role.findUnique.mockResolvedValueOnce({ id: 'admin-role', deletedAt: new Date() } as any);
    await expect(seedPhase9Permissions(tx as any)).rejects.toThrow('Active ADMIN role is missing');
  });
});

describe('Phase 9 configuration: controls that cannot be configured away', () => {
  it('rejects a core numbering, permission or template override, protected type impersonation and fields shadowing money', () => {
    expect(() => documentSpec({ name: 'Invoice', category: 'Core', numbering: { prefix: 'FAKE' } }, true))
      .toThrow(BadRequestException);
    expect(() => customTypeCode('INVOICE')).toThrow(BadRequestException);
    expect(() => customTypeCode('RELEASE_ORDER')).toThrow(BadRequestException);
    expect(() => documentSpec({ ...customSpec(), numbering: { prefix: 'INV-NEW', padding: 5, period: 'YYYY' } }))
      .toThrow(BadRequestException);
    expect(() => documentSpec({ ...customSpec(), numbering: { prefix: 'INVOICE', padding: 5, period: 'YYYY' } }))
      .toThrow(BadRequestException);
    expect(() => fieldSpec({ scope: 'Invoice', key: 'total_amount', label: 'Fake amount', kind: 'NUMBER' }))
      .toThrow(BadRequestException);
    expect(() => fieldSpec({ scope: 'Invoice', key: 'extra', label: 'Extra', kind: 'TEXT',
      rules: { pattern: '.*' } })).toThrow(BadRequestException);
    expect(() => fieldSpec({ scope: 'Ledger', key: 'extra', label: 'Extra', kind: 'TEXT' }))
      .toThrow(BadRequestException);
  });
  it('rejects core workflow bypasses, self-approval configured for delegates, extra statuses and issued shortcuts', () => {
    expect(() => workflowDefinition({ ...coreRelease(), statuses: [{ code: 'APPROVED', label: 'Fake' }] },
      'release-exception')).toThrow(BadRequestException);
    expect(() => workflowDefinition({ ...coreRelease(), transitions: [coreRelease().transitions[0]] },
      'release-exception')).toThrow(BadRequestException);
    const weakRelease = coreRelease();
    weakRelease.transitions[0].approval!.distinctRequester = false;
    expect(() => workflowDefinition(weakRelease, 'release-exception')).toThrow(BadRequestException);
    const weakCorrection = coreCorrection();
    weakCorrection.transitions[0].permission = 'dashboard:read';
    expect(() => workflowDefinition(weakCorrection, 'invoice-correction')).toThrow(BadRequestException);
    const shortcut = customDefinition();
    shortcut.transitions.push({ from: 'DRAFT', to: 'ISSUED', permission: 'config_document:transition' } as any);
    expect(() => workflowDefinition(shortcut, 'CUSTOM:CERTIFICATE')).toThrow(BadRequestException);
    expect(() => workflowDefinition({ ...customDefinition(), transitions: [{ from: 'DRAFT', to: 'DRAFT',
      permission: 'config_document:transition' }] }, 'CUSTOM:CERTIFICATE')).toThrow(BadRequestException);
  });
  it('enforces conditions and transition permissions without evaluating code or skipping approvals', () => {
    const definition = workflowDefinition(customDefinition(), 'CUSTOM:CERTIFICATE');
    expect(() => assertTransition(definition, 'DRAFT', 'ISSUED', manager)).toThrow(BadRequestException);
    const restricted = workflowDefinition({ statuses: customDefinition().statuses,
      transitions: [{ from: 'DRAFT', to: 'REVIEW', permission: 'config_document:transition',
        conditions: [{ source: 'field', key: 'city_choice', op: 'EQ', value: 'accepted' }],
        exception: { permission: 'config_document:exception', reasonRequired: true } }] }, 'CUSTOM:CERTIFICATE');
    expect(() => workflowDefinition({ statuses: [{ code: 'DRAFT', label: 'Draft' },
      { code: 'REVIEW', label: 'Review' }], transitions: [{ from: 'DRAFT', to: 'REVIEW',
      permission: 'config_document:transition', conditions: [
        { source: 'context', key: 'outstanding', op: 'PRESENT' }] }] }, 'CUSTOM:CERTIFICATE'))
      .toThrow('Custom document conditions must reference configured fields');
    expect(() => assertTransition(restricted, 'DRAFT', 'REVIEW', manager, {}, { city_choice: 'no' }))
      .toThrow(ForbiddenException);
    expect(() => assertTransition(restricted, 'DRAFT', 'REVIEW', manager, {}, { city_choice: 'no' }, 'manual'))
      .toThrow(ForbiddenException); // no explicit exception grant
    expect(assertTransition(restricted, 'DRAFT', 'REVIEW', owner, {}, { city_choice: 'no' }, 'manual'))
      .toBeDefined(); // exception can waive only extra custom conditions
  });
  it('keeps B/L status codes fixed while administrators audit only owner-supplied display labels', async () => {
    const row = { code: 'APPROVED', label: 'APPROVED' };
    const db = { blLifecycleLabel: { findMany: jest.fn(async () => [row]),
      findUnique: jest.fn(async () => row), upsert: jest.fn(async ({ update }: any) => ({ ...row, ...update })) },
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(db) };
    const service = new CoreLabelService(db as any, audit);
    const fallback = await service.billLabels({ ...manager, permissions: ['bill:read'] });
    expect(fallback.find((item) => item.code === 'DRAFT')?.technicalFallback).toBe(true);
    expect(fallback.find((item) => item.code === 'APPROVED')?.technicalFallback).toBe(true);
    await expect(service.billLabels({ ...manager, permissions: [] })).rejects.toThrow(ForbiddenException);
    await expect(service.billLabels(portal)).rejects.toThrow(ForbiddenException);
    await expect(service.setBillLabel('APPROVED', 'Client-confirmed wording', manager))
      .rejects.toThrow(ForbiddenException);
    await expect(service.setBillLabel('CUSTOM', 'Pretend status', owner))
      .rejects.toThrow(BadRequestException);
    const saved = await service.setBillLabel('APPROVED', 'Client-confirmed wording', owner);
    expect(saved.label).toBe('Client-confirmed wording');
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.bill_label.update' }));
  });
  it('never allows portal principals to use office permissions, even with a mistaken grant', () => {
    expect(() => requireOffice(portal, 'release:override')).toThrow(ForbiddenException);
    expect(() => requireOffice(manager, 'configuration:manage')).toThrow(ForbiddenException);
    expect(() => requireOffice(owner, 'configuration:manage')).not.toThrow();
  });
});

describe('managed options and field history without a database', () => {
  const first = { id: 'opt-a', listId: 'list', code: 'CITY_A', label: 'Original city',
    isActive: true, list: { isActive: true } };
  let opt = { ...first, list: { ...first.list } };
  const tx = { configOption: { findMany: jest.fn(async ({ where }: any) =>
    where.id.in.includes(opt.id) ? [opt] : []) } };
  const fields = new FieldConfigService({} as any, audit);
  beforeEach(() => { opt = { ...first, list: { ...first.list } }; tx.configOption.findMany.mockClear(); });
  it('snapshots original labels; rename/deactivation cannot rewrite existing values or permit new use', async () => {
    const def = field();
    const initial = await fields.validateValue(tx as any, def, opt.id);
    expect(initial.snapshot.options).toEqual([{ id: 'opt-a', code: 'CITY_A', label: 'Original city' }]);
    opt.label = 'Renamed city'; opt.isActive = false;
    await expect(fields.validateValue(tx as any, def, opt.id)).rejects.toThrow(ConflictException);
    const old = { value: opt.id, fieldSnapshot: initial.snapshot } as any;
    const retained = await fields.validateValue(tx as any, def, opt.id, old);
    expect(retained.snapshot.options).toEqual(initial.snapshot.options);
    expect(initial.snapshot.options).toEqual([{ id: 'opt-a', code: 'CITY_A', label: 'Original city' }]);
    opt.list.isActive = false;
    await expect(fields.validateValue(tx as any, def, opt.id)).rejects.toThrow(ConflictException);
    def.isActive = false;
    await expect(fields.validateValue(tx as any, def, opt.id, old)).rejects.toThrow(ConflictException);
  });
  it('preserves retained selections in a multi-select but refuses any newly inactive ID', async () => {
    const def = field('MULTI_SELECT');
    const initial = await fields.validateValue(tx as any, def, ['opt-a']);
    opt.isActive = false;
    await expect(fields.validateValue(tx as any, def, ['opt-a'], { value: ['opt-a'],
      fieldSnapshot: initial.snapshot } as any)).resolves.toMatchObject({ value: ['opt-a'] });
    await expect(fields.validateValue(tx as any, def, ['opt-a'])).rejects.toThrow(ConflictException);
  });
  it('makes deactivation revisioned and denies relaxing view permissions on saved values', async () => {
    let def: ConfigField = { ...field('TEXT'), optionListId: null, viewPermission: 'salary:read' };
    const prisma = { $transaction: async (cb: (client: unknown) => Promise<unknown>) => cb(mockTx),
      };
    const mockTx = { $queryRaw: jest.fn(), configField: { findUnique: jest.fn(async () => def),
      update: jest.fn(async ({ data }: any) => { def = { ...def, ...data }; return def; }) },
      configFieldValue: { count: jest.fn(async () => 1) }, configFieldRevision: { create: jest.fn() },
      permission: { findUnique: jest.fn(async () => ({ id: 'perm' })) }, role: { count: jest.fn(async () => 0) } };
    const service = new FieldConfigService(prisma as any, audit);
    await expect(service.updateField(def.id, { viewPermission: null }, owner)).rejects.toThrow(ConflictException);
    const row = await service.updateField(def.id, { isActive: false, label: 'New label' }, owner);
    expect(row.version).toBe(2); expect(row.isActive).toBe(false);
    expect(mockTx.configFieldRevision.create).toHaveBeenCalledTimes(1);
    expect(audit.recordIn).toHaveBeenCalledTimes(1);
  });
  it('intersects report/export grants and current + saved flags, hiding retired or restricted values', async () => {
    const definition = { ...field('TEXT'), optionListId: null, key: 'gate_note' };
    const prisma = { configField: { findUnique: jest.fn(async () => definition) },
      configFieldValue: { findMany: jest.fn(async () => [
        { recordId: 'customer-1', value: 'public', fieldSnapshot: { reportable: true, exportable: true,
          visibility: {}, viewPermission: null } },
        { recordId: 'customer-2', value: 'originally private', fieldSnapshot: { reportable: false,
          exportable: false, visibility: {}, viewPermission: null } },
        { recordId: 'customer-3', value: 'restricted', fieldSnapshot: { reportable: true,
          exportable: true, visibility: {}, viewPermission: 'salary:read' } },
      ]) }, customer: { findFirst: jest.fn(async () => ({ id: 'present' })) } };
    const service = new FieldConfigService(prisma as any, audit);
    const reporter = { ...manager, permissions: [...manager.permissions, 'report:read', 'report:export'] };
    await expect(service.search('Customer', 'gate_note', '', manager, 'reportable'))
      .rejects.toThrow(ForbiddenException);
    expect((await service.search('Customer', 'gate_note', '', reporter, 'reportable')).items)
      .toEqual([expect.objectContaining({ recordId: 'customer-1' })]);
    expect((await service.search('Customer', 'gate_note', '', reporter, 'exportable')).items)
      .toEqual([expect.objectContaining({ recordId: 'customer-1' })]);
    await expect(service.search('Customer', 'gate_note', '', reporter, 'searchable', '0'))
      .rejects.toThrow(BadRequestException);
    definition.exportable = false;
    await expect(service.search('Customer', 'gate_note', '', reporter, 'exportable'))
      .rejects.toThrow('not enabled');
  });
  it('writes R/O fields only on creation with explicit grants, before its mandatory requirement check', async () => {
    const releaseField = { ...field('TEXT'), scope: 'ReleaseOrder', key: 'gate_note',
      label: 'Gate note', optionListId: null, required: true };
    let saved: any = null;
    const tx = { configField: { findMany: jest.fn(async ({ where }: any) =>
      where.required ? [releaseField] : [releaseField]) },
      configFieldValue: { findUnique: jest.fn(async () => saved), upsert: jest.fn(async ({ create }: any) => {
        saved = { id: 'value-1', ...create }; return saved;
      }) }, configFieldValueRevision: { create: jest.fn() } };
    await expect(fields.writeNewReleaseIn(tx as any, 'release-1', {}, manager))
      .rejects.toThrow(ConflictException);
    await expect(fields.writeNewReleaseIn(tx as any, 'release-1', { gate_note: 'Cleared' },
      { ...manager, permissions: ['release:create'] })).rejects.toThrow(ForbiddenException);
    await fields.writeNewReleaseIn(tx as any, 'release-1', { gate_note: 'Cleared' }, manager);
    expect(saved.value).toBe('Cleared');
    expect(tx.configFieldValueRevision.create).toHaveBeenCalledTimes(1);
    expect(audit.recordIn).toHaveBeenCalledTimes(1);
    await expect(fields.writeValues('ReleaseOrder', 'release-1', { values: { gate_note: 'changed' } },
      manager)).rejects.toThrow(ForbiddenException); // no release:update
    const restricted = new FieldConfigService({ $transaction: async (cb: any) =>
      cb({ releaseOrder: { findFirst: async () => ({ status: 'ISSUED' }) } }) } as any, audit);
    await expect(restricted.writeValues('ReleaseOrder', 'release-1', { values: { gate_note: 'changed' } },
      { ...manager, permissions: [...manager.permissions, 'release:update', 'release:read'] }))
      .rejects.toThrow(ConflictException); // even granted editors cannot mutate issued R/Os
  });
  it('projects record-scoped fields to ordinary readers but not unauthorized or portal actors', async () => {
    const row = { ...field('TEXT'), optionListId: null };
    const saved: any = { fieldId: row.id, recordId: 'customer-1', value: 'Historical value',
      fieldSnapshot: { label: 'Original label', viewPermission: 'salary:read', visibility: {},
        options: [], reportable: false } };
    const prisma = { customer: { findFirst: jest.fn(async () => ({ id: 'customer-1' })) },
      configField: { findMany: jest.fn(async () => [{ ...row, values: [saved], optionList: null }]) } };
    const service = new FieldConfigService(prisma as any, audit);
    const viewer = { ...manager, permissions: ['customer:read', 'salary:read'] }; // no configuration:read
    expect((await service.values('Customer', 'customer-1', viewer))[0].value.value)
      .toBe('Historical value');
    expect(await service.values('Customer', 'customer-1',
      { ...viewer, permissions: ['customer:read'] })).toEqual([]);
    await expect(service.values('Customer', 'customer-1', { ...viewer, permissions: [] }))
      .rejects.toThrow(ForbiddenException);
    await expect(service.values('Customer', 'customer-1', { ...viewer, portalAgentId: 'agent' }))
      .rejects.toThrow(ForbiddenException);
  });
  it('guards required sidecars on actual invoice and B/L issuance, never changes core money', async () => {
    const def = { ...field('TEXT'), required: true };
    const tx = { configField: { findMany: async () => [def] },
      configFieldValue: { findUnique: jest.fn(async () => null) } };
    await expect(fields.assertRequiredAtIssue(tx as any, 'Invoice', 'inv-1'))
      .rejects.toThrow('Required custom field');
    await expect(fields.assertRequiredAtIssue(tx as any, 'BillOfLading', 'bill-1'))
      .rejects.toThrow(ConflictException);
    tx.configFieldValue.findUnique.mockResolvedValue({ value: 'filled' } as any);
    await expect(fields.assertRequiredAtIssue(tx as any, 'Invoice', 'inv-1')).resolves.toBeUndefined();
  });
});

describe('approval lifecycle: pinned definition, separated authority and one-time use', () => {
  const releaseDefinition = workflowDefinition(coreRelease(), 'release-exception');
  const correctionDefinition = workflowDefinition(coreCorrection(), 'invoice-correction');
  const request = () => ({ id: 'approval-1', scope: 'release-exception', recordId: 'bill-1',
    workflowVersionId: 'version-1', fromStatus: 'REQUESTED', toStatus: 'APPROVED',
    requestedById: manager.id, status: 'PENDING', consumedAt: null, decisionNote: null,
    context: { outstanding: '80.00', payment_state: 'PARTIAL', reason: 'Owner-authorized exception',
      reason_length: 26 } });
  const fake = () => {
    let row: any = request();
    const tx = { $queryRaw: jest.fn(), configApproval: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.requestedById && where.requestedById !== row.requestedById) return null;
        if (where.status === 'APPROVED') return row.status === 'APPROVED' && !row.consumedAt ? row : null;
        if (where.status === 'PENDING') return row.status === 'PENDING' ? row : null;
        return ['PENDING', 'APPROVED'].includes(row.status) && !row.consumedAt ? row : null;
      }), findUnique: jest.fn(async () => row), create: jest.fn(async ({ data }: any) => {
        row = { ...request(), ...data }; return row;
      }), update: jest.fn(async ({ data }: any) => { row = { ...row, ...data }; return row; }) },
      billOfLading: { findFirst: jest.fn(async () => ({ status: 'APPROVED' })) },
      invoice: { findMany: jest.fn(async () => [{ totalAmount: new Prisma.Decimal('100.00'),
        paidAmount: new Prisma.Decimal('20.00') }]) },
      invoiceCorrection: { findUnique: jest.fn(async () => ({ status: 'PENDING_APPROVAL',
        requestedById: manager.id, reason: 'Correction note' })) },
    };
    const prisma = { ...tx, $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx) };
    const service = new WorkflowConfigService(prisma as any, audit, {} as any);
    jest.spyOn(service, 'activeIn').mockImplementation(async (_, scope) => ({ id: 'version-1',
      definition: scope === 'invoice-correction' ? correctionDefinition : releaseDefinition }));
    jest.spyOn(service, 'versionIn').mockImplementation(async (_, id) => {
      if (id !== 'version-1') throw new ConflictException('Unknown pinned version');
      return row.scope === 'invoice-correction' ? correctionDefinition : releaseDefinition;
    });
    return { service, prisma, tx, get row() { return row; }, set row(value: any) { row = value; } };
  };
  it('requests only for approved B/L with outstanding debt, an active workflow and an override grant', async () => {
    const f = fake();
    await expect(f.service.requestRelease({ billOfLadingId: 'bill-1', paymentState: 'PARTIAL',
      reason: 'Owner-authorized exception' }, { ...manager, permissions: ['release:create'] }))
      .rejects.toThrow(ForbiddenException);
    f.tx.billOfLading.findFirst.mockResolvedValueOnce({ status: 'DRAFT' } as any);
    await expect(f.service.requestRelease({ billOfLadingId: 'bill-1', paymentState: 'PARTIAL',
      reason: 'Owner-authorized exception' }, manager)).rejects.toThrow(ConflictException);
    f.tx.invoice.findMany.mockResolvedValueOnce([{ totalAmount: new Prisma.Decimal('100.00'),
      paidAmount: new Prisma.Decimal('100.00') }]);
    await expect(f.service.requestRelease({ billOfLadingId: 'bill-1', paymentState: 'PAID',
      reason: 'Not needed' }, manager)).rejects.toThrow(BadRequestException);
    f.row = { ...f.row, status: 'EXPIRED' }; // no live approval for the first request
    await expect(f.service.requestRelease({ billOfLadingId: 'bill-1', paymentState: 'PARTIAL',
      reason: 'Owner-authorized exception' }, manager)).resolves.toMatchObject({ id: 'approval-1', status: 'PENDING' });
    expect(f.tx.configApproval.create).toHaveBeenCalledTimes(1);
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.approval.request' }));
  });
  it('enforces separation, rechecks money and B/L state at decision, and forbids generic correction approvals', async () => {
    const f = fake();
    await expect(f.service.decideIn(f.tx as any, 'approval-1', true, manager))
      .rejects.toThrow(ForbiddenException);
    f.tx.invoice.findMany.mockResolvedValueOnce([{ totalAmount: new Prisma.Decimal('200.00'),
      paidAmount: new Prisma.Decimal('0') }]);
    await expect(f.service.decideIn(f.tx as any, 'approval-1', true, owner))
      .rejects.toThrow(ConflictException);
    f.tx.billOfLading.findFirst.mockResolvedValueOnce({ status: 'DRAFT' } as any);
    await expect(f.service.decideIn(f.tx as any, 'approval-1', true, owner))
      .rejects.toThrow(ConflictException);
    const approved = await f.service.decideIn(f.tx as any, 'approval-1', true, owner);
    expect(approved.status).toBe('APPROVED');
    expect(approved.decidedById).toBe('owner');
    await expect(f.service.decideIn(f.tx as any, 'approval-1', true, owner))
      .rejects.toThrow(ConflictException);
    f.row = { ...f.row, status: 'PENDING', scope: 'invoice-correction' };
    await expect(f.service.decideIn(f.tx as any, 'approval-1', true, owner))
      .rejects.toThrow(ForbiddenException);
  });
  it('consumes only matching approval for its own requester once, never substituting for the original release override', async () => {
    const f = fake();
    f.row = { ...f.row, status: 'APPROVED', decidedById: 'owner' };
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Other reason',
      '80.00', manager)).rejects.toThrow(ConflictException);
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '81.00', manager)).rejects.toThrow(ConflictException);
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', { ...manager, id: 'other-manager' })).rejects.toThrow(ForbiddenException);
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', { ...manager, permissions: [] })).rejects.toThrow(ForbiddenException);
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', null)).rejects.toThrow(ForbiddenException);
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', owner)).resolves.toBeNull(); // owner still must satisfy original release policy
    expect(f.tx.configApproval.update).not.toHaveBeenCalled();
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', manager)).resolves.toBe('approval-1');
    expect(f.row.status).toBe('CONSUMED');
    await expect(f.service.consumeRelease(f.tx as any, 'bill-1', 'PARTIAL', 'Owner-authorized exception',
      '80.00', manager)).rejects.toThrow(ForbiddenException);
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.approval.consumed' }));
  });
  it('expires stale approvals without rewriting the approver decision and permits a fresh request', async () => {
    const f = fake();
    f.row = { ...f.row, status: 'APPROVED', decisionNote: 'Original review',
      context: { ...f.row.context, outstanding: '42.00' } };
    await expect(f.service.requestRelease({ billOfLadingId: 'bill-1', paymentState: 'PARTIAL',
      reason: 'Owner-authorized exception' }, manager)).resolves.toMatchObject({ status: 'PENDING' });
    expect(f.tx.configApproval.update).toHaveBeenCalledWith({ where: { id: 'approval-1' },
      data: { status: 'EXPIRED', consumedAt: expect.any(Date) } });
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.approval.expired' }));
  });
  it('never discloses restricted custom approvals through a generic workflow history URL', async () => {
    const f = fake();
    const protectedSpec = documentSpec({ ...customSpec(), permissions: { read: 'salary:read' } });
    (f.prisma as any).configDocument = { findUnique: jest.fn(async () => ({ typeId: 'type-1',
      type: { code: 'CERTIFICATE', isCore: false },
      definition: { typeId: 'type-1', definition: protectedSpec } })) };
    const reader = { ...manager, permissions: ['workflow:read', 'config_document:read'] };
    await expect(f.service.approvals('CUSTOM:CERTIFICATE', 'document-1', reader))
      .rejects.toThrow(ForbiddenException);
    await expect(f.service.approvals('CUSTOM:OTHER', 'document-1', owner))
      .rejects.toThrow('Not Found');
    await expect(f.service.approvals('CUSTOM:CERTIFICATE', 'document-1', portal))
      .rejects.toThrow(ForbiddenException);
  });
  it('requires original invoice correction permissions and a distinct approver; does not route through generic approvals', async () => {
    const f = fake();
    const requester: AuthenticatedUser = { ...manager, permissions: ['invoice:correct'] };
    await expect(f.service.requestCorrectionIn(f.tx as any, 'correction-1', 'Correction note', requester))
      .resolves.toBe(true);
    expect(f.row.workflowVersionId).toBe('version-1');
    expect(f.row.scope).toBe('invoice-correction');
    await expect(f.service.decideCorrectionIn(f.tx as any, 'correction-1', true, '',
      { ...requester, permissions: ['invoice:correct', 'invoice:approve_correction'] }))
      .rejects.toThrow(ForbiddenException);
    await f.service.decideCorrectionIn(f.tx as any, 'correction-1', true, '',
      { ...manager, id: 'accountant', permissions: ['invoice:approve_correction'] });
    expect(f.row.status).toBe('CONSUMED');
    expect(f.tx.configApproval.update).toHaveBeenNthCalledWith(1, { where: { id: 'approval-1' },
      data: { status: 'APPROVED', decidedAt: expect.any(Date), decidedById: 'accountant', decisionNote: null } });
    expect(f.tx.configApproval.update).toHaveBeenNthCalledWith(2, { where: { id: 'approval-1' },
      data: { status: 'CONSUMED', consumedAt: expect.any(Date) } });
    expect(f.row.decidedById).toBe('accountant');
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.approval.consumed' }));
  });
});
