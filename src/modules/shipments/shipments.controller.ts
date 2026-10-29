import {
  Body,
  Controller,
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
  createPackageSchema,
  type CreatePackageDto,
} from './dto/create-package.dto.js';
import {
  closeShipmentSchema,
  type CloseShipmentDto,
  createShipmentSchema,
  type CreateShipmentDto,
  updateShipmentSchema,
  type UpdateShipmentDto,
} from './dto/create-shipment.dto.js';
import {
  listShipmentsQuerySchema,
  type ListShipmentsQueryDto,
} from './dto/list-shipments-query.dto.js';
import { ShipmentsService } from './shipments.service.js';

@ApiBearerAuth()
@Controller('shipments')
@UseGuards(PoliciesGuard)
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @ApiOperation({ summary: 'Start a draft shipment at headquarters' })
  @Post()
  @CheckAbility('create', 'Shipment')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createShipmentSchema }) dto: CreateShipmentDto,
  ) {
    return this.shipments.create(actor, dto);
  }

  @ApiOperation({ summary: 'List shipments' })
  @Get()
  @CheckAbility('read', 'Shipment')
  findAll(
    @Query({ schema: listShipmentsQuerySchema }) query: ListShipmentsQueryDto,
  ) {
    return this.shipments.findAll(query);
  }

  @ApiOperation({ summary: 'Get one shipment with its packages' })
  @Get(':id')
  @CheckAbility('read', 'Shipment')
  findOne(@Param('id', { schema: idParamSchema }) id: number) {
    return this.shipments.findOne(id);
  }

  @ApiOperation({ summary: 'Change transport details' })
  @Patch(':id')
  @CheckAbility('update', 'Shipment')
  update(
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateShipmentSchema }) dto: UpdateShipmentDto,
  ) {
    return this.shipments.update(id, dto);
  }

  @ApiOperation({
    summary: 'Add a package for one approved stock request (draft only)',
  })
  @Post(':id/packages')
  @CheckAbility('update', 'Shipment')
  createPackage(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: createPackageSchema }) dto: CreatePackageDto,
  ) {
    return this.shipments.createPackage(actor, id, dto);
  }

  @ApiOperation({
    summary: 'Dispatch: every packed item leaves headquarters with it',
  })
  @Post(':id/dispatch')
  @HttpCode(200)
  @CheckAbility('update', 'Shipment')
  dispatch(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.shipments.dispatch(actor, id);
  }

  @ApiOperation({
    summary: 'Cancel a draft: its packages go and their items are unpacked',
  })
  @Post(':id/cancel')
  @HttpCode(200)
  @CheckAbility('update', 'Shipment')
  cancel(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.shipments.cancel(actor, id);
  }

  @ApiOperation({
    summary: 'Close a dispatched shipment: items not received become missing',
  })
  @Post(':id/close')
  @HttpCode(200)
  @CheckAbility('update', 'Shipment')
  close(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: closeShipmentSchema }) dto: CloseShipmentDto,
  ) {
    return this.shipments.close(actor, id, dto);
  }
}
