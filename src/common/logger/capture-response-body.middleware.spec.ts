import { parseResponseBody } from './capture-response-body.middleware.js';

describe('parseResponseBody', () => {
  it('parses a JSON string', () => {
    expect(parseResponseBody('{"ok":true}')).toEqual({ ok: true });
  });

  it('returns a non-string body unchanged', () => {
    const body = { ok: true };
    expect(parseResponseBody(body)).toBe(body);
    expect(parseResponseBody(undefined)).toBeUndefined();
  });

  it('returns text that is not JSON as is', () => {
    expect(parseResponseBody('plain text')).toBe('plain text');
  });
});
