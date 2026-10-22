import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { BaseEntity } from './base.entity.js';
import { Role } from './role.entity.js';
import { Site } from './site.entity.js';
import { UserFeatureRole } from './user-feature-role.entity.js';

@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  middleName: string | null;

  @Column({ length: 100 })
  lastName: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  avatarUrl: string | null;

  // Null until the user accepts the invitation and sets it.
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  // SHA-256 of the invitation link's token (looked up by hash; see hashToken).
  @NotAudited()
  @Index()
  @Column({ type: 'char', length: 64, nullable: true, select: false })
  inviteTokenHash: string | null;

  @NotAudited()
  @Column({ type: 'timestamp', nullable: true, select: false })
  inviteExpiresAt: Date | null;

  @Column({ default: false })
  mfaEnabled: boolean;

  @NotAudited()
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  mfaOtpHash: string | null;

  @NotAudited()
  @Column({ type: 'timestamp', nullable: true, select: false })
  mfaOtpExpiresAt: Date | null;

  @NotAudited()
  @Column({ type: 'int', default: 0, select: false })
  mfaOtpAttempts: number;

  @NotAudited()
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  emailOtpHash: string | null;

  @NotAudited()
  @Column({ type: 'timestamp', nullable: true, select: false })
  emailOtpExpiresAt: Date | null;

  @NotAudited()
  @Column({ type: 'int', default: 0, select: false })
  emailOtpAttempts: number;

  // Hash of the latest issued refresh token; null when logged out.
  @NotAudited()
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  refreshTokenHash: string | null;

  @ManyToOne(() => Role, { nullable: false, eager: true })
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column()
  roleId: number;

  // Eager (with the role's permissions) so CaslAbilityFactory sees them on
  // the user JwtAuthGuard loads.
  @OneToMany(() => UserFeatureRole, (grant) => grant.user, { eager: true })
  featureRoles: UserFeatureRole[];

  // Required by the API; nullable in the database until every running version
  // sets it (a deploy keeps the old version serving during the migration).
  @ManyToOne(() => Site, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'siteId' })
  site: Site | null;

  @Column({ type: 'int', nullable: true })
  siteId: number | null;

  // The user who created this account (null for the seeded super admin).
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'int', nullable: true })
  createdById: number | null;
}
