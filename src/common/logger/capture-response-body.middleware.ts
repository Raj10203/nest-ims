import type { NextFunction, Request, Response } from 'express';

export const RESPONSE_BODY = 'responseBody';

// pino-http does not expose response bodies, so keep what the handler sent.
export function captureResponseBody(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  const send = res.send.bind(res);
  res.send = (body?: unknown) => {
    res.locals[RESPONSE_BODY] = body;
    return send(body);
  };
  next();
}

export function parseResponseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}
