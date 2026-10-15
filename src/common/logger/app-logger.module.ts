import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from '../../config/env.js';
import { User } from '../../entities/user.entity.js';

// Logs JSON to stdout; also to a daily-rotating file when LOG_FILE is set.
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

// Runs as Express middleware, so guard rejections (401/403) and unknown routes
// are logged too. Body and query are logged only for failed requests.
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL ?? 'info',
        transport: { targets },
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'requestBody.password',
          'requestBody.refreshToken',
        ],
        // Evaluated when the response finishes, so req.user is already set.
        customProps: (req, res) => {
          const { user, body, query } = req as typeof req & {
            user?: User;
            body?: unknown;
            query?: unknown;
          };
          return {
            ...(user ? { userId: user.id, role: user.role?.name } : {}),
            ...(res.statusCode >= 400
              ? { requestBody: body, requestQuery: query }
              : {}),
          };
        },
        // Docker healthcheck polling.
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
export class AppLoggerModule {}
