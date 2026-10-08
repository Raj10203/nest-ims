import { SetMetadata } from '@nestjs/common';

export const CHECK_ABILITY = 'check_ability';

export interface RequiredAbility {
  action: string;
  subject: string;
}

// Class-level gate (does the role have this permission at all). Instance-level
// checks (is this particular user manageable) happen in the service.
export const CheckAbility = (action: string, subject: string) =>
  SetMetadata<string, RequiredAbility>(CHECK_ABILITY, { action, subject });
