import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
  packItemsSchema,
  type PackItemsDto,
  receivePackageSchema,
  type ReceivePackageDto,
} from './dto/create-package.dto.js';
import {
  listPackagesQuerySchema,
  type ListPackagesQueryDto,
} from './dto/list-shipments-query.dto.js';
import { ShipmentsService } from './shipments.service.js';

// Packing is part of editing the shipment (update Shipment, HQ); reading and
// receiving belong to the destination site.
@ApiBearerAuth()
@Controller('packages')
@UseGuards(PoliciesGuard)
export class PackagesController {
  constructor(private readonly shipments: ShipmentsService) {}

  @ApiOperation({ summary: 'List packages (site roles: their own site only)' })
  @Get()
  @CheckAbility('read', 'Package')
  findAll(
    @CurrentUser() actor: User,
    @Query({ schema: listPackagesQuerySchema }) query: ListPackagesQueryDto,
  ) {
    return this.shipments.findPackages(actor, query);
  }

  @ApiOperation({ summary: 'Get one package with its items' })
  @Get(':id')
  @CheckAbility('read', 'Package')
  findOne(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.shipments.findPackage(actor, id);
  }

  @ApiOperation({ summary: 'Pack items by code (draft shipment only)' })
  @Post(':id/items')
  @HttpCode(200)
  @CheckAbility('update', 'Shipment')
  pack(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: packItemsSchema }) dto: PackItemsDto,
  ) {
    return this.shipments.pack(actor, id, dto);
  }

  @ApiOperation({ summary: 'Take an item out of a package (draft only)' })
  @Delete(':id/items/:itemId')
  @CheckAbility('update', 'Shipment')
  unpack(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Param('itemId', { schema: idParamSchema }) itemId: number,
  ) {
    return this.shipments.unpack(actor, id, itemId);
  }

  @ApiOperation({
    summary: 'Remove a package and unpack its items (draft only)',
  })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('update', 'Shipment')
  remove(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.shipments.removePackage(actor, id);
  }

  @ApiOperation({
    summary:
      'Receive the whole package, or only the listed item codes, at its site',
  })
  @Post(':id/receive')
  @HttpCode(200)
  @CheckAbility('receive', 'Package')
  receive(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: receivePackageSchema }) dto: ReceivePackageDto,
  ) {
    return this.shipments.receive(actor, id, dto);
  }
}
