import { maskSecrets } from './mask-secrets.js';

describe('maskSecrets', () => {
  it('masks secret-looking keys at any depth and keeps the rest', () => {
    const masked = maskSecrets({
      email: 'a@example.com',
      password: 'hunter2',
      accessToken: 'jwt',
      refreshToken: 'jwt2',
      otp: '123456',
      user: { emailOtpHash: 'x', refreshTokenHash: 'y', firstName: 'A' },
      items: [{ Authorization: 'Bearer z', name: 'ok' }],
    });
    expect(masked).toEqual({
      email: 'a@example.com',
      password: '[REDACTED]',
      accessToken: '[REDACTED]',
      refreshToken: '[REDACTED]',
      otp: '[REDACTED]',
      user: {
        emailOtpHash: '[REDACTED]',
        refreshTokenHash: '[REDACTED]',
        firstName: 'A',
      },
      items: [{ Authorization: '[REDACTED]', name: 'ok' }],
    });
  });

  it('does not mutate the input', () => {
    const input = { password: 'p' };
    maskSecrets(input);
    expect(input.password).toBe('p');
  });

  it('passes primitives through and truncates huge strings', () => {
    expect(maskSecrets(5)).toBe(5);
    expect(maskSecrets(null)).toBeNull();
    expect(maskSecrets('x'.repeat(20_000)) as string).toContain('[truncated]');
  });
});
