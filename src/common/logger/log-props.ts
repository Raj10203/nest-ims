import type { IncomingMessage, ServerResponse } from 'node:http';
import type { User } from '../../entities/user.entity.js';
import {
  parseResponseBody,
  RESPONSE_BODY,
} from './capture-response-body.middleware.js';
import { maskSecrets } from './mask-secrets.js';

export interface BodyLogging {
  // Request and response bodies (development).
  full: boolean;
  // Request body only, never the response (production flag).
  requestOnly: boolean;
}

export function createLogProps(mode: BodyLogging) {
  return (req: IncomingMessage, res: ServerResponse) => {
    // pino-http calls this at request start and end and adds both results, so
    // return nothing until the response has started (req.user is set by then).
    if (!res.headersSent) return {};

    const { user, body, query } = req as IncomingMessage & {
      user?: User;
      body?: unknown;
      query?: unknown;
    };
    const locals = (
      res as ServerResponse & { locals?: Record<string, unknown> }
    ).locals;

    return {
      ...(user ? { userId: user.id, role: user.role?.name } : {}),
      ...(mode.full || mode.requestOnly
        ? { requestBody: maskSecrets(body), requestQuery: maskSecrets(query) }
        : {}),
      ...(mode.full
        ? {
            responseBody: maskSecrets(
              parseResponseBody(locals?.[RESPONSE_BODY]),
            ),
          }
        : {}),
    };
  };
}
