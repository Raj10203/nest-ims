import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from '../../config/env.js';
import { captureResponseBody } from './capture-response-body.middleware.js';
import { createLogProps } from './log-props.js';

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

// Request and response bodies are logged only in development.
// In production only metadata is logged; LOG_REQUEST_BODY adds the request body,
// never the response. Secrets are always masked.
const logFullBodies = env.NODE_ENV === 'development';
const logRequestBody = env.LOG_REQUEST_BODY === true;

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL ?? 'info',
        transport: { targets },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        customProps: createLogProps({
          full: logFullBodies,
          requestOnly: logRequestBody,
        }),
        autoLogging: {
          ignore: (req) => req.url?.startsWith('/health') ?? false,
        },
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
