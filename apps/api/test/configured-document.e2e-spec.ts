import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../src/common/auth/types';
import { ConfigDocumentOutputService } from '../src/modules/configuration/config-document-output.service';
import { DocumentConfigService } from '../src/modules/configuration/document-config.service';
import { WorkflowConfigService } from '../src/modules/configuration/workflow-config.service';
import { documentSpec, workflowDefinition } from '../src/modules/configuration/configuration.policy';

/** Transaction-compatible in-memory lifecycle; no database, seed or owner rows are touched.
 * Execute this alongside configuration.e2e-spec.ts and DB E2E after migration on a reviewed test DB. */
const manager: AuthenticatedUser = { id: 'manager-1', email: 'manager@example.test', isPrimaryAdmin: false,
  roles: [], permissions: ['config_document:read', 'config_document:create', 'config_document:update',
    'config_document:transition', 'config_document:approve', 'config_document:render', 'document:render',
    'workflow:approve'] };
const approver: AuthenticatedUser = { ...manager, id: 'approver-1' };
const audit = { recordIn: jest.fn().mockResolvedValue(undefined) } as any;
const spec = () => documentSpec({ name: 'Extra operations certificate', category: 'Operations',
  numbering: { prefix: 'CERT', padding: 5, period: 'YYYY' }, relationships: [],
  layout: { title: 'Extra operations certificate', fields: ['reference'],
    stampAssetId: 'stamp-1', signatureAssetId: 'signature-1' },
  reporting: { searchable: true, exportable: true } });
const flow = () => workflowDefinition({ statuses: [
  { code: 'DRAFT', label: 'Draft (technical)' },
  { code: 'REVIEW', label: 'Review (technical)' },
  { code: 'ISSUED', label: 'Issued (technical)', terminal: true, issued: true },
], transitions: [
  { from: 'DRAFT', to: 'REVIEW', permission: 'config_document:transition' },
  { from: 'REVIEW', to: 'ISSUED', permission: 'config_document:transition',
    approval: { permission: 'config_document:approve', distinctRequester: true } },
] }, 'CUSTOM:CERTIFICATE');

function fixture() {
  const type = { id: 'type-1', code: 'CERTIFICATE', isCore: false, isActive: true,
    currentVersionId: 'definition-1' };
  const definition = { id: 'definition-1', typeId: type.id, version: 1, definition: spec() };
  let row: any = null;
  let approval: any = null;
  const field: { id: string; key: string; kind: string; label: string; viewPermission: string | null;
    visibility: object; exportable: boolean; isActive: boolean } = {
    id: 'field-1', key: 'reference', kind: 'TEXT', label: 'Original reference',
    viewPermission: null, visibility: {}, exportable: true, isActive: true };
  let saved: any[] = [];
  const archive: any[] = [];
  const eventCreate = jest.fn(async () => ({}));
  const tx = {
    $queryRaw: jest.fn(async () => []),
    configDocumentType: { findUnique: jest.fn(async () => type),
      findMany: jest.fn(async () => [{ ...type, versions: [definition], _count: { records: row ? 1 : 0 } }]),
      update: jest.fn(async ({ data }: any) => Object.assign(type, data)) },
    configDocumentVersion: { findUnique: jest.fn(async () => definition),
      findUniqueOrThrow: jest.fn(async () => definition) },
    configDocument: {
      create: jest.fn(async ({ data }: any) => {
        row = { id: 'document-1', ...data, revision: 1, values: {}, links: data.links,
          issuedAt: null, issueSnapshot: null, createdAt: new Date(), updatedAt: new Date(),
          type, definition, workflowVersion: { definition: flow() } };
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => where.id === row?.id ? row : null),
      findMany: jest.fn(async () => row ? [row] : []),
      findUniqueOrThrow: jest.fn(async () => row),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(row, data, { revision: data.revision?.increment ? row.revision + data.revision.increment : row.revision });
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id !== row.id || where.revision !== row.revision || where.status !== row.status) return { count: 0 };
        row = { ...row, ...data, revision: row.revision + data.revision.increment };
        return { count: 1 };
      }),
    },
    configDocumentEvent: { create: eventCreate },
    configField: { findMany: jest.fn(async () => [{ ...field, required: false, rules: {},
      sortOrder: 0, displayLocation: 'detail', optionList: null,
      effectiveFrom: new Date('2026-01-01'), effectiveUntil: null }]) },
    configFieldValue: { findMany: jest.fn(async () => saved) },
    configApproval: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (!approval) return null;
        if (where.status === 'PENDING') return approval.status === 'PENDING' ? approval : null;
        return ['PENDING', 'APPROVED'].includes(approval.status) && !approval.consumedAt ? approval : null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        approval && ['PENDING', 'APPROVED'].includes(approval.status) && !approval.consumedAt &&
        where.recordId === row.id ? [{ id: approval.id, status: approval.status }] : []),
      findUnique: jest.fn(async ({ where }: any) => where.id === approval?.id ? approval : null),
      create: jest.fn(async ({ data }: any) => {
        approval = { id: 'approval-1', ...data, status: 'PENDING', consumedAt: null, decisionNote: null };
        return approval;
      }),
      update: jest.fn(async ({ data }: any) => { approval = { ...approval, ...data }; return approval; }),
    },
    documentAsset: { findFirst: jest.fn(async () => ({ id: 'approved-artwork' })) },
    companySettings: { findFirst: jest.fn(async () => ({ companyName: 'Recorded company',
      address: 'Recorded address', taxNumber: 'Original TRN' })) },
    documentRenderedOutput: {
      findUnique: jest.fn(async ({ where }: any) => 'id' in where ? archive.find((a) => a.id === where.id) ?? null :
        archive.find((a) => a.recordId === where.documentType_recordId_format_revisionKey.recordId &&
          a.format === where.documentType_recordId_format_revisionKey.format) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: `archive-${archive.length + 1}`, ...data }; archive.push(item);
        return { content: item.content, sha256: item.sha256 };
      }),
      findMany: jest.fn(async () => archive.map((a) => ({ id: a.id, format: a.format, sha256: a.sha256 }))),
    },
  };
  const prisma = { ...tx, $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx) };
  const fields = { writeCustomIn: jest.fn(async (_tx, _code, _id, values, _actor, old) => {
    for (const [key, value] of Object.entries(values as object)) {
      saved = [{ fieldId: field.id, recordId: 'document-1', scope: 'CUSTOM:CERTIFICATE',
        field, value, fieldSnapshot: { label: 'Original reference', viewPermission: null,
        visibility: {}, exportable: true } }];
      if (key !== 'reference') throw new BadRequestException('Invalid field');
    }
    return { ...(old as object), ...values as object };
  }), assertRequiredCustom: jest.fn(), assertConditionAccess: jest.fn() } as any;
  const numbering = { allocateNumber: jest.fn(async () => ({ sequence: 'CERT-2026-00001' })) } as any;
  const workflows = new WorkflowConfigService(prisma as any, audit, fields);
  jest.spyOn(workflows, 'activeIn').mockResolvedValue({ id: 'workflow-v1', definition: flow() });
  jest.spyOn(workflows, 'versionIn').mockImplementation(async (_tx, id) => {
    if (id !== 'workflow-v1') throw new ConflictException('Unknown pinned version');
    return flow();
  });
  const artwork = readFileSync(join(__dirname, '../../web/public/images/operations-network.jpg'));
  const assets = { assertBindable: jest.fn(), bytes: jest.fn(async () => artwork) } as any;
  const documents = new DocumentConfigService(prisma as any, audit, numbering, fields, workflows, assets);
  const outputs = new ConfigDocumentOutputService(prisma as any, documents, assets);
  return { documents, outputs, workflows, tx, type, definition, field, fields, assets, archive,
    get row() { return row; }, get approval() { return approval; } };
}

beforeEach(() => audit.recordIn.mockClear());

describe('configured-document issuance lifecycle, archive and negative bypasses', () => {
  it('pins document + workflow versions, requires approval, freezes issue-time identity and blocks post-issue edits', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'ABC' } }, manager);
    expect(made.status).toBe('DRAFT');
    expect((await f.documents.detail(made.id, manager)).statusLabel).toBe('Draft (technical)');
    expect((await f.documents.listRecords('CERTIFICATE', manager))[0].statusLabel).toBe('Draft (technical)');
    expect(made.number).toBe('CERT-2026-00001');
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 1 }, manager))
      .rejects.toThrow(BadRequestException);
    const review = await f.documents.transition(made.id, { to: 'REVIEW', expectedRevision: 1 }, manager);
    expect(review.document?.revision).toBe(2);
    const pending = await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2 }, manager);
    expect(pending.pendingApproval?.id).toBe('approval-1');
    expect(f.row.status).toBe('REVIEW');
    await expect(f.workflows.decideIn(f.tx as any, 'approval-1', true, manager))
      .rejects.toThrow(ForbiddenException);
    await f.workflows.decideIn(f.tx as any, 'approval-1', true, approver);
    expect(f.approval.status).toBe('APPROVED');
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      approvalId: 'wrong-approval' }, manager)).rejects.toThrow(ForbiddenException);
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 1,
      approvalId: 'approval-1' }, manager)).rejects.toThrow(ConflictException);
    const issued = await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      approvalId: 'approval-1' }, manager);
    expect(issued.document?.issuedAt).toBeInstanceOf(Date);
    expect(f.approval.status).toBe('CONSUMED');
    expect(f.row.issueSnapshot).toMatchObject({ definitionVersionId: 'definition-1', workflowVersionId: 'workflow-v1',
      number: made.number, statusLabel: 'Issued (technical)', identity: { companyName: 'Recorded company' },
      warning: expect.stringContaining('NOT an invoice') });
    expect(f.tx.configDocumentEvent.create).toHaveBeenCalledTimes(3);
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 3,
      approvalId: 'approval-1' }, manager)).rejects.toThrow(ConflictException);
    await expect(f.documents.updateRecord(made.id, { expectedRevision: 3, values: { reference: 'changed' } },
      manager)).rejects.toThrow(ConflictException);
    expect(f.tx.configDocument.updateMany).toHaveBeenCalledTimes(2);
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.document.transition' }));
  });
  it('binds an exception reason through request, separate approval and final transition', async () => {
    const f = fixture();
    const restricted = flow();
    restricted.transitions[1].conditions = [{ source: 'field', key: 'reference', op: 'EQ', value: 'expected' }];
    restricted.transitions[1].exception = { permission: 'configuration:manage', reasonRequired: true };
    jest.spyOn(f.workflows, 'versionIn').mockResolvedValue(restricted);
    const exceptionOperator = { ...manager, permissions: [...manager.permissions, 'configuration:manage'] };
    const exceptionApprover = { ...approver, permissions: [...approver.permissions, 'configuration:manage'] };
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'different' } }, manager);
    await f.documents.transition(made.id, { to: 'REVIEW', expectedRevision: 1 }, manager);
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2 }, exceptionOperator))
      .rejects.toThrow('Workflow condition not met: reference');
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      reason: 'Approved variance' }, manager)).rejects.toThrow(ForbiddenException);
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      reason: 'Approved variance' }, exceptionOperator);
    expect(f.approval.context.exception_reason).toBe('Approved variance');
    await expect(f.workflows.decideIn(f.tx as any, f.approval.id, true, approver))
      .rejects.toThrow(ForbiddenException);
    await f.workflows.decideIn(f.tx as any, f.approval.id, true, exceptionApprover);
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      approvalId: f.approval.id, reason: 'Different reason' }, exceptionOperator))
      .rejects.toThrow('Exception reason does not match approved request');
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2,
      approvalId: f.approval.id }, exceptionOperator);
    expect(f.row.status).toBe('ISSUED');
    expect(f.tx.configDocumentEvent.create).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: 'Approved variance' }) }));
  });
  it('shows saved values with their original label after a field is retired, never as a new editable field', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'first' } }, manager);
    f.field.isActive = false; f.field.label = 'Renamed later';
    const historical = await f.documents.formFields('CERTIFICATE', manager, made.id);
    expect(historical).toEqual([expect.objectContaining({ key: 'reference',
      label: 'Original reference', active: false })]);
    expect((await f.documents.detail(made.id, manager)).fieldValues)
      .toEqual([expect.objectContaining({ key: 'reference', value: 'first' })]);
  });
  it('keeps older documents visible and pinned after type deactivation without allowing new creation', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'before retirement' } }, manager);
    f.type.isActive = false;
    expect(await f.documents.formPolicy('CERTIFICATE', manager)).toMatchObject({ isActive: false });
    expect(await f.documents.formFields('CERTIFICATE', manager)).toEqual([]);
    expect(await f.documents.catalogue(manager)).toEqual([expect.objectContaining({
      code: 'CERTIFICATE', isActive: false })]);
    expect(await f.documents.listRecords('CERTIFICATE', manager)).toEqual([expect.objectContaining({ id: made.id })]);
    await expect(f.documents.createRecord('CERTIFICATE', {}, manager)).rejects.toThrow('Active custom document type not found');
  });
  it('invalidates pending and approved decisions when a draft changes; old approvals cannot issue', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'first' } }, manager);
    await f.documents.transition(made.id, { to: 'REVIEW', expectedRevision: 1 }, manager);
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2 }, manager);
    expect(f.approval.status).toBe('PENDING');
    await f.documents.updateRecord(made.id, { expectedRevision: 2, values: { reference: 'second' } }, manager);
    expect(f.approval.status).toBe('EXPIRED');
    expect(f.row.revision).toBe(3);
    await expect(f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 3,
      approvalId: 'approval-1' }, manager)).rejects.toThrow(ForbiddenException);
  });
  it('expires an approved but unused decision on edit while preserving the approver note', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: 'first' } }, manager);
    await f.documents.transition(made.id, { to: 'REVIEW', expectedRevision: 1 }, manager);
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2 }, manager);
    await f.workflows.decideIn(f.tx as any, 'approval-1', true, approver, 'Reviewed by approver');
    await f.documents.updateRecord(made.id, { expectedRevision: 2, values: { reference: 'different' } }, manager);
    expect(f.approval.status).toBe('EXPIRED');
    expect(f.approval.decisionNote).toBe('Reviewed by approver');
    expect(audit.recordIn).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: 'configuration.approval.expired' }));
  });
  it('archives PDF/Print/XLSX separately, never stamps Print, rejects tampering and rechecks access on archive read', async () => {
    const f = fixture();
    const made = await f.documents.createRecord('CERTIFICATE', { values: { reference: '=2+2' } }, manager);
    await f.documents.transition(made.id, { to: 'REVIEW', expectedRevision: 1 }, manager);
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2 }, manager);
    await f.workflows.decideIn(f.tx as any, 'approval-1', true, approver);
    await f.documents.transition(made.id, { to: 'ISSUED', expectedRevision: 2, approvalId: 'approval-1' }, manager);
    const pdf = await f.outputs.render(made.id, 'pdf', manager);
    expect(pdf.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(f.assets.bytes).toHaveBeenCalledWith('stamp-1', 'STAMP', expect.any(Date));
    expect(f.assets.bytes).toHaveBeenCalledWith('signature-1', 'SIGNATURE', expect.any(Date));
    f.assets.bytes.mockClear();
    const print = await f.outputs.render(made.id, 'print', manager);
    expect(print.bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(f.assets.bytes).not.toHaveBeenCalled();
    const excel = await f.outputs.render(made.id, 'xlsx', manager);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(excel.bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
    const cells = book.getWorksheet('Document')!.getRows(1, 15)!
      .flatMap((r) => r.values as unknown[]).filter((v): v is string => typeof v === 'string');
    expect(cells).toContain("'=2+2");
    expect(f.archive).toHaveLength(3);
    f.tx.companySettings.findFirst.mockResolvedValueOnce({ companyName: 'Changed company' } as any);
    f.field.label = 'Changed label';
    expect((await f.outputs.render(made.id, 'pdf', manager)).bytes).toEqual(pdf.bytes);
    expect((await f.outputs.archived(f.archive[0].id, manager)).bytes).toEqual(pdf.bytes);
    await expect(f.outputs.archived(f.archive[0].id, { ...manager, permissions: [] }))
      .rejects.toThrow(ForbiddenException);
    f.field.viewPermission = 'salary:read';
    await expect(f.outputs.archived(f.archive[0].id, manager)).rejects.toThrow(ForbiddenException);
    f.field.viewPermission = null as any;
    f.archive[0].content = Buffer.from('tampered');
    await expect(f.outputs.archived(f.archive[0].id, manager))
      .rejects.toThrow(ServiceUnavailableException);
  });
});
