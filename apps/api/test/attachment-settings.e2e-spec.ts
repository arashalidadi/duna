import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { signAttachmentToken } from '../src/common/infrastructure/attachment/attachment-url';

/**
 * Phase 4 — company settings (TRN, address), identity-document attachments, MIME/size rejection,
 * permission enforcement and signed-URL expiry (e2e).
 *
 * PREREQUISITES (all must hold before running):
 *  - Database migrated to the current schema and seeded with the Phase 4 permission codes
 *    (`settings:*`, `attachment:*`). The seed only ADDS grants; it does not revoke anything.
 *  - ATTACHMENT_STORAGE_DIR: absolute directory OUTSIDE the repository, writable by the API.
 *  - ATTACHMENT_URL_SECRET: at least 32 characters. The test signs an expired token with it.
 *  - ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true. Identity capture is OFF by default in production
 *    until the retention period and lawful basis are recorded (OQ-12). Set this only for a
 *    test or disposable environment.
 *
 * DATA: creates a customer, a RECEIPT voucher, two test users and two roles with a `tag` suffix,
 * and uploads test files into ATTACHMENT_STORAGE_DIR. Soft-deletes the one attachment it creates.
 * It temporarily updates CompanySettings (TRN, address) and restores the previous values in
 * afterAll. It never runs the seed and never resets or cleans the database.
 */
describe('Attachments and company settings Phase 4 (e2e)', () => {
  let app: INestApplication;
  const admin = {
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
  };
  const tag = Math.random().toString(36).slice(2, 8);
  const secret = process.env.ATTACHMENT_URL_SECRET ?? '';
  let adminToken = '';
  let basicToken = '';
  let identityToken = '';
  let customerId = '';
  let voucherId = '';
  let attachmentId = '';
  let downloadPath = '';
  let previousSettings: Record<string, string | null> | null = null;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  // Collects a binary response body (supertest does not buffer application/pdf by default).
  type BinaryParser = Extract<Parameters<request.Test['parse']>[0], (res: never, callback: never) => void>;
  const binaryParser: BinaryParser = (res, callback) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
    res.on('error', (err: Error) => callback(err, Buffer.alloc(0)));
  };
  const api = () => request(app.getHttpServer());
  const pdfBytes = (extra = 256) =>
    Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(extra, 0x20)]);

  beforeAll(async () => {
    if (!process.env.ATTACHMENT_STORAGE_DIR || !process.env.ATTACHMENT_STORAGE_DIR.startsWith('/')) {
      throw new Error('Set ATTACHMENT_STORAGE_DIR to an absolute directory outside the repository');
    }
    if (secret.length < 32) {
      throw new Error('Set ATTACHMENT_URL_SECRET (at least 32 characters)');
    }
    if (process.env.ATTACHMENT_IDENTITY_CAPTURE_ENABLED !== 'true') {
      throw new Error('Set ATTACHMENT_IDENTITY_CAPTURE_ENABLED=true for this test environment only');
    }

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
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    const login = await api().post('/api/v1/auth/login').send(admin).expect(200);
    adminToken = login.body.data.accessToken as string;

    const perms = await api().get('/api/v1/permissions/all').set(auth(adminToken)).expect(200);
    const idOf = (code: string) => perms.body.data.find((p: { code: string }) => p.code === code).id as string;

    const customer = await api()
      .post('/api/v1/customers')
      .set(auth(adminToken))
      .send({ code: `P4-${tag.toUpperCase()}`, name: `Phase 4 test ${tag}`, personKind: 'LEGAL' })
      .expect(201);
    customerId = customer.body.data.id as string;

    const voucher = await api()
      .post('/api/v1/vouchers')
      .set(auth(adminToken))
      .send({ type: 'RECEIPT', customerId, amount: 100 })
      .expect(201);
    voucherId = voucher.body.data.id as string;

    // Role A: company settings read + attachment read/create/delete, but NOT identity.
    const roleA = await api()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: `P4A${tag}`.toUpperCase(), name: `P4 basic ${tag}` })
      .expect(201);
    await api()
      .patch(`/api/v1/roles/${roleA.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({
        permissionIds: [
          idOf('voucher:read'),
          idOf('settings:read'),
          idOf('attachment:read'),
          idOf('attachment:create'),
          idOf('attachment:delete'),
        ],
      })
      .expect(200);
    const basicEmail = `p4-basic-${tag}@example.test`;
    await api()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: basicEmail, password: 'ChangeMe123!', fullName: `P4 basic ${tag}`, roleIds: [roleA.body.data.id] })
      .expect(201);
    basicToken = (await api().post('/api/v1/auth/login').send({ email: basicEmail, password: 'ChangeMe123!' }).expect(200))
      .body.data.accessToken as string;

    // Role B: as Role A plus attachment:identity.
    const roleB = await api()
      .post('/api/v1/roles')
      .set(auth(adminToken))
      .send({ code: `P4B${tag}`.toUpperCase(), name: `P4 identity ${tag}` })
      .expect(201);
    await api()
      .patch(`/api/v1/roles/${roleB.body.data.id}/permissions`)
      .set(auth(adminToken))
      .send({
        permissionIds: [
          idOf('voucher:read'),
          idOf('settings:read'),
          idOf('attachment:read'),
          idOf('attachment:create'),
          idOf('attachment:delete'),
          idOf('attachment:identity'),
        ],
      })
      .expect(200);
    const identityEmail = `p4-identity-${tag}@example.test`;
    await api()
      .post('/api/v1/users')
      .set(auth(adminToken))
      .send({ email: identityEmail, password: 'ChangeMe123!', fullName: `P4 identity ${tag}`, roleIds: [roleB.body.data.id] })
      .expect(201);
    identityToken = (await api().post('/api/v1/auth/login').send({ email: identityEmail, password: 'ChangeMe123!' }).expect(200))
      .body.data.accessToken as string;
  });

  afterAll(async () => {
    if (previousSettings) {
      await api().patch('/api/v1/company-settings').set(auth(adminToken)).send(previousSettings);
    }
    await app?.close();
  });

  describe('company settings', () => {
    it('reads the current settings for an authorised user', async () => {
      const res = await api().get('/api/v1/company-settings').set(auth(basicToken)).expect(200);
      expect(res.body.data).toEqual(expect.objectContaining({ companyName: expect.any(String) }));
      previousSettings = {
        taxNumber: res.body.data.taxNumber,
        address: res.body.data.address,
      };
    });

    it('updates TRN and address and reads them back (round-trip)', async () => {
      const trn = `P4-TRN-${tag}`;
      await api()
        .patch('/api/v1/company-settings')
        .set(auth(adminToken))
        .send({ taxNumber: `  ${trn}  `, address: `Unit ${tag}, Test Street` })
        .expect(200);
      const res = await api().get('/api/v1/company-settings').set(auth(adminToken)).expect(200);
      expect(res.body.data.taxNumber).toBe(trn);
      expect(res.body.data.address).toBe(`Unit ${tag}, Test Street`);
    });

    it('rejects an update without settings:update', async () => {
      await api().patch('/api/v1/company-settings').set(auth(basicToken)).send({ city: 'X' }).expect(403);
    });

    it('rejects a default currency outside the supported list', async () => {
      await api()
        .patch('/api/v1/company-settings')
        .set(auth(adminToken))
        .send({ supportedCurrencies: ['USD'], defaultCurrency: 'AED' })
        .expect(400);
    });
  });

  describe('identity-document attachments', () => {
    it('rejects an upload without attachment:identity (403)', async () => {
      await api()
        .post('/api/v1/attachments')
        .set(auth(basicToken))
        .field('entityType', 'VOUCHER')
        .field('entityId', voucherId)
        .field('category', 'ID_FRONT')
        .attach('file', pdfBytes(), { filename: 'id.pdf', contentType: 'application/pdf' })
        .expect(403);
    });

    it('uploads an identity document to a voucher (201) and keeps the storage key private', async () => {
      const res = await api()
        .post('/api/v1/attachments')
        .set(auth(identityToken))
        .field('entityType', 'VOUCHER')
        .field('entityId', voucherId)
        .field('category', 'ID_FRONT')
        .attach('file', pdfBytes(), { filename: 'id-front.pdf', contentType: 'application/pdf' })
        .expect(201);
      attachmentId = res.body.data.id as string;
      expect(res.body.data).toEqual(expect.objectContaining({ category: 'ID_FRONT', mimeType: 'application/pdf', size: pdfBytes().length }));
      expect(res.body.data.storageKey).toBeUndefined();
    });

    it('rejects a MIME type outside the allow-list (415)', async () => {
      await api()
        .post('/api/v1/attachments')
        .set(auth(identityToken))
        .field('entityType', 'VOUCHER')
        .field('entityId', voucherId)
        .field('category', 'ID_BACK')
        .attach('file', Buffer.from('<html></html>'), { filename: 'x.html', contentType: 'text/html' })
        .expect(415);
    });

    it('rejects content that does not match its declared type (400)', async () => {
      await api()
        .post('/api/v1/attachments')
        .set(auth(identityToken))
        .field('entityType', 'VOUCHER')
        .field('entityId', voucherId)
        .field('category', 'ID_BACK')
        .attach('file', pdfBytes(), { filename: 'fake.png', contentType: 'image/png' })
        .expect(400);
    });

    it('rejects a file above the size cap (413)', async () => {
      await api()
        .post('/api/v1/attachments')
        .set(auth(identityToken))
        .field('entityType', 'VOUCHER')
        .field('entityId', voucherId)
        .field('category', 'SIGNATURE')
        .attach('file', pdfBytes(10 * 1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' })
        .expect(413);
    });

    it('rejects an entity type outside the Phase 4 scope (400)', async () => {
      await api()
        .post('/api/v1/attachments')
        .set(auth(identityToken))
        .field('entityType', 'CUSTOMER')
        .field('entityId', customerId)
        .field('category', 'ID_FRONT')
        .attach('file', pdfBytes(), { filename: 'id.pdf', contentType: 'application/pdf' })
        .expect(400);
    });

    it('hides identity documents from a user without attachment:identity (403)', async () => {
      await api().get(`/api/v1/attachments/${attachmentId}`).set(auth(basicToken)).expect(403);
      await api().post(`/api/v1/attachments/${attachmentId}/url`).set(auth(basicToken)).expect(403);
      await api().get('/api/v1/attachments').set(auth(basicToken)).query({ entityType: 'VOUCHER', entityId: voucherId }).expect(403);
    });

    it('lists and reads metadata for an authorised user', async () => {
      const list = await api()
        .get('/api/v1/attachments')
        .set(auth(identityToken))
        .query({ entityType: 'VOUCHER', entityId: voucherId })
        .expect(200);
      expect(list.body.data.items.some((i: { id: string }) => i.id === attachmentId)).toBe(true);
      expect(list.body.data.items.every((i: { storageKey?: string }) => i.storageKey === undefined)).toBe(true);
      await api().get(`/api/v1/attachments/${attachmentId}`).set(auth(identityToken)).expect(200);
    });

    it('issues a short-lived signed URL and downloads the file with it', async () => {
      const issued = await api().post(`/api/v1/attachments/${attachmentId}/url`).set(auth(identityToken)).expect(200);
      expect(issued.body.data.path).toMatch(/^attachments\/download\?token=/);
      expect(Date.parse(issued.body.data.expiresAt)).toBeGreaterThan(Date.now());
      downloadPath = `/api/v1/${issued.body.data.path as string}`;

      const file = await api().get(downloadPath).buffer(true).parse(binaryParser).expect(200);
      expect(file.headers['content-type']).toContain('application/pdf');
      expect(file.headers['cache-control']).toBe('no-store');
      expect(file.headers['x-content-type-options']).toBe('nosniff');
      expect(Buffer.isBuffer(file.body) && file.body.equals(pdfBytes())).toBe(true);
    });

    it('rejects a tampered signed URL (401)', async () => {
      const token = decodeURIComponent(downloadPath.split('token=')[1]);
      const [payload] = token.split('.');
      const forged = `${Buffer.from(JSON.stringify({ aid: 'other', uid: 'x', exp: 9999999999 })).toString('base64url')}.${token.split('.')[1]}`;
      expect(payload).toBeTruthy();
      await api().get(`/api/v1/attachments/download?token=${encodeURIComponent(forged)}`).expect(401);
    });

    it('rejects an expired signed URL (401)', async () => {
      const expired = signAttachmentToken(
        { aid: attachmentId, uid: 'expired-test', exp: Math.floor(Date.now() / 1000) - 1 },
        secret
      );
      await api().get(`/api/v1/attachments/download?token=${encodeURIComponent(expired)}`).expect(401);
    });

    it('serves no unauthenticated file path', async () => {
      await api().get(`/api/v1/attachments/${attachmentId}/content`).expect(404);
    });

    it('does not capture identity documents while capture is disabled (403)', async () => {
      const previous = process.env.ATTACHMENT_IDENTITY_CAPTURE_ENABLED;
      process.env.ATTACHMENT_IDENTITY_CAPTURE_ENABLED = 'false';
      try {
        await api()
          .post('/api/v1/attachments')
          .set(auth(identityToken))
          .field('entityType', 'VOUCHER')
          .field('entityId', voucherId)
          .field('category', 'ID_FRONT')
          .attach('file', pdfBytes(), { filename: 'id.pdf', contentType: 'application/pdf' })
          .expect(403);
      } finally {
        if (previous === undefined) {
          delete process.env.ATTACHMENT_IDENTITY_CAPTURE_ENABLED;
        } else {
          process.env.ATTACHMENT_IDENTITY_CAPTURE_ENABLED = previous;
        }
      }
    });

    it('soft-deletes an attachment; it is then unreachable (404)', async () => {
      await api().delete(`/api/v1/attachments/${attachmentId}`).set(auth(basicToken)).expect(403);
      await api().delete(`/api/v1/attachments/${attachmentId}`).set(auth(identityToken)).expect(200);
      await api().get(`/api/v1/attachments/${attachmentId}`).set(auth(identityToken)).expect(404);
      await api().get(downloadPath).expect(404);
    });
  });
});
