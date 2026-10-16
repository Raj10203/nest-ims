import { SetMetadata } from '@nestjs/common';

export const ALLOW_UNVERIFIED_EMAIL = 'allow_unverified_email';

// Bypasses JwtAuthGuard's email-verified check. The OTP routes, me and logout need it,
// or unverified users could never verify.
export const AllowUnverifiedEmail = () =>
  SetMetadata(ALLOW_UNVERIFIED_EMAIL, true);
