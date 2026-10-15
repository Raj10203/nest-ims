import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';
import {
  captureResponseBody,
  parseResponseBody,
  RESPONSE_BODY,
} from './capture-response-body.middleware.js';
import { maskSecrets } from './mask-secrets.js';

const targets = [
  { target: 'pino/file', level: 'trace', options: { destination: 1 } },
  ...(env.LOG_FILE
    ? [
        {
          target: 'pino-roll',
          level: 'trace',
          options: {
            file: env.LOG_FILE,
            frequency: 'daily',
            size: '20m',
            dateFormat: 'yyyy-MM-dd',
            extension: '.log',
            mkdir: true,
            limit: { count: 14 },
          },
        },
      ]
    : []),
];

// Bodies are logged in full in development or at LOG_LEVEL debug/trace. In
// production only metadata is logged, plus the request body of failed requests
// when LOG_REQUEST_BODY is on. Secrets are always masked.
const logFullBodies =
  env.NODE_ENV === 'development' ||
  env.LOG_LEVEL === 'debug' ||
  env.LOG_LEVEL === 'trace';
const logFailedRequestBody = env.LOG_REQUEST_BODY === true;

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL ?? 'info',
        transport: { targets },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        // Evaluated when the response finishes, so req.user is already set.
        customProps: (req, res) => {
          const { user, body, query } = req as typeof req & {
            user?: User;
            body?: unknown;
            query?: unknown;
          };
          const failed = res.statusCode >= 400;
          return {
            ...(user ? { userId: user.id, role: user.role?.name } : {}),
            ...(logFullBodies || (logFailedRequestBody && failed)
              ? {
                  requestBody: maskSecrets(body),
                  requestQuery: maskSecrets(query),
                }
              : {}),
            ...(logFullBodies
              ? {
                  responseBody: maskSecrets(
                    parseResponseBody(
                      (res as typeof res & { locals?: Record<string, unknown> })
                        .locals?.[RESPONSE_BODY],
                    ),
                  ),
                }
              : {}),
          };
        },
        autoLogging: { ignore: (req) => req.url === '/health' },
        customLogLevel: (_req, res, err) => {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),
  ],
})
export class AppLoggerModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    if (logFullBodies) consumer.apply(captureResponseBody).forRoutes('*path');
  }
}
