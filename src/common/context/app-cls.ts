import type { ClsStore } from 'nestjs-cls';

export interface Actor {
  id: number;
  role: string;
}

// Per-request values (nestjs-cls, AsyncLocalStorage): set by the CLS middleware
// (ip, request id) and by JwtAuthGuard (actor); read by AuditService.
export interface AppClsStore extends ClsStore {
  actor?: Actor;
  ip?: string;
}
