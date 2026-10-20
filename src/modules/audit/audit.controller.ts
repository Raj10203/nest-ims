import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import {
  listAuditLogsQuerySchema,
  type ListAuditLogsQueryDto,
} from './dto/list-audit-logs-query.dto.js';
import { AuditService } from './audit.service.js';

// Read-only on purpose: audit rows are never changed or deleted through the API.
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(PoliciesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @ApiOperation({ summary: 'Who changed what, newest first' })
  @Get()
  @CheckAbility('read', 'AuditLog')
  findAll(
    @Query({ schema: listAuditLogsQuerySchema }) query: ListAuditLogsQueryDto,
  ) {
    return this.audit.findAll(query);
  }
}
