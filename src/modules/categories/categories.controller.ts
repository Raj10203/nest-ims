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
import { CategoriesService } from './categories.service.js';
import {
  createCategorySchema,
  type CreateCategoryDto,
} from './dto/create-category.dto.js';
import {
  listCategoriesQuerySchema,
  type ListCategoriesQueryDto,
} from './dto/list-categories-query.dto.js';
import {
  updateCategorySchema,
  type UpdateCategoryDto,
} from './dto/update-category.dto.js';

@ApiBearerAuth()
@Controller('categories')
@UseGuards(PoliciesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @ApiOperation({ summary: 'Create a category' })
  @Post()
  @CheckAbility('create', 'Category')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createCategorySchema }) dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(actor, dto);
  }

  @ApiOperation({ summary: 'List categories' })
  @Get()
  @CheckAbility('read', 'Category')
  findAll(
    @Query({ schema: listCategoriesQuerySchema }) query: ListCategoriesQueryDto,
  ) {
    return this.categoriesService.findAll(query);
  }

  @ApiOperation({ summary: 'Get one category' })
  @Get(':id')
  @CheckAbility('read', 'Category')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.categoriesService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a category' })
  @Patch(':id')
  @CheckAbility('update', 'Category')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateCategorySchema }) dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a category (409 while it has products)' })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'Category')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.categoriesService.remove(id);
  }
}
