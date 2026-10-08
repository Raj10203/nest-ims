import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { User } from '../../entities/user.entity.js';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(PoliciesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @CheckAbility('create', 'User')
  create(@CurrentUser() actor: User, @Body() dto: CreateUserDto) {
    return this.usersService.create(actor, dto);
  }

  @Get()
  @CheckAbility('read', 'User')
  findAll(@CurrentUser() actor: User, @Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(actor, query);
  }

  @Get(':id')
  @CheckAbility('read', 'User')
  findOne(@CurrentUser() actor: User, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOneFor(actor, id);
  }

  @Patch(':id')
  @CheckAbility('update', 'User')
  update(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'User')
  remove(@CurrentUser() actor: User, @Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(actor, id);
  }
}
