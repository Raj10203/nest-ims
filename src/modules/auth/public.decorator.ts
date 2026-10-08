import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'is_public';

// Opts a route out of the global JwtAuthGuard.
export const Public = () => SetMetadata(IS_PUBLIC, true);
