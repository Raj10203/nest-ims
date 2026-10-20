// Emitted after a user is saved. Listeners must not throw: creation has
// already succeeded and the event is fire-and-forget.
export const USER_CREATED = 'user.created';

export class UserCreatedEvent {
  constructor(
    readonly userId: number,
    readonly email: string,
    readonly firstName: string,
  ) {}
}
