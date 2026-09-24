import {
  type SellerWorkspaceRepositoryPort,
  type SellerProfileRepositoryPort,
  type TenantRepositoryPort,
  type StoreRepositoryPort,
  type TenantMembershipRepositoryPort,
  type UserRepositoryPort,
  type InventoryItemRepositoryPort,
  type InventoryLocationRepositoryPort,
  type SellerListingRepositoryPort,
  type InventoryUnitOfWorkPort,
  SellerWorkspace,
  type SellerWorkspaceId,
  type WorkspaceStatus,
  type TenantId,
  type StoreId,
  type SellerProfileId,
  type InventoryItemId,
  type InventoryLocationId,
  type MembershipId,
  type UserId,
  type Role,
  type MembershipStatus,
  type InventoryStatus,
  type ListingStatus,
  type SellerOverviewDto,
  createEntityId,
  ActorReference,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleViolationError,
  InvalidWorkspaceStateError,
  WorkspaceSuspendedError,
  type Result,
  ok,
  err,
  TenantMembership,
  type InventoryItem,
  type InventoryMovement,
  type SellerListing,
} from '@v-gold/core';
import type { InventoryService } from '@/lib/inventory/inventory-service';
import type { SellerMarketplaceService } from '@/lib/marketplace/seller-marketplace.service';

export interface CreateWorkspaceInput {
  tenantId: string;
  sellerProfileId: string;
  storeId?: string | undefined;
  name: string;
  settings?: Record<string, unknown> | undefined;
  actorId?: string | undefined;
}

export interface UpdateWorkspaceInput {
  workspaceId: string;
  tenantId: string;
  name?: string | undefined;
  storeId?: string | undefined;
  settings?: Record<string, unknown> | undefined;
  actorId?: string | undefined;
}

export interface StaffMemberDto {
  membershipId: string;
  userId: string;
  tenantId: string;
  role: Role;
  status: MembershipStatus;
  user: {
    displayName: string;
    email: string;
    status: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferInventoryInput {
  tenantId: string;
  workspaceId: string;
  itemId: string;
  toLocationId: string;
  reference?: string | undefined;
  reason?: string | undefined;
  actorId?: string | undefined;
}

export class SellerOsService {
  constructor(
    private readonly workspaceRepo: SellerWorkspaceRepositoryPort,
    private readonly sellerProfileRepo: SellerProfileRepositoryPort,
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly storeRepo: StoreRepositoryPort,
    private readonly membershipRepo: TenantMembershipRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly inventoryItemRepo: InventoryItemRepositoryPort,
    private readonly inventoryLocationRepo: InventoryLocationRepositoryPort,
    private readonly inventoryUow: InventoryUnitOfWorkPort,
    private readonly sellerListingRepo: SellerListingRepositoryPort,
    private readonly inventoryService: InventoryService,
    private readonly marketplaceService: SellerMarketplaceService
  ) {}

  // -------------------------------------------------------------
  // 1. Workspace Lifecycle & Management
  // -------------------------------------------------------------

  async createWorkspace(
    input: CreateWorkspaceInput
  ): Promise<Result<SellerWorkspace, ValidationError | ConflictError | NotFoundError | ForbiddenError>> {
    const tenId = createEntityId<TenantId>(input.tenantId);
    const sellerId = createEntityId<SellerProfileId>(input.sellerProfileId);

    // 1. Verify tenant exists
    const tenant = await this.tenantRepo.findById(tenId);
    if (!tenant) {
      return err(new NotFoundError(`Tenant "${input.tenantId}" not found.`));
    }

    // 2. Verify seller profile exists and belongs to same tenant
    const seller = await this.sellerProfileRepo.findById(sellerId, tenId);
    if (!seller) {
      const anySeller = await this.sellerProfileRepo.findById(sellerId);
      if (anySeller && anySeller.tenantId !== tenId) {
        return err(new ForbiddenError('Access to seller profile from a different tenant is denied.'));
      }
      return err(new NotFoundError(`Seller profile "${input.sellerProfileId}" not found.`));
    }

    // 3. Check single workspace per seller profile invariant
    const existingWs = await this.workspaceRepo.findBySellerProfileId(sellerId, tenId);
    if (existingWs) {
      return err(
        new ConflictError(
          `Workspace already exists for seller profile "${input.sellerProfileId}". Single workspace per seller profile invariant violated.`
        )
      );
    }

    // 4. Verify store if provided
    let storeId: StoreId | undefined;
    if (input.storeId) {
      storeId = createEntityId<StoreId>(input.storeId);
      const store = await this.storeRepo.findById(tenId, storeId);
      if (!store) {
        return err(new NotFoundError(`Store "${input.storeId}" not found in tenant "${input.tenantId}".`));
      }
    }

    // 5. Build and save entity
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const wsRes = SellerWorkspace.create({
      tenantId: tenId,
      sellerProfileId: sellerId,
      storeId,
      name: input.name,
      settings: input.settings,
      actor,
    });

    if (wsRes.isErr) return err(wsRes.error);

    const ws = wsRes.value;
    await this.workspaceRepo.save(ws);
    return ok(ws);
  }

  async getWorkspaceById(
    workspaceId: string,
    tenantId: string
  ): Promise<Result<SellerWorkspace, NotFoundError | ForbiddenError>> {
    const wsId = createEntityId<SellerWorkspaceId>(workspaceId);
    const tenId = createEntityId<TenantId>(tenantId);

    const ws = await this.workspaceRepo.findById(wsId, tenId);
    if (!ws) {
      const anyWs = await this.workspaceRepo.findById(wsId);
      if (anyWs && anyWs.tenantId !== tenId) {
        return err(new ForbiddenError('Access to workspace from a different tenant is denied.'));
      }
      return err(new NotFoundError(`Seller workspace "${workspaceId}" not found.`));
    }

    return ok(ws);
  }

  async getWorkspaceBySeller(
    sellerProfileId: string,
    tenantId: string
  ): Promise<Result<SellerWorkspace, NotFoundError | ForbiddenError>> {
    const sId = createEntityId<SellerProfileId>(sellerProfileId);
    const tenId = createEntityId<TenantId>(tenantId);

    const ws = await this.workspaceRepo.findBySellerProfileId(sId, tenId);
    if (!ws) {
      return err(new NotFoundError(`No workspace found for seller profile "${sellerProfileId}".`));
    }

    return ok(ws);
  }

  async updateWorkspace(
    input: UpdateWorkspaceInput
  ): Promise<Result<SellerWorkspace, ValidationError | NotFoundError | ForbiddenError>> {
    const wsRes = await this.getWorkspaceById(input.workspaceId, input.tenantId);
    if (wsRes.isErr) return err(wsRes.error);

    const ws = wsRes.value;
    const tenId = createEntityId<TenantId>(input.tenantId);
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    if (input.name !== undefined) {
      const nameRes = ws.updateName(input.name, actor);
      if (nameRes.isErr) return err(nameRes.error);
    }

    if (input.storeId !== undefined) {
      if (input.storeId === '' || input.storeId === null) {
        ws.setStoreId(undefined, actor);
      } else {
        const storeId = createEntityId<StoreId>(input.storeId);
        const store = await this.storeRepo.findById(tenId, storeId);
        if (!store) {
          return err(new NotFoundError(`Store "${input.storeId}" not found in tenant "${input.tenantId}".`));
        }
        ws.setStoreId(storeId, actor);
      }
    }

    if (input.settings !== undefined) {
      ws.updateSettings(input.settings, actor);
    }

    await this.workspaceRepo.save(ws);
    return ok(ws);
  }

  async transitionWorkspaceStatus(
    workspaceId: string,
    tenantId: string,
    targetStatus: WorkspaceStatus,
    actorId?: string,
    reason?: string
  ): Promise<Result<SellerWorkspace, InvalidWorkspaceStateError | NotFoundError | ForbiddenError>> {
    const wsRes = await this.getWorkspaceById(workspaceId, tenantId);
    if (wsRes.isErr) return err(wsRes.error);

    const ws = wsRes.value;
    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    let res: Result<void, InvalidWorkspaceStateError>;
    switch (targetStatus) {
      case 'SUSPENDED':
        res = ws.suspend(actor, reason);
        break;
      case 'ACTIVE':
        res = ws.reinstate(actor);
        break;
      case 'ARCHIVED':
        res = ws.archive(actor, reason);
        break;
      default:
        res = ws.suspend(actor, reason);
    }

    if (res.isErr) return err(res.error);

    await this.workspaceRepo.save(ws);
    return ok(ws);
  }

  // -------------------------------------------------------------
  // 2. Operational Overview Foundation (Real Data, Zero Fake KPIs)
  // -------------------------------------------------------------

  async getOperationalOverview(
    workspaceId: string,
    tenantId: string
  ): Promise<Result<SellerOverviewDto, NotFoundError | ForbiddenError>> {
    // 1. Fetch workspace
    const wsRes = await this.getWorkspaceById(workspaceId, tenantId);
    if (wsRes.isErr) return err(wsRes.error);
    const workspace = wsRes.value;

    const tenId = createEntityId<TenantId>(tenantId);

    // 2. Fetch seller profile
    const seller = await this.sellerProfileRepo.findById(workspace.sellerProfileId, tenId);
    if (!seller) {
      return err(new NotFoundError(`Seller profile "${workspace.sellerProfileId}" not found.`));
    }

    // 3. Fetch store if bound
    let storeInfo: { id: string; name: string; code: string; status: string } | null = null;
    if (workspace.storeId) {
      const store = await this.storeRepo.findById(tenId, workspace.storeId);
      if (store) {
        storeInfo = {
          id: store.id,
          name: store.name,
          code: store.code,
          status: store.status,
        };
      }
    }

    // 4. Query real inventory items for this tenant and store
    let allItems = await this.inventoryItemRepo.listByTenant(tenId);
    if (workspace.storeId) {
      allItems = allItems.filter((i) => i.storeId === workspace.storeId);
    }

    const inventorySummary = {
      totalItems: allItems.length,
      availableItems: allItems.filter((i) => i.status === 'AVAILABLE').length,
      reservedItems: allItems.filter((i) => i.status === 'RESERVED').length,
      inTransitItems: allItems.filter((i) => i.status === 'IN_TRANSIT').length,
      damagedItems: allItems.filter((i) => i.status === 'DAMAGED').length,
      lostItems: allItems.filter((i) => i.status === 'LOST').length,
      soldItems: allItems.filter((i) => i.status === 'SOLD').length,
    };

    // 5. Query real listings for this seller profile
    const allListings = await this.sellerListingRepo.listBySeller(workspace.sellerProfileId, tenId);

    const listingSummary = {
      totalListings: allListings.length,
      activeListings: allListings.filter((l) => l.status === 'ACTIVE').length,
      pausedListings: allListings.filter((l) => l.status === 'PAUSED').length,
      draftListings: allListings.filter((l) => l.status === 'DRAFT').length,
      archivedListings: allListings.filter((l) => l.status === 'ARCHIVED').length,
    };

    // 6. Query real tenant memberships for staff counts
    const memberships = await this.membershipRepo.findAllByTenant(tenId);

    const staffSummary = {
      totalMembers: memberships.length,
      activeMembers: memberships.filter((m) => m.isActive()).length,
      operatorsCount: memberships.filter((m) => m.role === 'OPERATOR').length,
    };

    return ok({
      workspaceId: workspace.id,
      tenantId: workspace.tenantId,
      sellerProfile: {
        id: seller.id,
        displayName: seller.displayName,
        slug: seller.slug,
        status: seller.status,
      },
      store: storeInfo,
      inventorySummary,
      listingSummary,
      staffSummary,
    });
  }

  // -------------------------------------------------------------
  // 3. Staff Management Operations (Reusing IAM User & TenantMembership)
  // -------------------------------------------------------------

  async listStaff(tenantId: string): Promise<Result<StaffMemberDto[], ForbiddenError>> {
    const tenId = createEntityId<TenantId>(tenantId);
    const memberships = await this.membershipRepo.findAllByTenant(tenId);

    const result: StaffMemberDto[] = [];
    for (const mem of memberships) {
      const user = await this.userRepo.findById(mem.userId);
      result.push({
        membershipId: mem.id,
        userId: mem.userId,
        tenantId: mem.tenantId,
        role: mem.role,
        status: mem.status,
        user: user
          ? {
              displayName: user.displayName,
              email: user.email.value,
              status: user.status,
            }
          : null,
        createdAt: mem.audit.createdAt.toISOString(),
        updatedAt: mem.audit.updatedAt.toISOString(),
      });
    }

    return ok(result);
  }

  async addStaffMember(
    tenantId: string,
    userId: string,
    role: Role,
    actorId?: string
  ): Promise<Result<TenantMembership, NotFoundError | ConflictError | ForbiddenError | ValidationError>> {
    const tenId = createEntityId<TenantId>(tenantId);
    const uId = createEntityId<UserId>(userId);

    // 1. Verify user exists
    const user = await this.userRepo.findById(uId);
    if (!user) {
      return err(new NotFoundError(`User "${userId}" not found.`));
    }

    // 2. Check if membership already exists for this tenant
    const existing = await this.membershipRepo.findByUserAndTenant(uId, tenId);
    if (existing) {
      return err(
        new ConflictError(`User "${userId}" is already a member of tenant "${tenantId}".`)
      );
    }

    // 3. Create membership
    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const memRes = TenantMembership.create({
      tenantId: tenId,
      userId: uId,
      role,
      actor,
    });

    if (memRes.isErr) return err(memRes.error);

    const mem = memRes.value;
    await this.membershipRepo.save(mem);
    return ok(mem);
  }

  async updateStaffRole(
    tenantId: string,
    membershipId: string,
    newRole: Role,
    actorId?: string
  ): Promise<Result<TenantMembership, NotFoundError | ForbiddenError | ValidationError>> {
    const tenId = createEntityId<TenantId>(tenantId);
    const memId = createEntityId<MembershipId>(membershipId);

    const mem = await this.membershipRepo.findById(memId);
    if (!mem) {
      return err(new NotFoundError(`Membership "${membershipId}" not found.`));
    }
    if (mem.tenantId !== tenId) {
      return err(new ForbiddenError('Access to membership of another tenant is denied.'));
    }

    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    mem.changeRole(newRole, actor);
    await this.membershipRepo.save(mem);
    return ok(mem);
  }

  async updateStaffStatus(
    tenantId: string,
    membershipId: string,
    status: MembershipStatus,
    actorId?: string
  ): Promise<Result<TenantMembership, NotFoundError | ForbiddenError>> {
    const tenId = createEntityId<TenantId>(tenantId);
    const memId = createEntityId<MembershipId>(membershipId);

    const mem = await this.membershipRepo.findById(memId);
    if (!mem) {
      return err(new NotFoundError(`Membership "${membershipId}" not found.`));
    }
    if (mem.tenantId !== tenId) {
      return err(new ForbiddenError('Access to membership of another tenant is denied.'));
    }

    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    switch (status) {
      case 'ACTIVE':
        mem.activate(actor);
        break;
      case 'SUSPENDED':
        mem.suspend(actor);
        break;
      case 'REVOKED':
        mem.revoke(actor);
        break;
    }

    await this.membershipRepo.save(mem);
    return ok(mem);
  }

  // -------------------------------------------------------------
  // 4. Inventory Orchestration (via Stage 6 Inventory Foundation)
  // -------------------------------------------------------------

  async listWorkspaceInventory(
    workspaceId: string,
    tenantId: string,
    filter?: { status?: InventoryStatus; locationId?: string }
  ): Promise<Result<InventoryItem[], NotFoundError | ForbiddenError>> {
    const wsRes = await this.getWorkspaceById(workspaceId, tenantId);
    if (wsRes.isErr) return err(wsRes.error);
    const ws = wsRes.value;

    const tenId = createEntityId<TenantId>(tenantId);
    let items = await this.inventoryItemRepo.listByTenant(tenId, {
      status: filter?.status,
    });

    if (ws.storeId) {
      items = items.filter((i) => i.storeId === ws.storeId);
    }
    if (filter?.locationId) {
      items = items.filter((i) => i.locationId === filter.locationId);
    }

    return ok(items);
  }

  async transferInventoryItem(
    input: TransferInventoryInput
  ): Promise<
    Result<
      { item: InventoryItem; movement: InventoryMovement },
      NotFoundError | ForbiddenError | ValidationError | BusinessRuleViolationError | WorkspaceSuspendedError
    >
  > {
    const wsRes = await this.getWorkspaceById(input.workspaceId, input.tenantId);
    if (wsRes.isErr) return err(wsRes.error);
    const ws = wsRes.value;

    if (ws.status === 'SUSPENDED') {
      return err(new WorkspaceSuspendedError('Cannot perform inventory transfers while workspace is suspended.'));
    }

    const tenId = createEntityId<TenantId>(input.tenantId);
    const itmId = createEntityId<InventoryItemId>(input.itemId);
    const targetLocId = createEntityId<InventoryLocationId>(input.toLocationId);

    // 1. Fetch item and verify tenant
    const item = await this.inventoryItemRepo.findById(itmId, tenId);
    if (!item) {
      const anyItem = await this.inventoryItemRepo.findById(itmId);
      if (anyItem && anyItem.tenantId !== tenId) {
        return err(new ForbiddenError('Item belongs to another tenant.'));
      }
      return err(new NotFoundError(`Inventory item "${input.itemId}" not found.`));
    }

    // 2. Fetch destination location and verify tenant
    const loc = await this.inventoryLocationRepo.findById(targetLocId, tenId);
    if (!loc) {
      const anyLoc = await this.inventoryLocationRepo.findById(targetLocId);
      if (anyLoc && anyLoc.tenantId !== tenId) {
        return err(new ForbiddenError('Target location belongs to another tenant.'));
      }
      return err(new NotFoundError(`Target location "${input.toLocationId}" not found.`));
    }

    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // 3. Execute transfer
    const moveRes = item.transfer(targetLocId, actor, input.reference, input.reason);
    if (moveRes.isErr) return err(moveRes.error);

    const movement = moveRes.value;
    await this.inventoryUow.saveItemWithMovement(item, movement);

    return ok({ item, movement });
  }

  // -------------------------------------------------------------
  // 5. Listings Orchestration (via Stage 7 Marketplace Foundation)
  // -------------------------------------------------------------

  async listWorkspaceListings(
    workspaceId: string,
    tenantId: string,
    filter?: { status?: ListingStatus }
  ): Promise<Result<SellerListing[], NotFoundError | ForbiddenError>> {
    const wsRes = await this.getWorkspaceById(workspaceId, tenantId);
    if (wsRes.isErr) return err(wsRes.error);
    const ws = wsRes.value;

    const tenId = createEntityId<TenantId>(tenantId);
    const listings = await this.sellerListingRepo.listBySeller(ws.sellerProfileId, tenId, filter);
    return ok(listings);
  }
}
