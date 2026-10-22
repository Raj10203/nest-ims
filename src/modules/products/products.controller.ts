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
import {
  createProductSchema,
  type CreateProductDto,
} from './dto/create-product.dto.js';
import {
  listProductsQuerySchema,
  type ListProductsQueryDto,
} from './dto/list-products-query.dto.js';
import {
  updateProductSchema,
  type UpdateProductDto,
} from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiBearerAuth()
@Controller('products')
@UseGuards(PoliciesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'Create a product' })
  @Post()
  @CheckAbility('create', 'Product')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createProductSchema }) dto: CreateProductDto,
  ) {
    return this.productsService.create(actor, dto);
  }

  @ApiOperation({ summary: 'List products' })
  @Get()
  @CheckAbility('read', 'Product')
  findAll(
    @Query({ schema: listProductsQuerySchema }) query: ListProductsQueryDto,
  ) {
    return this.productsService.findAll(query);
  }

  // Declared before :id, which would otherwise match "options".
  @ApiOperation({
    summary: 'Allowed values for type, measureType and packUnit',
  })
  @Get('options')
  @CheckAbility('read', 'Product')
  options() {
    return this.productsService.options();
  }

  @ApiOperation({ summary: 'Get one product' })
  @Get(':id')
  @CheckAbility('read', 'Product')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.findOne(id);
  }

  @ApiOperation({ summary: 'Update a product' })
  @Patch(':id')
  @CheckAbility('update', 'Product')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateProductSchema }) dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a product' })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'Product')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.productsService.remove(id);
  }
}
