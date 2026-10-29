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
import { addStockSchema, type AddStockDto } from './dto/add-stock.dto.js';
import {
  createItemSchema,
  type CreateItemDto,
  updateItemSchema,
  type UpdateItemDto,
} from './dto/create-item.dto.js';
import {
  listItemsQuerySchema,
  type ListItemsQueryDto,
  movementsQuerySchema,
  type MovementsQueryDto,
  pageQuerySchema,
  type PageQueryDto,
  stockQuerySchema,
  type StockQueryDto,
} from './dto/list-items-query.dto.js';
import { ItemsService } from './items.service.js';

@ApiBearerAuth()
@Controller('items')
@UseGuards(PoliciesGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @ApiOperation({
    summary: 'Add stock at headquarters: one item per unit, automatic codes',
  })
  @Post('bulk')
  @CheckAbility('create', 'Item')
  addStock(
    @CurrentUser() actor: User,
    @Body({ schema: addStockSchema }) dto: AddStockDto,
  ) {
    return this.itemsService.addStock(actor, dto);
  }

  @ApiOperation({
    summary: 'Add one item at headquarters (optional code suffix and serial)',
  })
  @Post()
  @CheckAbility('create', 'Item')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createItemSchema }) dto: CreateItemDto,
  ) {
    return this.itemsService.create(actor, dto);
  }

  @ApiOperation({ summary: 'List items' })
  @Get()
  @CheckAbility('read', 'Item')
  findAll(@Query({ schema: listItemsQuerySchema }) query: ListItemsQueryDto) {
    return this.itemsService.findAll(query);
  }

  // stock and movements are declared before :id, which would match them.
  @ApiOperation({ summary: 'Item counts per product, site and status' })
  @Get('stock')
  @CheckAbility('read', 'Item')
  stock(@Query({ schema: stockQuerySchema }) query: StockQueryDto) {
    return this.itemsService.stock(query);
  }

  @ApiOperation({ summary: 'Every item movement, newest first' })
  @Get('movements')
  @CheckAbility('read', 'Item')
  findAllMovements(
    @Query({ schema: movementsQuerySchema }) query: MovementsQueryDto,
  ) {
    return this.itemsService.findAllMovements(query);
  }

  @ApiOperation({ summary: 'Get one item' })
  @Get(':id')
  @CheckAbility('read', 'Item')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.itemsService.findOne(id);
  }

  @ApiOperation({ summary: "An item's history, newest first" })
  @Get(':id/movements')
  @CheckAbility('read', 'Item')
  findMovements(
    @Param('id', { schema: idParamSchema }) id: number,
    @Query({ schema: pageQuerySchema }) query: PageQueryDto,
  ) {
    return this.itemsService.findMovements(id, query);
  }

  @ApiOperation({
    summary: 'Update serial number, condition, calibration due date or note',
  })
  @Patch(':id')
  @CheckAbility('update', 'Item')
  update(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateItemSchema }) dto: UpdateItemDto,
  ) {
    return this.itemsService.update(actor, id, dto);
  }

  @ApiOperation({
    summary: 'Delete a wrongly added item (only while available at HQ)',
  })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('delete', 'Item')
  remove(@Param('id', { schema: idParamSchema }) id: number) {
    return this.itemsService.remove(id);
  }
}
