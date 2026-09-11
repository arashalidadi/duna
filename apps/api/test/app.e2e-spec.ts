import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

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
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1 returns API info', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toContain('Shipping');
  });

  it('GET /api/v1/health returns ok status', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.status).toBe('up');
  });

  it('GET /api/v1/currencies lists supported currencies', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
        password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
      })
      .expect(200);
    const token = login.body.data.accessToken as string;
    const res = await request(app.getHttpServer())
      .get('/api/v1/currencies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    const codes = res.body.data.map((c: { code: string }) => c.code);
    expect(codes).toContain('USD');
    expect(codes).toContain('AED');
  });

  it('GET /api/v1/ports returns a paginated list', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: (process.env.SEED_ADMIN_EMAIL || 'admin@shipping.local').toLowerCase(),
        password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
      })
      .expect(200);
    const token = login.body.data.accessToken as string;
    const res = await request(app.getHttpServer())
      .get('/api/v1/ports')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data).toBeDefined();
    expect(res.body.data.meta).toBeDefined();
  });

  it('returns consistent error shape for unknown route', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.statusCode).toBe(404);
  });
});
