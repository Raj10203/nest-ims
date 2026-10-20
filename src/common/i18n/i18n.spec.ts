import {
  Body,
  Controller,
  Get,
  INestApplication,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { verifyEmailOtpSchema } from '../../modules/auth/dto/verify-email-otp.dto.js';
import { ZodValidationPipe } from '../zod/zod-validation.pipe.js';
import { AppI18nModule } from './app-i18n.module.js';
import { I18nExceptionFilter } from './i18n-exception.filter.js';
import { i18nMessage } from './i18n-message.js';

@Controller()
class TestController {
  @Get('missing')
  missing() {
    throw new NotFoundException(
      i18nMessage('errors.users.notFound', { id: 7 }),
    );
  }

  @Get('plain')
  plain() {
    throw new NotFoundException('Plain text');
  }

  @Post('otp')
  otp(@Body({ schema: verifyEmailOtpSchema }) body: unknown) {
    return body;
  }
}

describe('i18n (filter + validation pipe)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppI18nModule],
      controllers: [TestController],
      providers: [
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: APP_FILTER, useClass: I18nExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('translates an error key with its arguments, English by default', async () => {
    const { status, body } = await request(app.getHttpServer()).get('/missing');
    expect(status).toBe(404);
    expect(body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'User 7 not found',
    });
  });

  it('picks the language from ?lang= and from Accept-Language', async () => {
    const server = app.getHttpServer();
    const hindi = await request(server).get('/missing?lang=hi');
    expect(hindi.body.message).toBe('उपयोगकर्ता 7 नहीं मिला');
    const gujarati = await request(server)
      .get('/missing')
      .set('Accept-Language', 'gu-IN,gu;q=0.9');
    expect(gujarati.body.message).toBe('વપરાશકર્તા 7 મળ્યો નથી');
  });

  it('falls back to English for an unsupported language', async () => {
    const { body } = await request(app.getHttpServer()).get('/missing?lang=fr');
    expect(body.message).toBe('User 7 not found');
  });

  it('leaves a message that is not a key untouched', async () => {
    const { body } = await request(app.getHttpServer()).get('/plain?lang=hi');
    expect(body.message).toBe('Plain text');
  });

  it('translates validation errors: custom keys and zod built-in messages', async () => {
    const server = app.getHttpServer();
    const custom = await request(server)
      .post('/otp?lang=hi')
      .send({ otp: '12' });
    expect(custom.status).toBe(400);
    expect(custom.body.message).toBe('सत्यापन विफल रहा');
    expect(custom.body.errors).toEqual([
      { path: 'otp', message: 'OTP 6 अंकों का होना चाहिए' },
    ]);

    const builtIn = await request(server).post('/otp?lang=gu').send({});
    expect(builtIn.body.errors[0].path).toBe('otp');
    // zod's Gujarati locale (type names such as "string" stay English).
    expect(builtIn.body.errors[0].message).toMatch(/^અમાન્ય ઇનપુટ/);
  });
});
