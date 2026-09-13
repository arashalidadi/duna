import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

/**
 * Phase 16 — HR & payroll e2e (ADR-036).
 * Covers: RBAC, employee CRUD (auto-code EMP-#####, dup 409, delete guard),
 * payslip create (defaults from employee, one-per-month 409, negative net 400),
 * DRAFT-only edits + recompute, approve (DRAFT->APPROVED), pay (APPROVED->PAID,
 * method+ref), cancel (reason required, terminal states), delete gating,
 * filters (year/month/status/search).
 */
describe('Salary (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };

  const randomTag = Math.random().toString(36).slice(2, 8);
  const tag = randomTag.toUpperCase();

  let adminToken = '';
  let noReadToken = ''; // no salary perms at all
  let readerToken = ''; // employee:read + salary:read
  let writerToken = ''; // + employee:create/update + salary:create/update
  let approverToken = ''; // + salary:approve
  let payerToken = ''; // + salary:pay
  let cancellerToken = ''; // + salary:cancel + salary:delete

  let employeeId = '';
  let employee2Id = '';
  let recordId = '';

  const auth = (token: string) => ({ Authorization: 'Bearer ' + token });
  const S = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await S().post('/api/v1/auth/login').send({ email: admin.email, password: admin.password }).expect(200);
    adminToken = login.body.data.accessToken;

    noReadToken = await createRoleToken(`SALN0_${tag}`, ['cargo:read'], `sal-n0-${randomTag}@shipping.local`);
    readerToken = await createRoleToken(
      `SALRD_${tag}`,
      ['employee:read', 'salary:read'],
      `sal-rd-${randomTag}@shipping.local`
    );
    writerToken = await createRoleToken(
      `SALWR_${tag}`,
      ['employee:read', 'employee:create', 'employee:update', 'salary:read', 'salary:create', 'salary:update'],
      `sal-wr-${randomTag}@shipping.local`
    );
    approverToken = await createRoleToken(
      `SALAP_${tag}`,
      ['employee:read', 'salary:read', 'salary:create', 'salary:approve'],
      `sal-ap-${randomTag}@shipping.local`
    );
    payerToken = await createRoleToken(
      `SALPY_${tag}`,
      ['employee:read', 'salary:read', 'salary:create', 'salary:pay'],
      `sal-py-${randomTag}@shipping.local`
    );
    cancellerToken = await createRoleToken(
      `SALCN_${tag}`,
      ['employee:read', 'salary:read', 'salary:create', 'salary:cancel', 'salary:delete', 'employee:delete'],
      `sal-cn-${randomTag}@shipping.local`
    );

    async function createRoleToken(roleCode: string, permissionCodes: string[], email: string): Promise<string> {
      const perms = await S().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
      const ids = permissionCodes.map((code) => {
        const perm = perms.body.data.find((p: { code: string }) => p.code === code);
        expect(perm).toBeDefined();
        return perm.id;
      });
      const role = await S().post('/api/v1/roles').set(auth(adminToken)).send({ code: roleCode, name: roleCode }).expect(201);
      await S().patch(`/api/v1/roles/${role.body.data.id}/permissions`).set(auth(adminToken)).send({ permissionIds: ids }).expect(200);
      await S().post('/api/v1/users').set(auth(adminToken))
        .send({ email, password: 'ChangeMe123!', fullName: `SAL ${roleCode}`, roleIds: [role.body.data.id] }).expect(201);
      const lg = await S().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
      return lg.body.data.accessToken;
    }
  });

  afterAll(async () => {
    // Hard tag-scoped cleanup via Prisma (Phase 12 lesson: zero leaks).
    const prisma = app.get(PrismaService);
    try {
      const employees = await prisma.employee.findMany({
        where: { name: { contains: randomTag } },
        select: { id: true },
      });
      const empIds = employees.map((e: { id: string }) => e.id);
      await prisma.salaryRecord.deleteMany({ where: { employeeId: { in: empIds } } });
      await prisma.employee.deleteMany({ where: { id: { in: empIds } } });
      const users = await prisma.user.findMany({
        where: { email: { contains: `-${randomTag}@shipping.local` } },
        select: { id: true },
      });
      const userIds = users.map((u: { id: string }) => u.id);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.role.deleteMany({ where: { code: { endsWith: `_${tag}` } } });
    } finally {
      await app.close();
    }
  });

  // ── RBAC ───────────────────────────────────────────────────────────────────

  it('401 without token; 403 without permission', async () => {
    await S().get('/api/v1/employees').expect(401);
    await S().get('/api/v1/employees').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/employees').set(auth(readerToken)).expect(200);
    await S().get('/api/v1/salary-records').set(auth(noReadToken)).expect(403);
    await S().get('/api/v1/salary-records').set(auth(readerToken)).expect(200);
  });

  // ── employees ───────────────────────────────────────────────────────────────

  it('employee create: 403 for reader; auto-code EMP-#####; update toggles status', async () => {
    await S().post('/api/v1/employees').set(auth(readerToken))
      .send({ name: `Ops Manager ${randomTag}` }).expect(403);

    const res = await S().post('/api/v1/employees').set(auth(writerToken))
      .send({
        name: `Ops Manager ${randomTag}`,
        position: 'Operations Manager',
        phone: '+98 912 000 0001',
        hireDate: '2023-04-01',
        baseSalary: 320000000,
        currencyCode: 'IRR',
      })
      .expect(201);
    const e1 = res.body.data;
    expect(e1.code).toMatch(/^EMP-\d{5}$/);
    expect(e1.status).toBe('ACTIVE');
    expect(Number(e1.baseSalary)).toBe(320000000);
    expect(e1.salaryRecordsCount).toBe(0);
    employeeId = e1.id;

    const res2 = await S().post('/api/v1/employees').set(auth(writerToken))
      .send({ name: `Clerk ${randomTag}`, position: 'Documentation Clerk', baseSalary: 210000000, currencyCode: 'IRR' })
      .expect(201);
    employee2Id = res2.body.data.id;

    // update: change position + deactivate second employee
    const upd = await S().patch(`/api/v1/employees/${employee2Id}`).set(auth(writerToken))
      .send({ position: 'Senior Documentation Clerk' }).expect(200);
    expect(upd.body.data.position).toBe('Senior Documentation Clerk');

    const upd2 = await S().patch(`/api/v1/employees/${employee2Id}`).set(auth(writerToken))
      .send({ status: 'INACTIVE' }).expect(200);
    expect(upd2.body.data.status).toBe('INACTIVE');

    // duplicate code 409
    await S().post('/api/v1/employees').set(auth(writerToken))
      .send({ code: e1.code, name: `Dup ${randomTag}` }).expect(409);
  });

  it('employee search finds by name; delete blocked once payslips exist', async () => {
    const list = await S().get(`/api/v1/employees?search=${encodeURIComponent(`Ops Manager ${randomTag}`)}`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((e: { id: string }) => e.id === employeeId)).toBe(true);
    // (delete-guard asserted after payslips are created below)
  });

  // ── payslip create + math ──────────────────────────────────────────────────

  it('payslip create: 404 unknown employee; defaults base/currency; net math; dup 409; negative 400', async () => {
    await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId: 'no-such-employee', year: 2026, month: 9 }).expect(404);

    const res = await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({
        employeeId,
        year: 2026,
        month: 9,
        additions: 25, // overtime hours bonus
        deductions: 100, // insurance + tax
      })
      .expect(201);
    const rec = res.body.data;
    recordId = rec.id;
    expect(rec.status).toBe('DRAFT');
    expect(rec.recordNumber).toMatch(/^SAL-\d{4}-\d{5}$/);
    expect(Number(rec.base)).toBe(320000000); // defaulted from employee
    expect(Number(rec.additions)).toBe(25);
    expect(Number(rec.deductions)).toBe(100);
    expect(Number(rec.net)).toBe(320000000 + 25 - 100);
    expect(rec.currencyCode).toBe('IRR');
    expect(rec.employee.name).toBe(`Ops Manager ${randomTag}`);

    // one payslip per employee per month
    await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId, year: 2026, month: 9 }).expect(409);

    // deductions may not exceed base + additions
    await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId, year: 2026, month: 8, base: 100, additions: 0, deductions: 101 })
      .expect(400);

    // employee delete now blocked (has payslip)
    await S().delete(`/api/v1/employees/${employeeId}`).set(auth(cancellerToken)).expect(409);
  });

  it('payslip DRAFT edit recomputes net; period change dup 409; search by employee', async () => {
    const res = await S().patch(`/api/v1/salary-records/${recordId}`).set(auth(writerToken))
      .send({ additions: 75 }).expect(200);
    expect(Number(res.body.data.additions)).toBe(75);
    expect(Number(res.body.data.net)).toBe(320000000 + 75 - 100);

    // same employee+period via month change on employee2's record
    const r2 = await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId: employee2Id, year: 2026, month: 7, base: 210000000 }).expect(201);
    await S().patch(`/api/v1/salary-records/${r2.body.data.id}`).set(auth(writerToken))
      .send({ year: 2026, month: 9, employeeId }).expect(409); // collides with recordId's period

    // cleanup r2 via cancel is not needed — DRAFT delete allowed with canceller
    await S().delete(`/api/v1/salary-records/${r2.body.data.id}`).set(auth(cancellerToken)).expect(200);

    const list = await S().get(`/api/v1/salary-records?search=${encodeURIComponent(`Ops Manager ${randomTag}`)}`).set(auth(readerToken)).expect(200);
    expect(list.body.data.data.some((r: { id: string }) => r.id === recordId)).toBe(true);
  });

  // ── lifecycle ──────────────────────────────────────────────────────────────

  it('pay before approve 409; approve: 403 for writer; DRAFT->APPROVED stamps', async () => {
    await S().post(`/api/v1/salary-records/${recordId}/pay`).set(auth(payerToken))
      .send({}).expect(409);

    await S().post(`/api/v1/salary-records/${recordId}/approve`).set(auth(writerToken))
      .send({}).expect(403);

    const res = await S().post(`/api/v1/salary-records/${recordId}/approve`).set(auth(approverToken)).expect(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.approvedAt).toBeTruthy();

    // frozen after approval
    await S().patch(`/api/v1/salary-records/${recordId}`).set(auth(writerToken))
      .send({ additions: 1 }).expect(409);
  });

  it('pay: 403 without salary:pay; APPROVED->PAID records method+ref; terminal', async () => {
    await S().post(`/api/v1/salary-records/${recordId}/pay`).set(auth(writerToken))
      .send({}).expect(403);

    const res = await S().post(`/api/v1/salary-records/${recordId}/pay`).set(auth(payerToken))
      .send({ paymentMethod: 'BANK_TRANSFER', paymentRef: 'TRF-99881' }).expect(200);
    expect(res.body.data.status).toBe('PAID');
    expect(res.body.data.paidAt).toBeTruthy();
    expect(res.body.data.paymentMethod).toBe('BANK_TRANSFER');
    expect(res.body.data.paymentRef).toBe('TRF-99881');

    // terminal: second pay / cancel / edit / delete all 409
    await S().post(`/api/v1/salary-records/${recordId}/pay`).set(auth(payerToken))
      .send({}).expect(409);
    await S().post(`/api/v1/salary-records/${recordId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'paid already' }).expect(409);
    await S().delete(`/api/v1/salary-records/${recordId}`).set(auth(cancellerToken)).expect(409);
  });

  it('cancel: reason required 400; DRAFT->CANCELLED terminal; delete DRAFT 200', async () => {
    const res = await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId: employee2Id, year: 2026, month: 8, base: 500, deductions: 20 }).expect(201);
    const cId = res.body.data.id;

    await S().post(`/api/v1/salary-records/${cId}/cancel`).set(auth(cancellerToken))
      .send({}).expect(400);

    const cn = await S().post(`/api/v1/salary-records/${cId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'e2e: left the company' }).expect(200);
    expect(cn.body.data.status).toBe('CANCELLED');
    expect(cn.body.data.cancelReason).toBe('e2e: left the company');

    await S().post(`/api/v1/salary-records/${cId}/cancel`).set(auth(cancellerToken))
      .send({ cancelReason: 'again' }).expect(409);

    // delete only DRAFT: cancelled keeps audit (409)
    await S().delete(`/api/v1/salary-records/${cId}`).set(auth(cancellerToken)).expect(409);

    // a fresh DRAFT can be deleted: writer has no delete perm (403), canceller 200
    const r3 = await S().post('/api/v1/salary-records').set(auth(writerToken))
      .send({ employeeId: employee2Id, year: 2026, month: 6 }).expect(201);
    await S().delete(`/api/v1/salary-records/${r3.body.data.id}`).set(auth(writerToken)).expect(403);
    await S().delete(`/api/v1/salary-records/${r3.body.data.id}`).set(auth(cancellerToken)).expect(200);
  });

  it('filters: year/month/status narrow the list', async () => {
    const ym = await S().get('/api/v1/salary-records?year=2026&month=9').set(auth(readerToken)).expect(200);
    expect(ym.body.data.data.some((r: { id: string }) => r.id === recordId)).toBe(true);

    const paid = await S().get('/api/v1/salary-records?status=PAID&employeeId=' + employeeId).set(auth(readerToken)).expect(200);
    expect(paid.body.data.data.some((r: { id: string }) => r.id === recordId)).toBe(true);

    const draft = await S().get('/api/v1/salary-records?status=DRAFT&employeeId=' + employeeId).set(auth(readerToken)).expect(200);
    expect(draft.body.data.data.some((r: { id: string }) => r.id === recordId)).toBe(false);
  });
});
