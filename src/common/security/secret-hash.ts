import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  secret: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

// Salted and slow, for guessable secrets (passwords, OTPs) and refresh tokens.
// Stored as `<salt>:<hash>` (hex).
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

// For random tokens with 256 bits of entropy (invitation links): a fast,
// unsalted hash is safe there and lets the row be found by the hash.
// Passwords and other guessable secrets must use hashSecret.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
