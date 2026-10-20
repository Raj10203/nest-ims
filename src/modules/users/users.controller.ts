import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
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
import {
  AVATAR_MAX_BYTES,
  avatarFilePipe,
  AvatarUploadInterceptor,
} from './avatar-upload.interceptor.js';
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

  @ApiOperation({
    summary: `Upload a PNG or JPEG avatar for yourself or a user you may update (max ${AVATAR_MAX_BYTES / 1024} KB)`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @Put(':id/avatar')
  // Every role may read itself; the service applies the self-or-update rule
  // (also for removeAvatar below).
  @CheckAbility('read', 'User')
  @UseInterceptors(AvatarUploadInterceptor)
  setAvatar(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @UploadedFile(avatarFilePipe()) file: Express.Multer.File,
  ) {
    return this.usersService.setAvatar(actor, id, file);
  }

  @ApiOperation({
    summary:
      'Remove the avatar of yourself or a user you may update (clients show their own placeholder)',
  })
  @Delete(':id/avatar')
  @HttpCode(204)
  @CheckAbility('read', 'User')
  removeAvatar(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.usersService.removeAvatar(actor, id);
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
