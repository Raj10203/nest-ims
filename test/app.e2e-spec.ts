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

  it('serves the health check without the api prefix', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('does not serve the health check under /api', () => {
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

  afterEach(async () => {
    await app.close();
  });
});
