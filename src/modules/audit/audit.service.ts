import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { Brackets, EntityManager, Repository } from 'typeorm';
import type { AppClsStore } from '../../common/context/app-cls.js';
import { maskSecrets } from '../../common/logger/mask-secrets.js';
import { AuditAction, AuditLog } from '../../entities/audit-log.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableUsersWhere,
} from '../authorization/casl-ability.factory.js';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  // Overrides the signed-in actor, e.g. a user accepting their own invitation.
  actorId?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly cls: ClsService<AppClsStore>,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  // Pass the change's EntityManager so the row commits or rolls back with it.
  async record(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const inRequest = this.cls.isActive();
    const actor = inRequest ? this.cls.get('actor') : undefined;
    await (manager ?? this.logs.manager).insert(AuditLog, {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldValues: mask(entry.oldValues),
      newValues: mask(entry.newValues),
      actorId: entry.actorId ?? actor?.id ?? null,
      actorRole: entry.actorId === undefined ? (actor?.role ?? null) : null,
      requestId: inRequest ? this.cls.getId() : null,
      ip: inRequest ? (this.cls.get('ip') ?? null) : null,
    });
  }

  async findAll(
    actor: User,
    {
      page,
      limit,
      entityType,
      entityId,
      actorId,
      action,
    }: ListAuditLogsQueryDto,
  ) {
    const query = this.logs
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (entityType)
      query.andWhere('log.entityType = :entityType', { entityType });
    if (entityId) query.andWhere('log.entityId = :entityId', { entityId });
    if (actorId) query.andWhere('log.actorId = :actorId', { actorId });
    if (action) query.andWhere('log.action = :action', { action });

    // User entries hold personal data, so they follow the users read scope
    // (readableUsersWhere, the same rule as GET /users): out-of-scope and
    // deleted users' history is visible only to manage-all roles.
    const readable = readableUsersWhere(
      actor,
      this.abilityFactory.createForUser(actor),
    );
    if (readable) {
      const scoped = this.users
        .createQueryBuilder('scopedUser')
        .setFindOptions({
          select: { id: true },
          where: readable,
          loadEagerRelations: false,
        });
      query
        .andWhere(
          new Brackets((where) =>
            where
              .where("log.entityType <> 'User'")
              .orWhere(`log.entityId IN (${scoped.getQuery()})`),
          ),
        )
        .setParameters(scoped.getParameters());
    }

    const [items, total] = await query.getManyAndCount();
    return { items, total, page, limit };
  }
}

// Same masking as the request logs: a password change is recorded, its value never.
function mask(
  values: Record<string, unknown> | null | undefined,
): Record<string, any> | null {
  return values ? (maskSecrets(values) as Record<string, any>) : null;
}
