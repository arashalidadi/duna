import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 3 — invoice tax, Job/B-L links, TRN and controlled correction (e2e).
 *
 * Runs against the configured database, like invoice.e2e-spec.ts, and creates its own
 * customer, jobs and invoices. The approval test temporarily sets
 * CompanySettings.invoiceCorrectionApprovalRequired and restores the previous value.
 *
 * Not covered here: the migration backfill on pre-existing data. That is verified by applying
 * the migration to a database holding legacy rows (see docs/duna-analysis/09-audit/phase-3-invoice-tax-correction.md).
 */
describe('Invoice Phase 3 (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const tag = Math.random().toString(36).slice(2, 8);
  let adminToken = '';
  let noCorrectToken = '';
  let approverToken = '';
  let requesterToken = '';
  let customerId = '';

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
    prisma = app.get(PrismaService);

    const login = await api().post('/api/v1/auth/login').send(admin).expect(200);
    adminToken = login.body.data.accessToken as string;

    const customer = await api()
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `P3-${tag.toUpperCase()}`, name: `Phase 3 test ${tag}`, type: 'SHIPPER' })
      .expect(201);
    customerId = customer.body.data.id as string;

    // A user with invoice:read and invoice:create but NOT invoice:correct.
    const perms = await api().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
    const codes = ['invoice:read', 'invoice:create', 'invoice:issue'];
    const ids = codes.map((c) => perms.body.data.find((p: { code: string }) => p.code === c).id);
    const role = await api()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: `P3NC${tag}`.toUpperCase(), name: `P3 no-correct ${tag}` })
      .expect(201);
    await api()
      .patch(`/api/v1/roles/${role.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: ids })
      .expect(200);
    const email = `p3-${tag}@example.test`;
    await api()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email, password: 'ChangeMe123!', fullName: `P3 ${tag}`, roleIds: [role.body.data.id] })
      .expect(201);
    const nc = await api().post('/api/v1/auth/login').send({ email, password: 'ChangeMe123!' }).expect(200);
    noCorrectToken = nc.body.data.accessToken as string;

    // A second user who may approve corrections but cannot request them.
    const apRole = await api()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: `P3AP${tag}`.toUpperCase(), name: `P3 approver ${tag}` })
      .expect(201);
    const apIds = ['invoice:read', 'invoice:approve_correction'].map(
      (c) => perms.body.data.find((p: { code: string }) => p.code === c).id,
    );
    await api()
      .patch(`/api/v1/roles/${apRole.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: apIds })
      .expect(200);
    const apEmail = `p3ap-${tag}@example.test`;
    await api()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: apEmail, password: 'ChangeMe123!', fullName: `P3 approver ${tag}`, roleIds: [apRole.body.data.id] })
      .expect(201);
    const ap = await api().post('/api/v1/auth/login').send({ email: apEmail, password: 'ChangeMe123!' }).expect(200);
    approverToken = ap.body.data.accessToken as string;

    // A non-owner requester who holds both correction permissions, so a self-approval
    // refusal can only come from the service rule and not from a missing permission.
    const rqRole = await api()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: `P3RQ${tag}`.toUpperCase(), name: `P3 requester ${tag}` })
      .expect(201);
    const rqIds = ['invoice:read', 'invoice:create', 'invoice:issue', 'invoice:correct', 'invoice:approve_correction'].map(
      (c) => perms.body.data.find((p: { code: string }) => p.code === c).id,
    );
    await api()
      .patch(`/api/v1/roles/${rqRole.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({ permissionIds: rqIds })
      .expect(200);
    const rqEmail = `p3rq-${tag}@example.test`;
    await api()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: rqEmail, password: 'ChangeMe123!', fullName: `P3 requester ${tag}`, roleIds: [rqRole.body.data.id] })
      .expect(201);
    const rq = await api().post('/api/v1/auth/login').send({ email: rqEmail, password: 'ChangeMe123!' }).expect(200);
    requesterToken = rq.body.data.accessToken as string;
  });

  afterAll(async () => {
    await app?.close();
  });

  async function newDraft(extra: Record<string, unknown> = {}): Promise<string> {
    const res = await api()
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId, currencyCode: 'AED', ...extra })
      .expect(201);
    return res.body.data.id as string;
  }

  async function addLine(invoiceId: string, description: string, unitPrice: number, taxRate?: number) {
    return api()
      .post(`/api/v1/invoices/${invoiceId}/items`)
      .set(auth(adminToken))
      .send({ description, unitPrice, quantity: 1, ...(taxRate !== undefined ? { taxRate } : {}) })
      .expect(201);
  }

  async function getInvoice(id: string) {
    const res = await api().get(`/api/v1/invoices/${id}`).set(auth(adminToken)).expect(200);
    return res.body.data;
  }

  it('per-line VAT: 0% and 5% lines give line VAT, header VAT = sum, unchanged total formula (REQ-144, DEC-103)', async () => {
    const id = await newDraft();
    await addLine(id, 'Zero-rated', 100, 0);
    await addLine(id, 'Standard', 200, 5);
    const inv = await getInvoice(id);

    const byDesc = (d: string) => inv.items.find((i: { description: string }) => i.description === d);
    expect(Number(byDesc('Zero-rated').taxAmount)).toBe(0);
    expect(Number(byDesc('Standard').taxAmount)).toBe(10);
    expect(Number(inv.taxAmount)).toBe(10);
    expect(Number(inv.subtotal)).toBe(300);
    expect(Number(inv.totalAmount)).toBe(310);
  });

  it('a line without a rate takes the header rate (legacy single-rate behaviour kept)', async () => {
    const id = await newDraft({ taxRate: 10 });
    await addLine(id, 'Default rate', 50);
    const inv = await getInvoice(id);
    expect(Number(inv.items[0].taxRate)).toBe(10);
    expect(Number(inv.taxAmount)).toBe(5);
    expect(Number(inv.totalAmount)).toBe(55);
  });

  it('TRN is captured on the invoice when supplied (REQ-147)', async () => {
    const id = await newDraft({ trn: `TRN-${tag}` });
    const inv = await getInvoice(id);
    expect(inv.trn).toBe(`TRN-${tag}`);
  });

  it('Job <-> invoice links work in both directions (DEC-071, REQ-134)', async () => {
    const job = await api()
      .post('/api/v1/jobs')
      .set(auth(adminToken))
      .send({ title: `P3 job ${tag}`, customerId })
      .expect(201);
    const jobId = job.body.data.id as string;

    const id = await newDraft({ jobIds: [jobId] });
    const inv = await getInvoice(id);
    expect(inv.jobLinks.map((l: { jobId: string }) => l.jobId)).toEqual([jobId]);

    const onJob = await api().get(`/api/v1/jobs/${jobId}/invoices`).set(auth(adminToken)).expect(200);
    expect(onJob.body.data.map((i: { id: string }) => i.id)).toContain(id);

    // Replacing the set with [] clears the link.
    await api()
      .patch(`/api/v1/invoices/${id}`)
      .set(auth(adminToken))
      .send({ jobIds: [] })
      .expect(200);
    const cleared = await getInvoice(id);
    expect(cleared.jobLinks).toEqual([]);
  });

  it('unknown Job or B/L ids are rejected with 404 (no dangling links)', async () => {
    await api()
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId, jobIds: ['does-not-exist'] })
      .expect(404);
    await api()
      .post('/api/v1/invoices')
      .set(auth(adminToken))
      .send({ customerId, billOfLadingIds: ['does-not-exist'] })
      .expect(404);
  });

  it('controlled correction: original kept with its money, replacement is a new DRAFT, audit recorded (DEC-020/021/023)', async () => {
    const id = await newDraft({ taxRate: 5, trn: `TRN-${tag}` });
    await addLine(id, 'Freight', 1000);
    await addLine(id, 'Handling', 250, 0);
    await api().post(`/api/v1/invoices/${id}/issue`).set(auth(adminToken)).expect(200);

    const before = await getInvoice(id);
    const snap = {
      subtotal: before.subtotal,
      taxRate: before.taxRate,
      taxAmount: before.taxAmount,
      discountAmount: before.discountAmount,
      totalAmount: before.totalAmount,
      paidAmount: before.paidAmount,
      items: before.items.map((i: { amount: string; taxAmount: string; taxRate: string }) => ({
        amount: i.amount,
        taxAmount: i.taxAmount,
        taxRate: i.taxRate,
      })),
    };

    const res = await api()
      .post(`/api/v1/invoices/${id}/corrections`)
      .set(auth(adminToken))
      .send({ reason: `Wrong freight rate ${tag}` })
      .expect(201);
    expect(res.body.data.status).toBe('APPLIED');
    const replacementId = res.body.data.replacementInvoiceId as string;
    expect(replacementId).toBeTruthy();

    // Original: CANCELLED, reason kept, money byte-identical to what was issued.
    const original = await getInvoice(id);
    expect(original.status).toBe('CANCELLED');
    expect(original.cancelReason).toContain(`Wrong freight rate ${tag}`);
    expect({
      subtotal: original.subtotal,
      taxRate: original.taxRate,
      taxAmount: original.taxAmount,
      discountAmount: original.discountAmount,
      totalAmount: original.totalAmount,
      paidAmount: original.paidAmount,
      items: original.items.map((i: { amount: string; taxAmount: string; taxRate: string }) => ({
        amount: i.amount,
        taxAmount: i.taxAmount,
        taxRate: i.taxRate,
      })),
    }).toEqual(snap);

    // Replacement: DRAFT with the same lines and VAT, new number.
    const replacement = await getInvoice(replacementId);
    expect(replacement.status).toBe('DRAFT');
    expect(replacement.invoiceNumber).not.toBe(original.invoiceNumber);
    expect(replacement.items.length).toBe(2);
    expect(replacement.trn).toBe(`TRN-${tag}`);
    expect(Number(replacement.totalAmount)).toBe(Number(original.totalAmount));

    // The link is visible from both sides.
    const list = await api().get(`/api/v1/invoices/${id}/corrections`).set(auth(adminToken)).expect(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(res.body.data.id);
    expect(replacement.correctionAsReplacement.originalInvoiceId).toBe(id);

    // Audit: the original's before-state and the replacement creation are both recorded.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'invoice.corrected', entityId: id },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(Number((audit?.beforeData as { totalAmount: string }).totalAmount)).toBe(Number(snap.totalAmount));
    const created = await prisma.auditLog.findFirst({
      where: { action: 'invoice.correction_replacement_created', entityId: replacementId },
    });
    expect(created).not.toBeNull();

    // A second correction of the same (now CANCELLED) invoice is refused.
    await api()
      .post(`/api/v1/invoices/${id}/corrections`)
      .set(auth(adminToken))
      .send({ reason: 'again' })
      .expect(409);
  });

  it('ADMIN holds the invoice correction permissions (catalogue + role grant)', async () => {
    const me = await api().get('/api/v1/auth/me').set(auth(adminToken)).expect(200);
    const codes: string[] = me.body.data.permissions;
    expect(codes).toEqual(expect.arrayContaining(['invoice:correct', 'invoice:approve_correction']));
  });

  it('DEC-116 reconciliation: ADMIN role should not hold release:override (open legacy item, phase-3 report section 8)', async () => {
    const me = await api().get('/api/v1/auth/me').set(auth(adminToken)).expect(200);
    expect(me.body.data.permissions).not.toContain('release:override');
  });

  it('correction requires invoice:correct (403 without it) and a reason (400 when blank)', async () => {
    const id = await newDraft();
    await addLine(id, 'Item', 10);
    await api().post(`/api/v1/invoices/${id}/issue`).set(auth(adminToken)).expect(200);
    await api()
      .post(`/api/v1/invoices/${id}/corrections`)
      .set(auth(noCorrectToken))
      .send({ reason: 'x' })
      .expect(403);
    await api()
      .post(`/api/v1/invoices/${id}/corrections`)
      .set(auth(adminToken))
      .send({ reason: '   ' })
      .expect(400);
  });

  it('approval gate (DEC-022): pending until approved by another user; non-owner requester cannot self-approve; rejection leaves the invoice ISSUED', async () => {
    const existing = await prisma.companySettings.findFirst();
    const settingsId = existing
      ? existing.id
      : (await prisma.companySettings.create({ data: { companyName: `P3 ${tag}` } })).id;
    const previous =
      (await prisma.companySettings.findUnique({ where: { id: settingsId } }))?.invoiceCorrectionApprovalRequired ??
      false;
    await prisma.companySettings.update({
      where: { id: settingsId },
      data: { invoiceCorrectionApprovalRequired: true },
    });

    try {
      // Case 1: requested by a non-owner user, refused self-approval, approved by another user.
      const id = await newDraft();
      await addLine(id, 'Item', 75, 5);
      await api().post(`/api/v1/invoices/${id}/issue`).set(auth(adminToken)).expect(200);
      const issued = await getInvoice(id);

      const req = await api()
        .post(`/api/v1/invoices/${id}/corrections`)
        .set(auth(requesterToken))
        .send({ reason: `Approval test ${tag}` })
        .expect(201);
      expect(req.body.data.status).toBe('PENDING_APPROVAL');
      const stillIssued = await getInvoice(id);
      expect(stillIssued.status).toBe('ISSUED');
      expect(Number(stillIssued.totalAmount)).toBe(Number(issued.totalAmount));

      // The requester holds invoice:approve_correction, so the 403 comes from the self-approval rule.
      await api()
        .post(`/api/v1/invoice-corrections/${req.body.data.id}/approve`)
        .set(auth(requesterToken))
        .expect(403);
      expect((await getInvoice(id)).status).toBe('ISSUED');

      // A different user with invoice:approve_correction approves: the correction applies.
      const approved = await api()
        .post(`/api/v1/invoice-corrections/${req.body.data.id}/approve`)
        .set(auth(approverToken))
        .expect(200);
      expect(approved.body.data.status).toBe('APPLIED');
      expect(approved.body.data.replacementInvoiceId).toBeTruthy();
      expect((await getInvoice(id)).status).toBe('CANCELLED');

      // Case 2: requested by the non-owner user, rejected by ADMIN; the original stays ISSUED.
      const id2 = await newDraft();
      await addLine(id2, 'Item', 20);
      await api().post(`/api/v1/invoices/${id2}/issue`).set(auth(adminToken)).expect(200);
      const req2 = await api()
        .post(`/api/v1/invoices/${id2}/corrections`)
        .set(auth(requesterToken))
        .send({ reason: `Reject test ${tag}` })
        .expect(201);
      const rej = await api()
        .post(`/api/v1/invoice-corrections/${req2.body.data.id}/reject`)
        .set(auth(adminToken))
        .send({ reason: 'Not needed' })
        .expect(200);
      expect(rej.body.data.status).toBe('REJECTED');
      expect((await getInvoice(id2)).status).toBe('ISSUED');
    } finally {
      // Restore the approval flag only. Records created by the test are kept.
      await prisma.companySettings.update({
        where: { id: settingsId },
        data: { invoiceCorrectionApprovalRequired: previous },
      });
    }
  });

  it('DEC-116: the primary administrator may approve their own correction directly (no approval from another user)', async () => {
    // Precondition: the owner account from the task is the primary administrator.
    const adminRow = await prisma.user.findUnique({ where: { email: admin.email } });
    expect(adminRow?.isPrimaryAdmin).toBe(true);

    const existing = await prisma.companySettings.findFirst();
    const settingsId = existing
      ? existing.id
      : (await prisma.companySettings.create({ data: { companyName: `P3 ${tag}` } })).id;
    const previous =
      (await prisma.companySettings.findUnique({ where: { id: settingsId } }))?.invoiceCorrectionApprovalRequired ??
      false;
    await prisma.companySettings.update({
      where: { id: settingsId },
      data: { invoiceCorrectionApprovalRequired: true },
    });

    try {
      const id = await newDraft();
      await addLine(id, 'Item', 30);
      await api().post(`/api/v1/invoices/${id}/issue`).set(auth(adminToken)).expect(200);
      const req = await api()
        .post(`/api/v1/invoices/${id}/corrections`)
        .set(auth(adminToken))
        .send({ reason: `Owner approval test ${tag}` })
        .expect(201);
      expect(req.body.data.status).toBe('PENDING_APPROVAL');

      const approved = await api()
        .post(`/api/v1/invoice-corrections/${req.body.data.id}/approve`)
        .set(auth(adminToken))
        .expect(200);
      expect(approved.body.data.status).toBe('APPLIED');
      expect((await getInvoice(id)).status).toBe('CANCELLED');
    } finally {
      await prisma.companySettings.update({
        where: { id: settingsId },
        data: { invoiceCorrectionApprovalRequired: previous },
      });
    }
  });
});
