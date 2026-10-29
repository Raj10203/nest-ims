import {
  Body,
  Controller,
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
  createCommentSchema,
  type CreateCommentDto,
} from './dto/create-comment.dto.js';
import {
  createStockRequestSchema,
  type CreateStockRequestDto,
} from './dto/create-stock-request.dto.js';
import {
  approveStockRequestSchema,
  type ApproveStockRequestDto,
  cancelStockRequestSchema,
  type CancelStockRequestDto,
  closeStockRequestSchema,
  type CloseStockRequestDto,
  rejectStockRequestSchema,
  type RejectStockRequestDto,
} from './dto/decide-stock-request.dto.js';
import {
  listStockRequestsQuerySchema,
  type ListStockRequestsQueryDto,
} from './dto/list-stock-requests-query.dto.js';
import { StockRequestsService } from './stock-requests.service.js';

// The decisions are gated on read here: which step the caller may take
// depends on the request's status, so the service checks review or approve.
@ApiBearerAuth()
@Controller('stock-requests')
@UseGuards(PoliciesGuard)
export class StockRequestsController {
  constructor(private readonly stockRequests: StockRequestsService) {}

  @ApiOperation({ summary: "Raise a stock request for the caller's site" })
  @Post()
  @CheckAbility('create', 'StockRequest')
  create(
    @CurrentUser() actor: User,
    @Body({ schema: createStockRequestSchema }) dto: CreateStockRequestDto,
  ) {
    return this.stockRequests.create(actor, dto);
  }

  @ApiOperation({ summary: 'List stock requests' })
  @Get()
  @CheckAbility('read', 'StockRequest')
  findAll(
    @CurrentUser() actor: User,
    @Query({ schema: listStockRequestsQuerySchema })
    query: ListStockRequestsQueryDto,
  ) {
    return this.stockRequests.findAll(actor, query);
  }

  @ApiOperation({
    summary: 'Get one stock request with its lines and what the caller may do',
  })
  @Get(':id')
  @CheckAbility('read', 'StockRequest')
  findOne(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.stockRequests.findOne(actor, id);
  }

  @ApiOperation({ summary: "A stock request's history, oldest first" })
  @Get(':id/events')
  @CheckAbility('read', 'StockRequest')
  findEvents(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.stockRequests.findEvents(actor, id);
  }

  @ApiOperation({ summary: "A stock request's comments, oldest first" })
  @Get(':id/comments')
  @CheckAbility('read', 'StockRequest')
  findComments(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.stockRequests.findComments(actor, id);
  }

  @ApiOperation({
    summary: 'Comment on a stock request, or reply to a comment',
  })
  @Post(':id/comments')
  @CheckAbility('read', 'StockRequest')
  addComment(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: createCommentSchema }) dto: CreateCommentDto,
  ) {
    return this.stockRequests.addComment(actor, id, dto);
  }

  @ApiOperation({
    summary:
      'Approve the current step (HQ review, then manager approval), optionally changing quantities',
  })
  @Post(':id/approve')
  @HttpCode(200)
  @CheckAbility('read', 'StockRequest')
  approve(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: approveStockRequestSchema }) dto: ApproveStockRequestDto,
  ) {
    return this.stockRequests.approve(actor, id, dto);
  }

  @ApiOperation({ summary: 'Reject at the current step, with a reason' })
  @Post(':id/reject')
  @HttpCode(200)
  @CheckAbility('read', 'StockRequest')
  reject(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: rejectStockRequestSchema }) dto: RejectStockRequestDto,
  ) {
    return this.stockRequests.reject(actor, id, dto);
  }

  @ApiOperation({ summary: 'Cancel your own request while it is pending' })
  @Post(':id/cancel')
  @HttpCode(200)
  @CheckAbility('read', 'StockRequest')
  cancel(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: cancelStockRequestSchema }) dto: CancelStockRequestDto,
  ) {
    return this.stockRequests.cancel(actor, id, dto);
  }

  @ApiOperation({
    summary:
      'Close with what was received: line quantities drop to the received counts',
  })
  @Post(':id/close')
  @HttpCode(200)
  @CheckAbility('close', 'StockRequest')
  close(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: closeStockRequestSchema }) dto: CloseStockRequestDto,
  ) {
    return this.stockRequests.close(actor, id, dto);
  }
}
