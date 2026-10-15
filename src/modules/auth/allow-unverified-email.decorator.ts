import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL = 'allow_unverified_email';

// Lets a route through the global email-verified check in JwtAuthGuard.
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL, true);
