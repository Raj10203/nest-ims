// Emitted after an email change is saved; the pending invitation link (sent to
// the old address) is already cancelled by then. Listeners must not throw.
export const USER_EMAIL_CHANGED = 'user.email-changed';

export class UserEmailChangedEvent {
  constructor(
    readonly userId: number,
    readonly email: string,
    readonly firstName: string,
  ) {}
}
