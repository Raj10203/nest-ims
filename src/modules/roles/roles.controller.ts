import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from '../../entities/user.entity.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import { RoleOption, RolesService } from './roles.service.js';

@ApiBearerAuth()
@Controller('roles')
@UseGuards(PoliciesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // Feeds the role dropdown of the create-user form.
  @ApiOperation({ summary: 'Roles you may assign to a new user' })
  @Get()
  @CheckAbility('create', 'User')
  findAssignable(@CurrentUser() actor: User): Promise<RoleOption[]> {
    return this.rolesService.findAssignable(actor);
  }
}
