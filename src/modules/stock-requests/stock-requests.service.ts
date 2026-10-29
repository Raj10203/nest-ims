import { subject } from '@casl/ability';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Or,
  Repository,
} from 'typeorm';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { ShipmentStatus } from '../../common/enums/shipment-status.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { StockRequestAction } from '../../common/enums/stock-request-action.enum.js';
import { StockRequestStatus } from '../../common/enums/stock-request-status.enum.js';
import { i18nMessage, type ErrorKey } from '../../common/i18n/i18n-message.js';
import {
  depthOne,
  depthOneWithout,
  findPageDepthOne,
} from '../../common/typeorm/depth-one.js';
import { Package } from '../../entities/package.entity.js';
import { Product } from '../../entities/product.entity.js';
import { Site } from '../../entities/site.entity.js';
import { StockRequestComment } from '../../entities/stock-request-comment.entity.js';
import { StockRequestEvent } from '../../entities/stock-request-event.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableStockRequestsWhere,
  type AppAbility,
} from '../authorization/casl-ability.factory.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { CreateStockRequestDto } from './dto/create-stock-request.dto.js';
import {
  ApproveStockRequestDto,
  CancelStockRequestDto,
  CloseStockRequestDto,
  RejectStockRequestDto,
} from './dto/decide-stock-request.dto.js';
import { ListStockRequestsQueryDto } from './dto/list-stock-requests-query.dto.js';
import {
  DELIVERABLE,
  lineProgress,
  syncRequestStatus,
} from './request-progress.js';

type Step = 'review' | 'approve';

// The review chain: which permission each pending status waits for.
const STEPS: Partial<Record<StockRequestStatus, Step>> = {
  [StockRequestStatus.PENDING_REVIEW]: 'review',
  [StockRequestStatus.PENDING_APPROVAL]: 'approve',
};

const PENDING = [
  StockRequestStatus.PENDING_REVIEW,
  StockRequestStatus.PENDING_APPROVAL,
];

const notMe = (id: number) => Or(Not(id), IsNull());

const personSummary = ({
  id,
  firstName,
  lastName,
}: Pick<User, 'id' | 'firstName' | 'lastName'>) => ({
  id,
  firstName,
  lastName,
});

@Injectable()
export class StockRequestsService {
  constructor(
    @InjectRepository(StockRequest)
    private readonly requests: Repository<StockRequest>,
    @InjectRepository(StockRequestLine)
    private readonly lines: Repository<StockRequestLine>,
    @InjectRepository(StockRequestEvent)
    private readonly events: Repository<StockRequestEvent>,
    @InjectRepository(StockRequestComment)
    private readonly comments: Repository<StockRequestComment>,
    private readonly dataSource: DataSource,
    private readonly abilityFactory: CaslAbilityFactory,
    private readonly notifications: NotificationsService,
  ) {}

  // Always for the requester's own site, which must not be headquarters:
  // headquarters is where the stock comes from.
  async create(actor: User, dto: CreateStockRequestDto) {
    const id = await this.dataSource.transaction(async (manager) => {
      const site = actor.siteId
        ? await manager.findOne(Site, {
            where: { id: actor.siteId },
            loadEagerRelations: false,
          })
        : null;
      if (!site) {
        throw new BadRequestException(
          i18nMessage('errors.stockRequests.noSite'),
        );
      }
      if (site.type === SiteType.HQ) {
        throw new BadRequestException(
          i18nMessage('errors.stockRequests.fromHeadquarters'),
        );
      }
      await this.assertProductsActive(
        manager,
        dto.lines.map((line) => line.productId),
      );

      const request = await manager.save(
        StockRequest,
        manager.create(StockRequest, {
          siteId: site.id,
          status: StockRequestStatus.PENDING_REVIEW,
          note: dto.note ?? null,
          neededBy: dto.neededBy ?? null,
          requestedById: actor.id,
        }),
      );
      await manager.save(
        StockRequestLine,
        dto.lines.map((line) =>
          manager.create(StockRequestLine, {
            requestId: request.id,
            productId: line.productId,
            requestedQuantity: line.quantity,
            quantity: line.quantity,
          }),
        ),
      );
      await manager.insert(StockRequestEvent, {
        requestId: request.id,
        action: StockRequestAction.CREATED,
        status: request.status,
        performedById: actor.id,
      });
      return request.id;
    });
    return this.findOne(actor, id);
  }

  async findAll(
    actor: User,
    {
      status,
      siteId,
      awaitingMe,
      mine,
      page,
      limit,
    }: ListStockRequestsQueryDto,
  ) {
    const ability = this.abilityFactory.createForUser(actor);
    const scope = readableStockRequestsWhere(actor, ability);
    const empty = { items: [], total: 0, page, limit };
    // A site role's only site is its own.
    if (scope && siteId && siteId !== scope.siteId) return empty;

    const base: FindOptionsWhere<StockRequest> = {
      ...(status && { status }),
      ...(siteId && { siteId }),
      ...(mine && { requestedById: actor.id }),
      ...scope,
    };
    const where = awaitingMe
      ? this.awaitingWhere(actor, ability, base)
      : [base];
    if (!where.length) return empty;

    const [items, total] = await findPageDepthOne(this.requests, {
      where,
      // A queue is worked oldest first.
      order: { id: awaitingMe ? 'ASC' : 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: await this.withTotals(items), total, page, limit };
  }

  async findOne(actor: User, id: number) {
    const ability = this.abilityFactory.createForUser(actor);
    const request = await this.findReadable(ability, id);
    const lines = await this.lines.find({
      ...depthOneWithout(this.lines, 'request'),
      where: { requestId: id },
      order: { id: 'ASC' },
    });
    const progress = await lineProgress(this.dataSource.manager, lines);
    const refusal = this.decisionRefusal(actor, ability, request);
    return Object.assign(request, {
      lines: lines.map((line) => Object.assign(line, progress.get(line.id))),
      // What the caller may do now, so the client need not repeat the rules.
      allowed: {
        decide: !refusal,
        cancel:
          request.requestedById === actor.id &&
          PENDING.includes(request.status),
        close:
          ability.can('close', subject('StockRequest', request)) &&
          DELIVERABLE.includes(request.status) &&
          !(await this.hasOpenShipment(this.dataSource.manager, id)),
      },
    });
  }

  async findEvents(actor: User, id: number) {
    await this.findReadable(this.abilityFactory.createForUser(actor), id);
    return this.events.find({
      ...depthOneWithout(this.events, 'request'),
      where: { requestId: id },
      order: { id: 'ASC' },
    });
  }

  // The whole conversation, oldest first: a request's thread stays short.
  async findComments(actor: User, id: number) {
    await this.findReadable(this.abilityFactory.createForUser(actor), id);
    return this.comments.find({
      ...depthOneWithout(this.comments, 'request', 'parent'),
      where: { requestId: id },
      order: { id: 'ASC' },
    });
  }

  // Anyone who can read the request may join its conversation. Its creator
  // is notified of everyone else's comments.
  async addComment(actor: User, id: number, dto: CreateCommentDto) {
    const request = await this.findReadable(
      this.abilityFactory.createForUser(actor),
      id,
    );
    const parent = dto.parentId
      ? await this.comments.findOne({
          select: {
            id: true,
            parentId: true,
            author: { id: true, firstName: true, lastName: true },
          },
          relations: { author: true },
          where: { id: dto.parentId, requestId: id },
          loadEagerRelations: false,
        })
      : null;
    if (dto.parentId && !parent) {
      throw new BadRequestException(
        i18nMessage('errors.stockRequests.commentNotFound', {
          id: dto.parentId,
        }),
      );
    }
    const { requestedById } = request;
    const [saved, notification] = await this.dataSource.transaction(
      async (manager) => {
        const comment = await manager.save(StockRequestComment, {
          requestId: id,
          parentId: parent ? (parent.parentId ?? parent.id) : null,
          body: dto.body,
          authorId: actor.id,
        });
        const notify =
          requestedById !== null &&
          requestedById !== actor.id &&
          (await manager.existsBy(User, { id: requestedById, isActive: true }));
        return [
          comment,
          notify
            ? await this.notifications.create(
                manager,
                requestedById,
                NotificationType.STOCK_REQUEST_COMMENT,
                {
                  requestId: id,
                  commentId: comment.id,
                  parentId: parent?.id ?? null,
                  excerpt: dto.body.slice(0, 200),
                  author: personSummary(actor),
                  repliedTo: parent?.author
                    ? personSummary(parent.author)
                    : null,
                },
              )
            : null,
        ] as const;
      },
    );
    if (notification) this.notifications.send(notification);
    return this.comments.findOne({
      ...depthOneWithout(this.comments, 'request', 'parent'),
      where: { id: saved.id },
    });
  }

  // Moves the request one step along the chain: review, then approval. Line
  // quantities may change on the way; at least one must stay above 0.
  async approve(actor: User, id: number, dto: ApproveStockRequestDto) {
    const ability = this.abilityFactory.createForUser(actor);
    await this.dataSource.transaction(async (manager) => {
      const request = await this.lockReadable(manager, ability, id);
      const step = this.assertCanDecide(actor, ability, request);
      const lines = await manager.find(StockRequestLine, {
        where: { requestId: id },
        loadEagerRelations: false,
      });
      for (const change of dto.lines ?? []) {
        const line = lines.find((candidate) => candidate.id === change.id);
        if (!line) {
          throw new BadRequestException(
            i18nMessage('errors.stockRequests.lineNotFound', { id: change.id }),
          );
        }
        if (line.quantity === change.quantity) continue;
        // save(), not update(): AuditSubscriber records the change too.
        await manager.save(StockRequestLine, {
          id: line.id,
          quantity: change.quantity,
        });
        await manager.insert(StockRequestEvent, {
          requestId: id,
          action: StockRequestAction.QUANTITY_CHANGED,
          status: request.status,
          productId: line.productId,
          quantityBefore: line.quantity,
          quantityAfter: change.quantity,
          performedById: actor.id,
        });
        line.quantity = change.quantity;
      }
      if (!lines.some((line) => line.quantity > 0)) {
        throw new BadRequestException(
          i18nMessage('errors.stockRequests.nothingApproved'),
        );
      }

      const now = new Date();
      const next =
        step === 'review'
          ? {
              status: StockRequestStatus.PENDING_APPROVAL,
              reviewedById: actor.id,
              reviewedAt: now,
            }
          : {
              status: StockRequestStatus.APPROVED,
              approvedById: actor.id,
              approvedAt: now,
            };
      await manager.save(StockRequest, { id, ...next });
      await manager.insert(StockRequestEvent, {
        requestId: id,
        action:
          step === 'review'
            ? StockRequestAction.REVIEWED
            : StockRequestAction.APPROVED,
        status: next.status,
        note: dto.note ?? null,
        performedById: actor.id,
      });
    });
    return this.findOne(actor, id);
  }

  // Whoever holds the current step may reject, with a reason.
  async reject(actor: User, id: number, dto: RejectStockRequestDto) {
    const ability = this.abilityFactory.createForUser(actor);
    await this.dataSource.transaction(async (manager) => {
      const request = await this.lockReadable(manager, ability, id);
      this.assertCanDecide(actor, ability, request);
      await this.end(manager, actor, id, StockRequestStatus.REJECTED, dto.note);
    });
    return this.findOne(actor, id);
  }

  async cancel(actor: User, id: number, dto: CancelStockRequestDto) {
    const ability = this.abilityFactory.createForUser(actor);
    await this.dataSource.transaction(async (manager) => {
      const request = await this.lockReadable(manager, ability, id);
      if (request.requestedById !== actor.id) {
        throw new ForbiddenException(
          i18nMessage('errors.stockRequests.notRequester'),
        );
      }
      if (!PENDING.includes(request.status)) {
        throw new ConflictException(
          i18nMessage('errors.stockRequests.notPending'),
        );
      }
      await this.end(
        manager,
        actor,
        id,
        StockRequestStatus.CANCELLED,
        dto.note ?? null,
      );
    });
    return this.findOne(actor, id);
  }

  // Ends delivery with what the site has: each line's quantity drops to its
  // received count, so the request becomes fulfilled. Not while a shipment
  // carrying it is still open.
  async close(actor: User, id: number, dto: CloseStockRequestDto) {
    const ability = this.abilityFactory.createForUser(actor);
    await this.dataSource.transaction(async (manager) => {
      const request = await this.lockReadable(manager, ability, id);
      if (!DELIVERABLE.includes(request.status)) {
        throw new ConflictException(
          i18nMessage('errors.stockRequests.notDeliverable'),
        );
      }
      if (await this.hasOpenShipment(manager, id)) {
        throw new ConflictException(
          i18nMessage('errors.stockRequests.shipmentOpen'),
        );
      }
      const lines = await manager.find(StockRequestLine, {
        where: { requestId: id },
        loadEagerRelations: false,
      });
      const progress = await lineProgress(manager, lines);
      for (const line of lines) {
        const received = progress.get(line.id)!.received;
        if (received === line.quantity) continue;
        await manager.save(StockRequestLine, {
          id: line.id,
          quantity: received,
        });
        await manager.insert(StockRequestEvent, {
          requestId: id,
          action: StockRequestAction.QUANTITY_CHANGED,
          status: request.status,
          productId: line.productId,
          quantityBefore: line.quantity,
          quantityAfter: received,
          performedById: actor.id,
        });
      }
      await syncRequestStatus(manager, request, actor.id, {
        action: StockRequestAction.CLOSED,
        note: dto.note,
      });
    });
    return this.findOne(actor, id);
  }

  private hasOpenShipment(manager: EntityManager, requestId: number) {
    return manager.exists(Package, {
      where: {
        requestId,
        shipment: {
          status: In([ShipmentStatus.DRAFT, ShipmentStatus.DISPATCHED]),
        },
      },
    });
  }

  private async end(
    manager: EntityManager,
    actor: User,
    id: number,
    status: StockRequestStatus.REJECTED | StockRequestStatus.CANCELLED,
    note: string | null,
  ) {
    await manager.save(StockRequest, {
      id,
      status,
      closedById: actor.id,
      closedAt: new Date(),
    });
    await manager.insert(StockRequestEvent, {
      requestId: id,
      action:
        status === StockRequestStatus.REJECTED
          ? StockRequestAction.REJECTED
          : StockRequestAction.CANCELLED,
      status,
      note,
      performedById: actor.id,
    });
  }

  // Why the actor may not approve or reject now, or null when they may. Nobody
  // decides on their own request, and the two steps need two people.
  private decisionRefusal(
    actor: User,
    ability: AppAbility,
    request: StockRequest,
  ): { key: ErrorKey; status: 403 | 409 } | null {
    const step = STEPS[request.status];
    if (!step) return { key: 'errors.stockRequests.notPending', status: 409 };
    if (!ability.can(step, subject('StockRequest', request))) {
      return { key: 'errors.stockRequests.notYourStep', status: 403 };
    }
    if (request.requestedById === actor.id) {
      return { key: 'errors.stockRequests.ownRequest', status: 403 };
    }
    if (step === 'approve' && request.reviewedById === actor.id) {
      return { key: 'errors.stockRequests.sameReviewer', status: 403 };
    }
    return null;
  }

  private assertCanDecide(
    actor: User,
    ability: AppAbility,
    request: StockRequest,
  ): Step {
    const refusal = this.decisionRefusal(actor, ability, request);
    if (refusal) {
      const Exception =
        refusal.status === 409 ? ConflictException : ForbiddenException;
      throw new Exception(i18nMessage(refusal.key));
    }
    return STEPS[request.status]!;
  }

  // One OR branch per step the actor holds, without their own requests or
  // the ones they reviewed themselves (the other step needs someone else).
  private awaitingWhere(
    actor: User,
    ability: AppAbility,
    base: FindOptionsWhere<StockRequest>,
  ): FindOptionsWhere<StockRequest>[] {
    const where: FindOptionsWhere<StockRequest>[] = [];
    if (ability.can('review', 'StockRequest')) {
      where.push({
        ...base,
        status: StockRequestStatus.PENDING_REVIEW,
        requestedById: notMe(actor.id),
      });
    }
    if (ability.can('approve', 'StockRequest')) {
      where.push({
        ...base,
        status: StockRequestStatus.PENDING_APPROVAL,
        requestedById: notMe(actor.id),
        reviewedById: notMe(actor.id),
      });
    }
    return where;
  }

  private async withTotals(items: StockRequest[]) {
    if (!items.length) return [];
    const rows = await this.lines
      .createQueryBuilder('line')
      .select('line.requestId', 'requestId')
      .addSelect('COUNT(*)', 'lineCount')
      .addSelect('SUM(line.quantity)', 'totalQuantity')
      .where('line.requestId IN (:...ids)', {
        ids: items.map((item) => item.id),
      })
      .groupBy('line.requestId')
      .getRawMany<{
        requestId: number;
        lineCount: string;
        totalQuantity: string;
      }>();
    return items.map((item) => {
      const row = rows.find(
        (candidate) => Number(candidate.requestId) === item.id,
      );
      return Object.assign(item, {
        lineCount: Number(row?.lineCount ?? 0),
        totalQuantity: Number(row?.totalQuantity ?? 0),
      });
    });
  }

  private async assertProductsActive(manager: EntityManager, ids: number[]) {
    const products = await manager.find(Product, {
      select: { id: true, isActive: true },
      where: { id: In(ids) },
      loadEagerRelations: false,
    });
    for (const id of ids) {
      const product = products.find((candidate) => candidate.id === id);
      if (!product) {
        throw new BadRequestException(
          i18nMessage('errors.stockRequests.productNotFound', { id }),
        );
      }
      if (!product.isActive) {
        throw new BadRequestException(
          i18nMessage('errors.stockRequests.productInactive', { id }),
        );
      }
    }
  }

  // Out of the actor's scope reads as missing, so ids are not revealed.
  private async findReadable(
    ability: AppAbility,
    id: number,
  ): Promise<StockRequest> {
    const request = await this.requests.findOne({
      ...depthOne(this.requests),
      where: { id },
    });
    if (!request || !ability.can('read', subject('StockRequest', request))) {
      throw this.notFound(id);
    }
    return request;
  }

  // FOR UPDATE: two reviewers acting at once queue here, and the second sees
  // the status the first left.
  private async lockReadable(
    manager: EntityManager,
    ability: AppAbility,
    id: number,
  ): Promise<StockRequest> {
    const request = await manager.findOne(StockRequest, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
    });
    if (!request || !ability.can('read', subject('StockRequest', request))) {
      throw this.notFound(id);
    }
    return request;
  }

  private notFound(id: number) {
    return new NotFoundException(
      i18nMessage('errors.stockRequests.notFound', { id }),
    );
  }
}
