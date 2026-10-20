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
import { createSiteSchema, type CreateSiteDto } from './dto/create-site.dto.js';
import {
  listSitesQuerySchema,
  type ListSitesQueryDto,
} from './dto/list-sites-query.dto.js';
import { updateSiteSchema, type UpdateSiteDto } from './dto/update-site.dto.js';
import { SitesService } from './sites.service.js';

@ApiBearerAuth()
@Controller('sites')
@UseGuards(PoliciesGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @ApiOperation({ summary: 'Create a site' })
  @Post()
  @CheckAbility('create', 'Site')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createSiteSchema }) dto: CreateSiteDto,
  ) {
    return this.sitesService.create(actor, dto);
  }

  @ApiOperation({ summary: 'List sites' })
  @Get()
  @CheckAbility('read', 'Site')
  findAll(@Query({ schema: listSitesQuerySchema }) query: ListSitesQueryDto) {
    return this.sitesService.findAll(query);
  }

  @ApiOperation({ summary: 'Get one site' })
  @Get(':id')
  @CheckAbility('read', 'Site')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.sitesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a site' })
  @Patch(':id')
  @CheckAbility('update', 'Site')
  update(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateSiteSchema }) dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(actor, id, dto);
  }

  @ApiOperation({ summary: 'Delete a site' })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'Site')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.sitesService.remove(id);
  }
}
