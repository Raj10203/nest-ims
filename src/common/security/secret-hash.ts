import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  secret: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

// Used for both passwords and refresh tokens. Stored as `<salt>:<hash>` (hex).
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(secret, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(
    secret,
    Buffer.from(saltHex, 'hex'),
    KEY_LENGTH,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
