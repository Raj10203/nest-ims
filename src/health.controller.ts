import { Controller, Get } from '@nestjs/common';
import { Public } from './modules/auth/public.decorator.js';

// Served at /health, outside the global /api prefix (see app.setup.ts).
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok its fine' };
  }
}
