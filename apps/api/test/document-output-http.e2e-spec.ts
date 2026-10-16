import { CanActivate, ExecutionContext, INestApplication, UnauthorizedException,
  ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedUser } from '../src/common/auth/types';
import { PermissionsGuard } from '../src/common/auth/guards/permissions.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { DocumentOutputController } from '../src/modules/document-output/document-output.controller';
import { DocumentOutputService } from '../src/modules/document-output/document-output.service';
import { DocumentAssetsController } from '../src/modules/document-output/document-assets.controller';
import { DocumentAssetsService } from '../src/modules/document-output/document-assets.service';
import { DocumentTemplateController } from '../src/common/infrastructure/templates/document-template.controller';
import { DocumentTemplateService } from '../src/common/infrastructure/templates/document-template.service';
import { DocumentDataService } from '../src/modules/document-output/document-data.service';
import { DocumentRendererService } from '../src/modules/document-output/document-renderer.service';
import { AuditService } from '../src/common/infrastructure/audit/audit.service';
import { CompanySettingsService } from '../src/modules/company-settings/company-settings.service';
import type { PrismaService } from '../src/prisma/prisma.service';

/** HTTP permission and binary contract only: all providers are in-memory; no DB is opened. */
const principal = (id: string, permissions: string[], isPrimaryAdmin = false): AuthenticatedUser =>
  ({ id, email: `${id}@example.test`, roles: [], permissions, isPrimaryAdmin });
const actors: Record<string, AuthenticatedUser> = {
  owner: principal('owner', [], true),
  portal: { ...principal('portal', ['portal:access', 'document:render', 'invoice:read']),
    portalAgentId: 'agent-1' }, // mistaken office grants must NOT bypass destination scope
  reader: principal('reader', ['document:render', 'invoice:read']),
  customerPortal: { ...principal('customerPortal', ['portal:access', 'document:render', 'invoice:read']),
    portalCustomerId: 'customer-1' },
  manage: principal('manager', ['document:manage']),
  approve: principal('approver', ['document:approve']),
  both: principal('both', ['document:manage', 'document:approve']),
};

class TestIdentityGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!actors[token]) throw new UnauthorizedException();
    req.user = actors[token];
    return true;
  }
}

let app: INestApplication;
let rendered = 0;
let assignments = 0;
let approvals = 0;
beforeAll(async () => {
  const db = { documentIssuedSnapshot: { findUnique: async () => null } } as unknown as PrismaService;
  const output = new DocumentOutputService(db,
    { versionAt: async () => null } as unknown as DocumentTemplateService,
    { get: async (type: string, id: string) => ({ type, id, number: 'INV-1', status: 'DRAFT',
      issued: false, effectiveAt: null, fields: { number: 'INV-1' }, rows: [] }) } as unknown as DocumentDataService,
    { render: async () => { rendered++; return Buffer.from('%PDF-phase8-test'); } } as unknown as DocumentRendererService,
    { getDocumentIdentity: async () => null } as unknown as CompanySettingsService);
  const module = await Test.createTestingModule({
    controllers: [DocumentOutputController, DocumentTemplateController, DocumentAssetsController],
    providers: [
      Reflector,
      { provide: AuditService, useValue: { record: async () => undefined } },
      { provide: DocumentOutputService, useValue: output },
      { provide: DocumentTemplateService, useValue: {
        list: async () => [], listPage: async () => ({ items: [], total: 0 }),
        create: async () => ({ id: 'template-1' }),
        getVersion: async () => ({ id: 'version-1' }),
        assign: async () => { assignments++; return { id: 'version-1' }; },
      } },
      { provide: DocumentAssetsService, useValue: {
        list: async () => [], approve: async () => { approvals++; return { id: 'asset-1' }; },
      } },
    ],
  }).compile();
  app = module.createNestApplication();
  app.useGlobalGuards(new TestIdentityGuard(), new PermissionsGuard(module.get(Reflector)));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
});
afterAll(async () => { await app?.close(); });

it('requires authentication, refuses portal and returns raw document bytes only with BOTH source and render grants', async () => {
  const server = app.getHttpServer();
  await request(server).get('/documents/output/catalogue').expect(401);
  await request(server).get('/documents/output/catalogue').set('Authorization', 'Bearer portal').expect(403);
  const catalogue = await request(server).get('/documents/output/catalogue')
    .set('Authorization', 'Bearer reader').expect(200);
  expect(catalogue.body.data).toHaveLength(11);
  await request(server).get('/documents/output/invoice/record-123/pdf')
    .set('Authorization', 'Bearer portal').expect(403);
  await request(server).get('/documents/output/invoice/record-123/pdf')
    .set('Authorization', 'Bearer customerPortal').expect(403);
  await request(server).get('/documents/output/bill/record-123/pdf')
    .set('Authorization', 'Bearer reader').expect(403);
  const before = rendered;
  const file = await request(server).get('/documents/output/invoice/record-123/print')
    .set('Authorization', 'Bearer reader').expect(200);
  expect(file.headers['content-type']).toContain('application/pdf');
  expect(file.headers['cache-control']).toBe('private, no-store');
  expect(file.headers['content-disposition']).toContain('inline');
  expect(file.body.toString()).toBe('%PDF-phase8-test');
  expect(rendered).toBe(before + 1);
});

it('requires management AND approval for assignment and artwork approval', async () => {
  const server = app.getHttpServer();
  const listing = await request(server).get('/infrastructure/templates?limit=10&offset=0')
    .set('Authorization', 'Bearer manage').expect(200);
  expect(listing.body.data).toEqual({ items: [], total: 0 });
  const path = '/infrastructure/templates/template-1/versions/1/assign';
  await request(server).post(path).set('Authorization', 'Bearer portal').expect(403);
  await request(server).post(path).set('Authorization', 'Bearer manage').expect(403);
  await request(server).post(path).set('Authorization', 'Bearer approve').expect(403);
  await request(server).post(path).set('Authorization', 'Bearer both').expect(201);
  expect(assignments).toBe(1);
  await request(server).post('/documents/assets/asset-1/approve')
    .set('Authorization', 'Bearer approve').expect(403);
  await request(server).post('/documents/assets/asset-1/approve')
    .set('Authorization', 'Bearer both').expect(201);
  expect(approvals).toBe(1);
});
