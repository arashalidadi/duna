import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ShippersService } from '../src/modules/shippers/shippers.service';
import { ConsigneesService } from '../src/modules/consignees/consignees.service';
import { AgentsService } from '../src/modules/agents/agents.service';
import { CargoService } from '../src/modules/cargo/cargo.service';
import { CustomersService } from '../src/modules/customers/customers.service';
import { ActualLoadingService } from '../src/modules/actual-loading/actual-loading.service';
import { YardInventoryService } from '../src/modules/yard-inventory/yard-inventory.service';
import { YardsService } from '../src/modules/yards/yards.service';
import { PortsService } from '../src/modules/ports/ports.service';
import { UpdatePortDto } from '../src/modules/ports/dto/ports.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SalaryRecordService } from '../src/modules/salary/salary-record.service';
import { EmployeeService } from '../src/modules/salary/employee.service';
import { QuotationService } from '../src/modules/quotation/quotation.service';
import { JobService } from '../src/modules/jobs/job.service';
import { NotificationWorkerService } from '../src/modules/notifications/notification-worker.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { AuditService } from '../src/common/infrastructure/audit/audit.service';
import type { NumberingService } from '../src/common/infrastructure/numbering';
import type { AuthenticatedUser } from '../src/common/auth/types';

type DbStub = Record<string, any>; // Database-free mocks, never an owner connection.
const db = (o: DbStub) => o as unknown as PrismaService;
const audit = (o: DbStub) => o as unknown as AuditService;
const numbering = {} as NumberingService;
const actor = (permission: string): AuthenticatedUser => ({ id: 'owner', email: 'owner@example.test',
  isPrimaryAdmin: false, permissions: [permission], roles: [], portalAgentId: null, portalCustomerId: null });
const transaction = (tx: DbStub) => db({ $transaction: (fn: (t: DbStub) => Promise<unknown>) => fn(tx) });
const auditRecord = () => ({ recordIn: jest.fn().mockResolvedValue(undefined) });

describe('Phase 10 lifecycle retention and transactional audits (no database)', () => {
  it('rejects archiving a Shipper referenced by Cargo, even when no other relations exist', async () => {
    const a = auditRecord();
    const tx = { $queryRaw: jest.fn(), shipper: {
      findFirst: jest.fn().mockResolvedValue({ id: 's', code: 'S', isActive: true }), update: jest.fn(),
    }, cargo: { count: jest.fn().mockResolvedValue(1) },
    manifest: { count: jest.fn().mockResolvedValue(0) },
    manifestItem: { count: jest.fn().mockResolvedValue(0) },
    billOfLading: { count: jest.fn().mockResolvedValue(0) },
    fileAttachment: { count: jest.fn().mockResolvedValue(0) } };
    const service = new ShippersService(transaction(tx), audit(a));
    await expect(service.remove('s', actor('shipper:delete'))).rejects.toThrow(ConflictException);
    expect(tx.shipper.update).not.toHaveBeenCalled();
    expect(a.recordIn).not.toHaveBeenCalled();
  });

  it('deactivation does not clear unrelated Shipper contact or tax fields and writes one atomic audit', async () => {
    const a = auditRecord();
    const tx = { $queryRaw: jest.fn(), shipper: {
      findFirst: jest.fn().mockResolvedValue({ code: 'S', isActive: true }),
      update: jest.fn().mockResolvedValue({ code: 'S', isActive: false, taxId: 'kept' }),
    } };
    const service = new ShippersService(transaction(tx), audit(a));
    const user = actor('shipper:update');
    expect((await service.setActive('s', false, user)).taxId).toBe('kept');
    expect(tx.shipper.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      isActive: false, taxId: undefined, address: undefined, email: undefined, phone: undefined,
    }) }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'shipper.deactivate', actorId: user.id,
    }));
    await expect(service.setActive('s', false, { ...user, portalAgentId: 'portal' })).rejects.toThrow(ForbiddenException);
  });

  it('refuses Consignee archival with a B/L and Agent archival with a portal account', async () => {
    const a = auditRecord();
    const consigneeTx = { $queryRaw: jest.fn(), consignee: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c', code: 'C', isActive: true }), update: jest.fn(),
    }, cargo: { count: jest.fn().mockResolvedValue(0) },
    manifest: { count: jest.fn().mockResolvedValue(0) }, manifestItem: { count: jest.fn().mockResolvedValue(0) },
    billOfLading: { count: jest.fn().mockResolvedValue(1) }, fileAttachment: { count: jest.fn().mockResolvedValue(0) } };
    await expect(new ConsigneesService(transaction(consigneeTx), audit(a))
      .remove('c', actor('consignee:delete'))).rejects.toThrow(ConflictException);
    expect(consigneeTx.consignee.update).not.toHaveBeenCalled();
    const agentTx = { $queryRaw: jest.fn(), agent: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ag', code: 'AG', isActive: true }), update: jest.fn(),
    }, manifest: { count: jest.fn().mockResolvedValue(0) }, user: { count: jest.fn().mockResolvedValue(1) },
    agentDestination: { count: jest.fn().mockResolvedValue(0) }, fileAttachment: { count: jest.fn().mockResolvedValue(0) } };
    await expect(new AgentsService(transaction(agentTx), audit(a))
      .remove('ag', actor('agent:delete'))).rejects.toThrow(ConflictException);
    expect(agentTx.agent.update).not.toHaveBeenCalled();
  });

  it('DELETE on an Agent destination deactivates but keeps the row reactivatable', async () => {
    const a = auditRecord();
    const tx = { $queryRaw: jest.fn(), agentDestination: {
      findFirst: jest.fn().mockResolvedValue({ id: 'd', portId: 'p', isActive: true }),
      update: jest.fn().mockResolvedValue({ id: 'd', portId: 'p', isActive: false }),
      delete: jest.fn(),
    } };
    const prisma = db({ agent: { findUnique: jest.fn().mockResolvedValue({ id: 'ag', isActive: true }) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) });
    const service = new AgentsService(prisma, audit(a));
    expect((await service.removeDestination('ag', 'd', actor('agent:update'))).isActive).toBe(false);
    expect(tx.agentDestination.delete).not.toHaveBeenCalled();
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'agent_destination.deactivate', entityId: 'd',
    }));
  });

  it('archives draft payroll and quotations without hard-deleting financial/document values', async () => {
    const a = auditRecord();
    const payrollTx = { $queryRaw: jest.fn(), salaryRecord: {
      findFirst: jest.fn().mockResolvedValue({ id: 'sal', status: 'DRAFT', recordNumber: 'SAL-01',
        employeeId: 'e', year: 2026, month: 10 }),
      update: jest.fn().mockResolvedValue({}), delete: jest.fn(),
    } };
    const payroll = new SalaryRecordService(transaction(payrollTx), numbering, audit(a));
    expect(await payroll.remove('sal', actor('salary:delete'))).toEqual({ id: 'sal', deleted: true, archived: true });
    expect(payrollTx.salaryRecord.delete).not.toHaveBeenCalled();
    expect(payrollTx.salaryRecord.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sal' }, data: { deletedAt: expect.any(Date) },
    }));
    const quoteTx = { $queryRaw: jest.fn(), quotation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'q', quotationNumber: 'QT-1',
        status: 'DRAFT', linkedProformaId: null }), update: jest.fn().mockResolvedValue({}), delete: jest.fn(),
    } };
    expect(await new QuotationService(transaction(quoteTx), numbering, audit(a))
      .remove('q', actor('quotation:delete'))).toEqual({ id: 'q', deleted: true, archived: true });
    expect(quoteTx.quotation.delete).not.toHaveBeenCalled();
    expect(a.recordIn).toHaveBeenCalledWith(quoteTx, expect.objectContaining({ action: 'quotation.archive' }));
  });

  it('keeps employees with any payroll history, including archived payslips', async () => {
    const tx = { $queryRaw: jest.fn(), employee: {
      findFirst: jest.fn().mockResolvedValue({ id: 'e', status: 'ACTIVE', code: 'EMP-1' }), update: jest.fn(),
    }, salaryRecord: { count: jest.fn().mockResolvedValue(1) },
    fileAttachment: { count: jest.fn().mockResolvedValue(0) } };
    await expect(new EmployeeService(transaction(tx), audit(auditRecord()))
      .remove('e', actor('employee:delete'))).rejects.toThrow(ConflictException);
    expect(tx.salaryRecord.count).toHaveBeenCalledWith({ where: { employeeId: 'e' } });
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it('refuses reserved yard inventory removal; unused placement is audited before completion', async () => {
    const a = auditRecord();
    const placement = { id: 'inv', cargoId: 'cargo', yardId: 'yard', portId: 'port',
      status: 'RESERVED', enteredAt: new Date('2026-10-01'), locationLabel: null, notes: null };
    const tx = { $queryRaw: jest.fn(), yardInventory: {
      findUnique: jest.fn().mockResolvedValue(placement), delete: jest.fn().mockResolvedValue({}),
    }, cargo: {
      findUnique: jest.fn().mockResolvedValue({ status: 'AT_YARD', jobId: null,
        _count: { inspections: 0, loadListItems: 0, actualLoadingItems: 0,
          manifestItems: 0, billsOfLadingItems: 0, dischargeItems: 0 } }),
      update: jest.fn().mockResolvedValue({}),
    } };
    const service = new YardInventoryService(transaction(tx), audit(a));
    await expect(service.remove('inv', actor('yard-inventory:remove'))).rejects.toThrow(ConflictException);
    expect(tx.yardInventory.delete).not.toHaveBeenCalled();
    tx.yardInventory.findUnique.mockResolvedValue({ ...placement, status: 'IN_YARD' });
    expect((await service.remove('inv', actor('yard-inventory:remove'))).removed).toBe(true);
    expect(tx.cargo.update).toHaveBeenCalledWith({ where: { id: 'cargo' }, data: { status: 'REGISTERED' } });
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'yard_inventory.remove_unused', beforeData: expect.objectContaining({ yardId: 'yard' }),
    }));
  });

  it('guards Yard deactivation and archival against inventory and historical Cargo, with an audit', async () => {
    const a = auditRecord();
    const tx = { $queryRaw: jest.fn(), yard: {
      findFirst: jest.fn().mockResolvedValue({ id: 'y', code: 'Y', name: 'Yard',
        portId: 'p', isActive: true }),
      update: jest.fn().mockResolvedValue({ id: 'y', code: 'Y', name: 'Yard',
        portId: 'p', isActive: false }),
    }, yardInventory: { count: jest.fn().mockResolvedValue(1) },
    cargo: { count: jest.fn().mockResolvedValue(0) },
    fileAttachment: { count: jest.fn().mockResolvedValue(0) },
    port: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null, isActive: true }) } };
    const yard = new YardsService(transaction(tx), audit(a));
    const user = actor('yard:update');
    await expect(yard.setActive('y', false, user)).rejects.toThrow(ConflictException);
    expect(tx.yard.update).not.toHaveBeenCalled();
    tx.yardInventory.count.mockResolvedValue(0);
    tx.cargo.count.mockResolvedValue(1);
    await expect(yard.remove('y', user)).rejects.toThrow(ConflictException);
    await expect(yard.update('y', { portId: 'new-port' }, user)).rejects.toThrow(ConflictException);
    expect(tx.yard.update).not.toHaveBeenCalled();
    tx.cargo.count.mockResolvedValue(0);
    expect((await yard.setActive('y', false, user)).isActive).toBe(false);
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'yard.deactivate', entityId: 'y', actorId: user.id,
    }));
  });

  it('guards and audits legacy PATCH Port status exactly like /active', async () => {
    expect(validateSync(plainToInstance(UpdatePortDto, { isActive: false }))).toHaveLength(0);
    const a = auditRecord();
    const before = { id: 'p', name: 'Hamriyah', code: 'HAM', country: 'UAE',
      city: 'Dubai', abbreviation: 'HAM', displayName: null, aliases: [], isActive: true };
    const tx = { $queryRaw: jest.fn(), port: {
      findFirst: jest.fn().mockResolvedValue(before), findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ ...before, isActive: false }),
    }, portAlias: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    yard: { count: jest.fn().mockResolvedValue(1) }, voyage: { count: jest.fn().mockResolvedValue(0) },
    agentDestination: { count: jest.fn().mockResolvedValue(0) },
    cargo: { count: jest.fn().mockResolvedValue(0) },
    bookingRequest: { count: jest.fn().mockResolvedValue(0) } };
    const service = new PortsService(transaction(tx), audit(a));
    const user = actor('port:update');
    await expect(service.update('p', { isActive: false }, user)).rejects.toThrow(ConflictException);
    expect(tx.port.update).not.toHaveBeenCalled();
    tx.yard.count.mockResolvedValue(0);
    expect((await service.update('p', { isActive: false }, user)).isActive).toBe(false);
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'port.deactivate', actorId: user.id,
      beforeData: expect.objectContaining({ isActive: true }),
      afterData: expect.objectContaining({ isActive: false }),
    }));
    tx.port.findFirst.mockResolvedValue({ ...before, isActive: false, city: null });
    await expect(service.update('p', { isActive: true }, user)).rejects.toThrow(ConflictException);
    expect(tx.port.update).toHaveBeenCalledTimes(1);
  });

  it('refuses a duplicate Rajaee display name when that alias belongs to Bandar Abbas', async () => {
    const tx = { portAlias: { findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(1) }, port: { findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn() } };
    const service = new PortsService(transaction(tx), audit(auditRecord()));
    await expect(service.create({ code: 'OTHER', name: 'Another port', displayName: 'Rajaee',
      country: 'Iran', city: 'Fixture region', abbreviation: 'TEST' }, actor('port:create')))
      .rejects.toThrow(ConflictException);
    expect(tx.portAlias.count).toHaveBeenCalledWith({ where: {
      key: { in: ['ANOTHER PORT', 'RAJAEE'] },
    } });
    expect(tx.port.create).not.toHaveBeenCalled();
  });

  it('permits unchanged inactive Customer/Port references but rejects new inactive selections', async () => {
    const prisma = db({ customer: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null, isActive: false }) },
      port: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null, isActive: false }) },
      shipper: { findUnique: jest.fn().mockResolvedValue({ deletedAt: null, isActive: false }) },
    });
    const cargo = new CargoService(prisma, numbering, audit(auditRecord())) as unknown as {
      validateRelations: (portId: string, customerId: string, yardId?: string | null,
        destinationPortId?: string | null, previous?: Record<string, string | null>) => Promise<void>;
      validateParty: (type: 'shipper', id: string) => Promise<void>;
    };
    await expect(cargo.validateRelations('p', 'c', null, null,
      { portId: 'p', customerId: 'c', yardId: null, destinationPortId: null })).resolves.toBeUndefined();
    await expect(cargo.validateRelations('p', 'c', null, null)).rejects.toThrow(ConflictException);
    await expect(cargo.validateParty('shipper', 's')).rejects.toThrow(ConflictException);
  });

  it('keeps PATCH Customer deactivation guarded and audited like the /active route', async () => {
    const a = auditRecord();
    const tx = { $queryRaw: jest.fn(), customer: {
      findFirst: jest.fn().mockResolvedValue({ id: 'c', code: 'C', name: 'Client',
        isActive: true, personKind: 'LEGAL' }),
      update: jest.fn().mockResolvedValue({ id: 'c', code: 'C', name: 'Client',
        isActive: false, personKind: 'LEGAL' }),
    }, user: { count: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) } };
    const service = new CustomersService(transaction(tx), audit(a));
    const user = actor('customer:update');
    await expect(service.update('c', { isActive: false }, user)).rejects.toThrow(ConflictException);
    expect(tx.customer.update).not.toHaveBeenCalled();
    expect((await service.update('c', { isActive: false }, user)).isActive).toBe(false);
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isActive: false }),
    }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'customer.update', afterData: expect.objectContaining({ isActive: false }),
    }));
  });

  it('completing Actual Loading audits each full-load yard exit in the same transaction', async () => {
    const a = auditRecord();
    const placement = { id: 'inv', cargoId: 'full', yardId: 'yard', portId: 'port',
      status: 'RESERVED', enteredAt: new Date('2026-10-01'), locationLabel: 'A1', notes: 'kept' };
    const tx = { $queryRaw: jest.fn(), actualLoading: {
      findUnique: jest.fn().mockResolvedValue({ id: 'al', status: 'IN_PROGRESS', actualLoadingNumber: 'AL-1' }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ items: [
        { cargoId: 'full', actualQuantity: 2, result: 'FULL' },
        { cargoId: 'partial', actualQuantity: 1, result: 'PARTIAL' },
      ] }),
      update: jest.fn().mockResolvedValue({ id: 'al', status: 'COMPLETED' }) },
      cargo: { update: jest.fn(), findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
        ({ id: where.id, inspectionStatus: 'DONE', status: 'AT_YARD', quantity: 2, deletedAt: null })) }, yardInventory: {
        findUnique: jest.fn().mockResolvedValue(placement), delete: jest.fn(),
      } };
    const prisma = db({ actualLoading: { findUnique: jest.fn().mockResolvedValue({ id: 'al',
      status: 'IN_PROGRESS', deletedAt: null, items: [
        { cargoId: 'full', actualQuantity: 2, result: 'FULL' },
        { cargoId: 'partial', actualQuantity: 1, result: 'PARTIAL' },
      ] }) }, cargo: { findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) =>
      ({ id: where.id, inspectionStatus: 'DONE', status: 'AT_YARD', quantity: 2, deletedAt: null })) },
      $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) });
    const service = new ActualLoadingService(prisma, numbering, audit(a));
    const user = actor('actual-loading:complete');
    expect(await service.complete('al', {}, user)).toEqual({ id: 'al', status: 'COMPLETED' });
    expect(tx.cargo.update).toHaveBeenCalledTimes(1);
    expect(tx.cargo.update).toHaveBeenCalledWith({ where: { id: 'full' }, data: { loadingStatus: 'LOADED' } });
    expect(tx.yardInventory.delete).toHaveBeenCalledWith({ where: { id: 'inv' } });
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'yard_inventory.loaded_exit', entityId: 'inv', actorId: user.id,
      beforeData: placement, afterData: { removed: true, actualLoadingId: 'al' },
    }));
    a.recordIn.mockRejectedValueOnce(new Error('audit failure'));
    await expect(service.complete('al', {}, user)).rejects.toThrow('audit failure');
    // Real Prisma rolls back the loading status and yard deletion on rejection.
  });

  it('commits Job status and its event together; notification failure rejects the transaction', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'j', status: 'OPEN', items: [] });
    const tx = { $queryRaw: jest.fn(), job: {
      findFirst: jest.fn().mockResolvedValue({ status: 'DRAFT' }), update,
    } };
    const notify = { jobTransitionIn: jest.fn().mockResolvedValue(undefined) };
    const a = auditRecord();
    const service = new JobService(transaction(tx), notify as unknown as NotificationWorkerService, audit(a));
    expect(await service.start('j', actor('job:start'))).toEqual(expect.objectContaining({ status: 'OPEN' }));
    expect(a.recordIn).toHaveBeenCalledWith(tx, expect.objectContaining({
      action: 'job.open', entityId: 'j', beforeData: { status: 'DRAFT' } }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'OPEN' } }));
    expect(notify.jobTransitionIn).toHaveBeenCalledWith(tx, 'j', 'DRAFT', 'OPEN', expect.any(Date));
    notify.jobTransitionIn.mockRejectedValueOnce(new Error('outbox write failed'));
    await expect(service.start('j', actor('job:start'))).rejects.toThrow('outbox write failed');
    // The real Prisma transaction (not mocked here) rolls back both writes.
  });
});
