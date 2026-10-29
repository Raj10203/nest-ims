import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FeatureRoleName } from '../../common/enums/feature-role-name.enum.js';
import { NotificationType } from '../../common/enums/notification-type.enum.js';
import { RoleKind } from '../../common/enums/role-kind.enum.js';
import { ROLE_LEVELS, RoleName } from '../../common/enums/role-name.enum.js';
import { SiteType } from '../../common/enums/site-type.enum.js';
import { StockRequestAction } from '../../common/enums/stock-request-action.enum.js';
import { StockRequestStatus } from '../../common/enums/stock-request-status.enum.js';
import {
  FEATURE_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
} from '../../database/seeds/role-permissions.js';
import { Permission } from '../../entities/permission.entity.js';
import { Product } from '../../entities/product.entity.js';
import { Role } from '../../entities/role.entity.js';
import { StockRequestEvent } from '../../entities/stock-request-event.entity.js';
import { StockRequestLine } from '../../entities/stock-request-line.entity.js';
import { StockRequest } from '../../entities/stock-request.entity.js';
import { User } from '../../entities/user.entity.js';
import {
  CaslAbilityFactory,
  readableStockRequestsWhere,
} from '../authorization/casl-ability.factory.js';
import { StockRequestsService } from './stock-requests.service.js';

const permissions = (defs: readonly (readonly [string, string])[]) =>
  defs.map(([action, subject]) =>
    Object.assign(new Permission(), { action, subject }),
  );

function makeUser(
  id: number,
  roleName: RoleName,
  siteId: number,
  features: FeatureRoleName[] = [],
) {
  const role = Object.assign(new Role(), {
    name: roleName,
    kind: RoleKind.PRIMARY,
    level: ROLE_LEVELS[roleName],
    permissions: permissions(ROLE_PERMISSIONS[roleName]),
  });
  const featureRoles = features.map((name) => ({
    role: Object.assign(new Role(), {
      name,
      kind: RoleKind.FEATURE,
      level: 0,
      permissions: permissions(FEATURE_ROLE_PERMISSIONS[name]),
    }),
  }));
  return Object.assign(new User(), { id, siteId, role, featureRoles });
}

const SITE = 5;
const requester = makeUser(10, RoleName.SITE_INCHARGE, SITE);
// The HQ reviewer: any primary role plus the feature role.
const reviewer = makeUser(20, RoleName.SITE_TECHNICIAN, 1, [
  FeatureRoleName.STOCK_REQUEST_REVIEWER,
]);
const hqManager = makeUser(30, RoleName.MANAGER, 1);
const superAdmin = makeUser(1, RoleName.SUPER_ADMIN, 1);

function setup(stored: Partial<StockRequest> = {}) {
  const request = {
    id: 7,
    siteId: SITE,
    status: StockRequestStatus.PENDING_REVIEW,
    requestedById: requester.id,
    reviewedById: null,
    ...stored,
  };
  const lines = [
    { id: 71, requestId: 7, productId: 3, quantity: 5 },
    { id: 72, requestId: 7, productId: 4, quantity: 2 },
  ];
  const products = [
    { id: 3, isActive: true },
    { id: 4, isActive: false },
  ];
  const site = { id: SITE, type: SiteType.SITE };
  const manager = {
    findOne: vi.fn((entity) =>
      Promise.resolve(entity === StockRequest ? { ...request } : site),
    ),
    find: vi.fn((entity) =>
      Promise.resolve(
        entity === Product ? products : lines.map((line) => ({ ...line })),
      ),
    ),
    save: vi.fn((_entity, value) =>
      Promise.resolve(Array.isArray(value) ? value : { id: 7, ...value }),
    ),
    create: vi.fn((_entity, value) => value),
    insert: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    existsBy: vi.fn().mockResolvedValue(true),
  };
  const requests = {
    findOne: vi.fn(() => Promise.resolve({ ...request })),
    metadata: { columns: [], relations: [] },
  };
  const lineRepo = {
    find: vi.fn().mockResolvedValue(lines),
    metadata: { columns: [], relations: [] },
  };
  // Line progress: nothing packed or received yet.
  const query: Record<string, unknown> = {
    getRawMany: vi.fn().mockResolvedValue([]),
  };
  for (const method of [
    'select',
    'addSelect',
    'where',
    'setParameters',
    'groupBy',
  ]) {
    query[method] = vi.fn(() => query);
  }
  const dataSource = {
    transaction: vi.fn((work) => work(manager)),
    manager: {
      createQueryBuilder: vi.fn(() => query),
      exists: vi.fn().mockResolvedValue(false),
    },
  };
  const comments = {
    findOne: vi.fn().mockResolvedValue(null),
    metadata: { columns: [], relations: [] },
  };
  const notifications = {
    create: vi.fn((_manager, userId, type, data) =>
      Promise.resolve({ id: 99, userId, type, data }),
    ),
    send: vi.fn(),
  };
  const service = new StockRequestsService(
    requests as any,
    lineRepo as any,
    {} as any,
    comments as any,
    dataSource as any,
    new CaslAbilityFactory(),
    notifications as any,
  );
  return { service, manager, site, products, comments, notifications };
}

const saved = (manager: ReturnType<typeof setup>['manager'], entity: unknown) =>
  manager.save.mock.calls
    .filter(([target]) => target === entity)
    .map(([, value]) => value);
const events = (manager: ReturnType<typeof setup>['manager']) =>
  manager.insert.mock.calls
    .filter(([target]) => target === StockRequestEvent)
    .map(([, value]) => value);

describe('StockRequestsService review chain', () => {
  it('moves a new request to manager approval when the HQ reviewer approves', async () => {
    const { service, manager } = setup();
    await service.approve(reviewer, 7, {});
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({
        status: StockRequestStatus.PENDING_APPROVAL,
        reviewedById: reviewer.id,
      }),
    ]);
    expect(events(manager)).toEqual([
      expect.objectContaining({ action: StockRequestAction.REVIEWED }),
    ]);
  });

  it('records each quantity the reviewer changes', async () => {
    const { service, manager } = setup();
    await service.approve(reviewer, 7, {
      lines: [
        { id: 71, quantity: 3 },
        { id: 72, quantity: 2 },
      ],
    });
    expect(saved(manager, StockRequestLine)).toEqual([{ id: 71, quantity: 3 }]);
    expect(events(manager)[0]).toEqual(
      expect.objectContaining({
        action: StockRequestAction.QUANTITY_CHANGED,
        productId: 3,
        quantityBefore: 5,
        quantityAfter: 3,
      }),
    );
  });

  it('approves the request when a manager takes the second step', async () => {
    const { service, manager } = setup({
      status: StockRequestStatus.PENDING_APPROVAL,
      reviewedById: reviewer.id,
    });
    await service.approve(hqManager, 7, {});
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({
        status: StockRequestStatus.APPROVED,
        approvedById: hqManager.id,
      }),
    ]);
  });

  it('keeps the manager out of the HQ review step', async () => {
    const { service, manager } = setup();
    await expect(service.approve(hqManager, 7, {})).rejects.toThrow(
      'errors.stockRequests.notYourStep',
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('needs two different people for the two steps', async () => {
    const { service } = setup({
      status: StockRequestStatus.PENDING_APPROVAL,
      reviewedById: superAdmin.id,
    });
    await expect(service.approve(superAdmin, 7, {})).rejects.toThrow(
      'errors.stockRequests.sameReviewer',
    );
  });

  it('never lets someone decide on their own request', async () => {
    const { service } = setup({ requestedById: superAdmin.id });
    await expect(service.approve(superAdmin, 7, {})).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuses an approval that leaves every quantity at 0', async () => {
    const { service, manager } = setup();
    await expect(
      service.approve(reviewer, 7, {
        lines: [
          { id: 71, quantity: 0 },
          { id: 72, quantity: 0 },
        ],
      }),
    ).rejects.toThrow('errors.stockRequests.nothingApproved');
    expect(saved(manager, StockRequest)).toEqual([]);
  });

  it('refuses a line from another request', async () => {
    const { service } = setup();
    await expect(
      service.approve(reviewer, 7, { lines: [{ id: 99, quantity: 1 }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('answers 409 once the request is decided', async () => {
    const { service } = setup({ status: StockRequestStatus.APPROVED });
    await expect(service.approve(hqManager, 7, {})).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects at the current step with the reason', async () => {
    const { service, manager } = setup();
    await service.reject(reviewer, 7, { note: 'Not needed' });
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({
        status: StockRequestStatus.REJECTED,
        closedById: reviewer.id,
      }),
    ]);
    expect(events(manager)).toEqual([
      expect.objectContaining({
        action: StockRequestAction.REJECTED,
        note: 'Not needed',
      }),
    ]);
  });
});

describe('StockRequestsService scope and requester', () => {
  it('hides a request of another site from a site in-charge (404)', async () => {
    const { service } = setup({ siteId: 99, requestedById: 50 });
    await expect(service.findOne(requester, 7)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lets only the requester cancel', async () => {
    const other = makeUser(11, RoleName.SITE_INCHARGE, SITE);
    const { service } = setup();
    await expect(service.cancel(other, 7, {})).rejects.toThrow(
      'errors.stockRequests.notRequester',
    );
  });

  it('cancels a pending request for its requester', async () => {
    const { service, manager } = setup({
      status: StockRequestStatus.PENDING_APPROVAL,
    });
    await service.cancel(requester, 7, {});
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({ status: StockRequestStatus.CANCELLED }),
    ]);
  });

  it('refuses a request raised from headquarters', async () => {
    const { service, site } = setup();
    site.type = SiteType.HQ;
    await expect(
      service.create(requester, {
        lines: [{ productId: 3, quantity: 1 }],
        submit: false,
      }),
    ).rejects.toThrow('errors.stockRequests.fromHeadquarters');
  });

  it('refuses an inactive product', async () => {
    const { service, manager } = setup();
    await expect(
      service.create(requester, {
        lines: [{ productId: 4, quantity: 1 }],
        submit: false,
      }),
    ).rejects.toThrow('errors.stockRequests.productInactive');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('limits list queries of site roles to their site only', () => {
    const factory = new CaslAbilityFactory();
    const scope = (user: User) =>
      readableStockRequestsWhere(user, factory.createForUser(user));
    expect(scope(requester)).toEqual({ siteId: SITE });
    expect(scope(reviewer)).toBeUndefined();
    expect(scope(hqManager)).toBeUndefined();
  });
});

describe('StockRequestsService comment notifications', () => {
  const named = (user: User, firstName: string, lastName: string) =>
    Object.assign(Object.create(user) as User, { firstName, lastName });
  const author = named(reviewer, 'Amit', 'Shah');

  it("notifies the request's creator of someone else's comment", async () => {
    const { service, manager, notifications } = setup();
    await service.addComment(author, 7, { body: 'Sending 3 now' });
    expect(notifications.create).toHaveBeenCalledWith(
      manager,
      requester.id,
      NotificationType.STOCK_REQUEST_COMMENT,
      {
        requestId: 7,
        commentId: 7,
        parentId: null,
        excerpt: 'Sending 3 now',
        author: { id: reviewer.id, firstName: 'Amit', lastName: 'Shah' },
        repliedTo: null,
      },
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({ id: 99, userId: requester.id }),
    );
  });

  it('names whose comment a reply answers', async () => {
    const { service, comments, notifications } = setup();
    comments.findOne.mockResolvedValueOnce({
      id: 40,
      parentId: 38,
      author: { id: hqManager.id, firstName: 'Raj', lastName: 'Patel' },
    });
    await service.addComment(author, 7, { body: 'Agreed', parentId: 40 });
    expect(notifications.create.mock.calls[0][3]).toMatchObject({
      parentId: 40,
      repliedTo: { id: hqManager.id, firstName: 'Raj', lastName: 'Patel' },
    });
  });

  it("stays quiet about the creator's own comments", async () => {
    const { service, notifications } = setup();
    await service.addComment(requester, 7, { body: 'Any update?' });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(notifications.send).not.toHaveBeenCalled();
  });

  it('skips a deactivated creator', async () => {
    const { service, manager, notifications } = setup();
    manager.existsBy.mockResolvedValueOnce(false);
    await service.addComment(author, 7, { body: 'Sending 3 now' });
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('StockRequestsService drafts', () => {
  // Any employee of the site, not only the in-charge.
  const technician = makeUser(12, RoleName.SITE_TECHNICIAN, SITE);
  const draft = { status: StockRequestStatus.DRAFT, requestedById: null };
  const lines = [{ productId: 3, quantity: 2, note: 'Size L' }];

  it('saves a new request as a draft without a requester', async () => {
    const { service, manager } = setup(draft);
    await service.create(technician, { lines, submit: false });
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({ status: StockRequestStatus.DRAFT }),
    ]);
    expect(saved(manager, StockRequest)[0]).not.toHaveProperty('requestedById');
    expect(saved(manager, StockRequestLine)).toEqual([
      [expect.objectContaining({ productId: 3, note: 'Size L' })],
    ]);
  });

  it('makes whoever sends the draft its requester', async () => {
    const { service, manager, products } = setup(draft);
    products[1].isActive = true;
    await service.submit(technician, 7);
    expect(saved(manager, StockRequest)).toEqual([
      expect.objectContaining({
        status: StockRequestStatus.PENDING_REVIEW,
        requestedById: technician.id,
        requestedAt: expect.any(Date),
      }),
    ]);
    expect(events(manager)).toEqual([
      expect.objectContaining({ action: StockRequestAction.SUBMITTED }),
    ]);
  });

  it('checks the products again when a draft is sent', async () => {
    const { service } = setup(draft);
    await expect(service.submit(technician, 7)).rejects.toThrow(
      'errors.stockRequests.productInactive',
    );
  });

  it('replaces the lines of a draft', async () => {
    const { service, manager } = setup(draft);
    await service.update(technician, 7, { lines, submit: false });
    expect(manager.remove).toHaveBeenCalledWith(
      StockRequestLine,
      expect.arrayContaining([expect.objectContaining({ id: 71 })]),
    );
    expect(events(manager)).toEqual([
      expect.objectContaining({ action: StockRequestAction.UPDATED }),
    ]);
  });

  it('refuses to change a request once it is sent (409)', async () => {
    const { service } = setup();
    await expect(
      service.update(technician, 7, { lines, submit: false }),
    ).rejects.toThrow(ConflictException);
    await expect(service.remove(requester, 7)).rejects.toThrow(
      'errors.stockRequests.notDraft',
    );
  });

  it("hides a site's draft from everyone elsewhere, HQ too (404)", async () => {
    for (const actor of [hqManager, superAdmin, reviewer]) {
      const { service } = setup(draft);
      await expect(service.findOne(actor, 7)).rejects.toThrow(
        NotFoundException,
      );
    }
  });

  it('lets the site edit its draft but nobody decide on it', async () => {
    const { service } = setup(draft);
    const request = await service.findOne(technician, 7);
    expect(request.allowed).toMatchObject({
      edit: true,
      decide: false,
      cancel: false,
    });
  });

  it('discards a draft with its lines', async () => {
    const { service, manager } = setup(draft);
    await service.remove(technician, 7);
    expect(manager.remove).toHaveBeenLastCalledWith(
      StockRequest,
      expect.objectContaining({ id: 7 }),
    );
  });
});
