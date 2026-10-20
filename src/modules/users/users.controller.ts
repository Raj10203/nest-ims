import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { idParamSchema } from '../../common/zod/id-param.schema.js';
import { User } from '../../entities/user.entity.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import { createUserSchema, type CreateUserDto } from './dto/create-user.dto.js';
import {
  listUsersQuerySchema,
  type ListUsersQueryDto,
} from './dto/list-users-query.dto.js';
import { updateUserSchema, type UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiBearerAuth()
@Controller('users')
@UseGuards(PoliciesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Create a user with a lower role than yours' })
  @Post()
  @CheckAbility('create', 'User')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createUserSchema }) dto: CreateUserDto,
  ) {
    return this.usersService.create(actor, dto);
  }

  @ApiOperation({ summary: 'List the users you can see' })
  @Get()
  @CheckAbility('read', 'User')
  findAll(
    @CurrentUser() actor: User,
    @Query({ schema: listUsersQuerySchema }) query: ListUsersQueryDto,
  ) {
    return this.usersService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get one user' })
  @Get(':id')
  @CheckAbility('read', 'User')
  findOne(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.usersService.findOneFor(actor, id);
  }

  @ApiOperation({
    summary: 'Update a user (changing the email resets verification)',
  })
  @Patch(':id')
  @CheckAbility('update', 'User')
  update(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateUserSchema }) dto: UpdateUserDto,
  ) {
    return this.usersService.update(actor, id, dto);
  }

  @ApiOperation({ summary: 'Delete a user' })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'User')
  remove(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.usersService.remove(actor, id);
  }
}
