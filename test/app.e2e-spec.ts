import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('serves the liveness check without the api prefix', () => {
    return request(app.getHttpServer())
      .get('/health/live')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('reports each dependency separately on /health', async () => {
    const { status, body } = await request(app.getHttpServer()).get('/health');
    // 503 is valid too: the report is what matters, whatever is running.
    expect([200, 503]).toContain(status);
    expect(Object.keys(body.details)).toEqual(
      expect.arrayContaining(['database', 'rabbitmq', 'worker']),
    );
    for (const service of Object.values<{ status: string }>(body.details)) {
      expect(['up', 'down']).toContain(service.status);
    }
  });

  it('does not serve the health checks under /api', () => {
    return request(app.getHttpServer()).get('/api/health').expect(404);
  });

  it('prefixes every other route with /api', async () => {
    await request(app.getHttpServer()).get('/users').expect(404);
    // Reaches the auth guard, so 401 rather than 404.
    await request(app.getHttpServer()).get('/api/users').expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({})
      .expect(400);
  });

  it('answers in the requested language', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api/users')
      .set('Accept-Language', 'hi');
    expect(body.message).toBe('बेयरर टोकन नहीं मिला');
  });

  it('sets security headers', async () => {
    const { headers } = await request(app.getHttpServer()).get('/health/live');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });

  afterEach(async () => {
    await app.close();
  });
});
