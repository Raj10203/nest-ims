import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { NotAudited } from '../common/audit/not-audited.decorator.js';
import { NotificationType } from '../common/enums/notification-type.enum.js';
import { BaseEntity } from './base.entity.js';
import { User } from './user.entity.js';

// A user's inbox. The change it points to is audited where it happened.
@NotAudited()
@Entity('notifications')
@Index(['userId', 'readAt'])
export class Notification extends BaseEntity {
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'int' })
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  // Shape per type: NotificationData (modules/notifications).
  @Column({ type: 'json' })
  data: object;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;
}
