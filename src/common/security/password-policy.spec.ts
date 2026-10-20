import {
  assertPasswordAvoidsNames,
  passwordSchema,
} from './password-policy.js';

describe('passwordSchema', () => {
  it('accepts 8+ characters with a capital, a small letter, a digit and a symbol', () => {
    expect(passwordSchema.safeParse('Password123!').success).toBe(true);
  });

  it.each([
    ['Pa1!', 'too short'],
    ['password123!', 'errors.password.uppercase'],
    ['PASSWORD123!', 'errors.password.lowercase'],
    ['Password!!!!', 'errors.password.digit'],
    ['Password1234', 'errors.password.symbol'],
  ])('rejects %s (%s)', (password, expected) => {
    const result = passwordSchema.safeParse(password);
    expect(result.success).toBe(false);
    if (expected.startsWith('errors.')) {
      expect(result.error!.issues.map((i) => i.message)).toContain(expected);
    }
  });
});

describe('assertPasswordAvoidsNames', () => {
  it('rejects a password containing the first or last name, in any case', () => {
    expect(() =>
      assertPasswordAvoidsNames('MyJANE#2026', ['Jane', 'Doe']),
    ).toThrow('errors.validationFailed');
    expect(() =>
      assertPasswordAvoidsNames('xxSharma@99', ['Ravi', 'sharma']),
    ).toThrow();
  });

  it('allows other passwords and ignores names shorter than 3 letters', () => {
    expect(() =>
      assertPasswordAvoidsNames('Password123!', ['Jane', 'Doe']),
    ).not.toThrow();
    expect(() =>
      assertPasswordAvoidsNames('Alpha#2026x', ['Al', null]),
    ).not.toThrow();
  });
});
