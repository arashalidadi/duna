import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../src/common/auth/types';
import { DeliveryReleaseService } from '../src/modules/delivery-release/delivery-release.service';
import { InvoiceCorrectionService } from '../src/modules/invoice/invoice-correction.service';

// Only fake the costly Phase-8 output capture. The real release and correction
// policy methods run against in-memory transactions; no PostgreSQL is opened.
jest.mock('../src/modules/document-output/document-issue-snapshot', () => ({ captureIssuedDocument: jest.fn() }));
const actor: AuthenticatedUser = { id: 'delegate-1', email: 'delegate@example.test', roles: [],
  permissions: ['release:create', 'release:override', 'invoice:correct'], isPrimaryAdmin: false };

function releaseFixture() {
  let committed = 0;
  const audit = { recordIn: jest.fn().mockResolvedValue(undefined) };
  const workflows = { consumeRelease: jest.fn().mockResolvedValue('approved-1') };
  const fields = { assertRequiredAtIssue: jest.fn(), writeNewReleaseIn: jest.fn() };
  const tx = {
    billOfLading: { findFirst: jest.fn(async () => ({ status: 'APPROVED' })) },
    releaseOrder: { findFirst: jest.fn(async () => null), findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: any) => ({ id: 'release-1', ...data })) },
    invoice: { findMany: jest.fn(async () => [{ totalAmount: new Prisma.Decimal('100'),
      paidAmount: new Prisma.Decimal('0') }]) },
  };
  const prisma = { ...tx, $transaction: async (cb: (client: unknown) => Promise<unknown>) => {
    const result = await cb(tx); committed++; return result;
  } };
  const service = new DeliveryReleaseService(prisma as any, audit as any, workflows as any, fields as any);
  jest.spyOn(service, 'detailRelease').mockResolvedValue({ id: 'release-1' } as any);
  const dto = { billOfLadingId: 'bill-1', paymentState: 'UNPAID' as const,
    force: true, overrideReason: 'Documented exception', customValues: { gate_note: 'Gate A' } };
  const ctx = { actor, userId: actor.id, actorEmail: actor.email, canOverride: true as boolean,
    authorizationBasis: 'explicit-grant' as const };
  return { service, tx, dto, ctx, audit, workflows, fields, get committed() { return committed; } };
}

describe('Phase 9 operational integration: core controls remain authoritative', () => {
  it('never treats a custom field or workflow as permission to skip the original unpaid-release guard', async () => {
    const f = releaseFixture();
    await expect(f.service.createRelease({ ...f.dto, force: false }, f.ctx))
      .rejects.toThrow(ConflictException);
    await expect(f.service.createRelease(f.dto, { ...f.ctx, canOverride: false }))
      .rejects.toThrow(ForbiddenException);
    f.tx.billOfLading.findFirst.mockResolvedValueOnce({ status: 'DRAFT' } as any);
    await expect(f.service.createRelease(f.dto, f.ctx)).rejects.toThrow(ConflictException);
    expect(f.workflows.consumeRelease).not.toHaveBeenCalled();
    expect(f.tx.releaseOrder.create).not.toHaveBeenCalled();
    expect(f.committed).toBe(0);
  });
  it('consumes a delegate approval then writes custom values and audited override in the same release transaction', async () => {
    const f = releaseFixture();
    const result = await f.service.createRelease(f.dto, f.ctx);
    expect(result).toMatchObject({ id: 'release-1' });
    expect(f.workflows.consumeRelease).toHaveBeenCalledWith(f.tx, 'bill-1', 'UNPAID',
      'Documented exception', '100.00', actor);
    expect(f.fields.writeNewReleaseIn).toHaveBeenCalledWith(f.tx, 'release-1', f.dto.customValues, actor);
    const ordering = f.tx.releaseOrder.create.mock.invocationCallOrder[0];
    expect(f.fields.writeNewReleaseIn.mock.invocationCallOrder[0]).toBeGreaterThan(ordering);
    expect(f.audit.recordIn).toHaveBeenCalledWith(f.tx, expect.objectContaining({ action: 'release:override',
      metadata: expect.objectContaining({ workflowApprovalId: 'approved-1', outstanding: '100.00' }) }));
    expect(f.committed).toBe(1);
  });
  it('rolls back all release work if extra approval, required field or audit fails', async () => {
    const f = releaseFixture();
    f.workflows.consumeRelease.mockRejectedValueOnce(new ForbiddenException('No approval'));
    await expect(f.service.createRelease(f.dto, f.ctx)).rejects.toThrow(ForbiddenException);
    expect(f.tx.releaseOrder.create).not.toHaveBeenCalled();
    f.fields.writeNewReleaseIn.mockRejectedValueOnce(new ConflictException('Missing required custom field'));
    await expect(f.service.createRelease(f.dto, f.ctx)).rejects.toThrow(ConflictException);
    expect(f.audit.recordIn).not.toHaveBeenCalled();
    f.audit.recordIn.mockRejectedValueOnce(new Error('Audit failed'));
    await expect(f.service.createRelease(f.dto, f.ctx)).rejects.toThrow('Audit failed');
    expect(f.committed).toBe(0); // fake tx commits only after the callback succeeds
  });
  it('keeps the original CompanySettings correction approval even if no configured workflow is active', async () => {
    const settings = { invoiceCorrectionApprovalRequired: true };
    const audit = { recordIn: jest.fn() };
    const workflows = { requestCorrectionIn: jest.fn().mockResolvedValue(false) };
    const tx = { $queryRaw: jest.fn(async () => [{ id: 'invoice-1', status: 'ISSUED', deletedAt: null }]),
      invoiceCorrection: { findFirst: jest.fn(async () => null),
        create: jest.fn(async () => ({ id: 'correction-1' })),
        findUniqueOrThrow: jest.fn(async () => ({ id: 'correction-1', status: 'PENDING_APPROVAL' })) },
      companySettings: { findFirst: jest.fn(async () => settings) } };
    const prisma = { $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx) };
    const service = new InvoiceCorrectionService(prisma as any, {} as any, audit as any,
      {} as any, workflows as any);
    const applied = jest.spyOn(service as any, 'apply').mockResolvedValue(undefined);
    await service.request('invoice-1', 'Correction note', actor);
    expect(workflows.requestCorrectionIn).toHaveBeenCalledWith(tx, 'correction-1', 'Correction note', actor);
    expect(applied).not.toHaveBeenCalled();
    settings.invoiceCorrectionApprovalRequired = false;
    workflows.requestCorrectionIn.mockResolvedValueOnce(true);
    await service.request('invoice-1', 'Correction note', actor);
    expect(applied).not.toHaveBeenCalled();
    await service.request('invoice-1', 'Correction note', actor);
    expect(applied).toHaveBeenCalledTimes(1); // original no-approval route only if both policies allow
  });
});
