import { NotificationType } from '../../common/enums/notification-type.enum.js';
import type { User } from '../../entities/user.entity.js';

// Names as they were when it happened: the UI shows them as is.
export type PersonSummary = Pick<User, 'id' | 'firstName' | 'lastName'>;

// The `data` of each type, which is the contract with the UI.
export interface NotificationData {
  [NotificationType.STOCK_REQUEST_COMMENT]: {
    requestId: number;
    commentId: number;
    // The comment answered, when this one is a reply.
    parentId: number | null;
    excerpt: string;
    author: PersonSummary;
    repliedTo: PersonSummary | null;
  };
}
