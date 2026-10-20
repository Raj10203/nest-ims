import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  entityType: z.string().max(50).optional().meta({ example: 'User' }),
  entityId: z.string().max(64).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  action: z.enum(['create', 'update', 'delete']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListAuditLogsQueryDto = z.output<typeof listAuditLogsQuerySchema>;
