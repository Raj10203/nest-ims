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
import { User } from '../../entities/user.entity.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CheckAbility } from '../authorization/check-ability.decorator.js';
import { PoliciesGuard } from '../authorization/policies.guard.js';
import { CreateSiteDto } from './dto/create-site.dto.js';
import { ListSitesQueryDto } from './dto/list-sites-query.dto.js';
import { UpdateSiteDto } from './dto/update-site.dto.js';
import { SitesService } from './sites.service.js';

@Controller('sites')
@UseGuards(PoliciesGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  @CheckAbility('create', 'Site')
  create(@CurrentUser() actor: User, @Body() dto: CreateSiteDto) {
    return this.sitesService.create(actor, dto);
  }

  @Get()
  @CheckAbility('read', 'Site')
  findAll(@Query() query: ListSitesQueryDto) {
    return this.sitesService.findAll(query);
  }

  @Get(':id')
  @CheckAbility('read', 'Site')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sitesService.findOne(id);
  }

  @Patch(':id')
  @CheckAbility('update', 'Site')
  update(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.sitesService.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'Site')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sitesService.remove(id);
  }
}
