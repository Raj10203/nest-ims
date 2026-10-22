import { DataSource } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity.js';
import { Permission } from '../../entities/permission.entity.js';
import { Role } from '../../entities/role.entity.js';
import { Site } from '../../entities/site.entity.js';
import { UserFeatureRole } from '../../entities/user-feature-role.entity.js';
import { User } from '../../entities/user.entity.js';
import { changes, snapshot } from './audit-values.js';

describe('audit values', () => {
  // Metadata only: no connection is opened.
  const dataSource = new DataSource({
    type: 'mysql',
    database: 'unused',
    entities: [User, UserFeatureRole, Role, Permission, Site, AuditLog],
  });
  beforeAll(() => (dataSource as any).buildMetadatas());
  const users = () => dataSource.getMetadata(User);
  const columns = (...names: string[]) =>
    users().columns.filter((c) => names.includes(c.propertyName));

  it('snapshots audited columns only: no timestamps, no @NotAudited state', () => {
    const values = snapshot(users(), {
      id: 5,
      firstName: 'Jane',
      email: 'jane@example.com',
      emailOtpHash: 'otp-hash',
      emailOtpAttempts: 2,
      inviteTokenHash: 'invite-hash',
      refreshTokenHash: 'refresh-hash',
      mfaOtpHash: 'mfa-hash',
      createdAt: new Date(),
      updatedAt: new Date(),
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(values).toEqual({
      id: 5,
      firstName: 'Jane',
      email: 'jane@example.com',
      emailVerifiedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('keeps only the updated audited columns, before and after', () => {
    expect(
      changes(
        users(),
        { firstName: 'Jane', emailOtpHash: 'x' },
        { firstName: 'Janet', emailOtpHash: null },
        columns('firstName', 'emailOtpHash', 'updatedAt'),
      ),
    ).toEqual({
      oldValues: { firstName: 'Jane' },
      newValues: { firstName: 'Janet' },
    });
  });

  it('keeps a password change (masked later by AuditService)', () => {
    expect(
      changes(users(), {}, { password: 'scrypt-hash' }, columns('password')),
    ).toEqual({
      oldValues: { password: null },
      newValues: { password: 'scrypt-hash' },
    });
  });

  it('returns null when nothing audited changed', () => {
    expect(
      changes(users(), {}, { mfaOtpAttempts: 1 }, columns('mfaOtpAttempts')),
    ).toEqual({ oldValues: null, newValues: null });
  });
});
