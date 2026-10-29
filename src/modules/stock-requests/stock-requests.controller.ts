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
  createCommentSchema,
  type CreateCommentDto,
} from './dto/create-comment.dto.js';
import {
  createStockRequestSchema,
  type CreateStockRequestDto,
  routeStockRequestSchema,
  type RouteStockRequestDto,
  updateStockRequestSchema,
  type UpdateStockRequestDto,
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
  listAssigneesQuerySchema,
  type ListAssigneesQueryDto,
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

  @ApiOperation({
    summary:
      "Start a stock request for the caller's site (a draft, or sent with submit); HQ may route it between any two sites, approved at once",
  })
  // Gated in the service: route fields need 'route', the rest 'create'.
  @Post()
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

  // Declared before :id, which would otherwise match "assignees".
  @ApiOperation({
    summary:
      "Active employees of a site, to assign a request to (HQ's pickers)",
  })
  @Get('assignees')
  @CheckAbility('route', 'StockRequest')
  findAssignees(
    @Query({ schema: listAssigneesQuerySchema }) query: ListAssigneesQueryDto,
  ) {
    return this.stockRequests.findAssignees(query);
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

  @ApiOperation({
    summary:
      'Save a draft whole (its lines are replaced), optionally sending it',
  })
  @Patch(':id')
  @CheckAbility('create', 'StockRequest')
  update(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: updateStockRequestSchema }) dto: UpdateStockRequestDto,
  ) {
    return this.stockRequests.update(actor, id, dto);
  }

  @ApiOperation({ summary: 'Discard a draft' })
  @Delete(':id')
  @HttpCode(204)
  @CheckAbility('create', 'StockRequest')
  async remove(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    await this.stockRequests.remove(actor, id);
  }

  @ApiOperation({
    summary: 'Send a draft to HQ review; the sender becomes its requester',
  })
  @Post(':id/submit')
  @HttpCode(200)
  @CheckAbility('create', 'StockRequest')
  submit(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
  ) {
    return this.stockRequests.submit(actor, id);
  }

  @ApiOperation({
    summary:
      "Change a request's sending or receiving site or its assignee, until it is packed",
  })
  @Patch(':id/route')
  @CheckAbility('route', 'StockRequest')
  route(
    @CurrentUser() actor: User,
    @Param('id', { schema: idParamSchema }) id: number,
    @Body({ schema: routeStockRequestSchema }) dto: RouteStockRequestDto,
  ) {
    return this.stockRequests.route(actor, id, dto);
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
