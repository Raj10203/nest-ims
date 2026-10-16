import { RESPONSE_BODY } from './capture-response-body.middleware.js';
import { createLogProps } from './log-props.js';

const req = {
  user: { id: 7, role: { name: 'manager' } },
  body: { email: 'a@example.com', password: 'secret' },
  query: { page: '1' },
} as any;
const res = (headersSent = true) =>
  ({
    headersSent,
    locals: { [RESPONSE_BODY]: '{"accessToken":"jwt","ok":true}' },
  }) as any;

describe('createLogProps', () => {
  it('development: logs request and response bodies, masked', () => {
    const props = createLogProps({ full: true, requestOnly: false })(
      req,
      res(),
    );
    expect(props).toEqual({
      userId: 7,
      role: 'manager',
      requestBody: { email: 'a@example.com', password: '[REDACTED]' },
      requestQuery: { page: '1' },
      responseBody: { accessToken: '[REDACTED]', ok: true },
    });
  });

  it('production, flag off: only the user, no bodies', () => {
    const props = createLogProps({ full: false, requestOnly: false })(
      req,
      res(),
    );
    expect(props).toEqual({ userId: 7, role: 'manager' });
  });

  it('production, flag on: request body of every request, never the response', () => {
    const props = createLogProps({ full: false, requestOnly: true })(
      req,
      res(),
    );
    expect(props).toEqual({
      userId: 7,
      role: 'manager',
      requestBody: { email: 'a@example.com', password: '[REDACTED]' },
      requestQuery: { page: '1' },
    });
    expect(props).not.toHaveProperty('responseBody');
  });

  it('adds nothing at request start, so keys are not logged twice', () => {
    const props = createLogProps({ full: true, requestOnly: true })(
      req,
      res(false),
    );
    expect(props).toEqual({});
  });
});
