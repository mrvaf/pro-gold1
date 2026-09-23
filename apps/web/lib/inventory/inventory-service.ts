import {
  type InventoryLocationRepositoryPort,
  type InventoryItemRepositoryPort,
  type InventoryMovementRepositoryPort,
  type ProductVariantRepositoryPort,
  type InventoryLocationListFilter,
  type InventoryItemListFilter,
  type InventoryMovementListFilter,
  InventoryLocation,
  InventoryItem,
  InventoryMovement,
  type InventoryLocationId,
  type InventoryLocationType,
  type InventoryLocationStatus,
  type InventoryItemId,
  type InventoryStatus,
  type ProductVariantId,
  SKU,
  Weight,
  GoldPurity,
  type TenantId,
  type StoreId,
  createEntityId,
  ActorReference,
  ValidationError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  BusinessRuleViolationError,
  type Result,
  ok,
  err,
} from '@v-gold/core';
import { Decimal } from 'decimal.js';

export interface CreateLocationInput {
  tenantId: string;
  storeId?: string | undefined;
  name: string;
  code: string;
  type: InventoryLocationType;
  actorId?: string | undefined;
}

export interface IntakeItemInput {
  tenantId: string;
  storeId?: string | undefined;
  productVariantId: string;
  sku: string;
  locationId: string;
  serialNumber?: string | undefined;
  barcode?: string | undefined;
  quantity?: string | number | undefined;
  grossWeightGrams: string | number;
  goldWeightGrams: string | number;
  purityFineness: string | number;
  passportRef?: string | undefined;
  actorId?: string | undefined;
  notes?: string | undefined;
}

export interface TransitionStatusInput {
  itemId: string;
  tenantId: string;
  targetStatus: InventoryStatus;
  actorId?: string | undefined;
  reason?: string | undefined;
  reference?: string | undefined;
  toLocationId?: string | undefined;
}

export class InventoryService {
  constructor(
    private readonly locationRepo: InventoryLocationRepositoryPort,
    private readonly itemRepo: InventoryItemRepositoryPort,
    private readonly movementRepo: InventoryMovementRepositoryPort,
    private readonly variantRepo: ProductVariantRepositoryPort
  ) {}

  async createLocation(
    input: CreateLocationInput
  ): Promise<Result<InventoryLocation, ValidationError | ConflictError>> {
    const tenantId = createEntityId<TenantId>(input.tenantId);
    const storeId = input.storeId ? createEntityId<StoreId>(input.storeId) : undefined;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // Verify code uniqueness within tenant
    const existing = await this.locationRepo.findByCode(input.code, tenantId);
    if (existing) {
      return err(
        new ConflictError(
          `Location code "${input.code.trim().toUpperCase()}" already exists for tenant "${input.tenantId}".`
        )
      );
    }

    const locRes = InventoryLocation.create({
      tenantId,
      storeId,
      name: input.name,
      code: input.code,
      type: input.type,
      actor,
    });

    if (locRes.isErr) return err(locRes.error);

    const location = locRes.value;
    await this.locationRepo.save(location);
    return ok(location);
  }

  async getLocation(
    locationId: string,
    tenantId: string
  ): Promise<Result<InventoryLocation, NotFoundError | ForbiddenError>> {
    const locId = createEntityId<InventoryLocationId>(locationId);
    const tenId = createEntityId<TenantId>(tenantId);

    const location = await this.locationRepo.findById(locId, tenId);
    if (!location) {
      const anyLoc = await this.locationRepo.findById(locId);
      if (anyLoc && anyLoc.tenantId !== tenId) {
        return err(new ForbiddenError('Access to location from different tenant is denied.'));
      }
      return err(new NotFoundError(`Location "${locationId}" not found.`));
    }

    return ok(location);
  }

  async listLocations(
    tenantId: string,
    filter?: InventoryLocationListFilter
  ): Promise<InventoryLocation[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.locationRepo.listByTenant(tenId, filter);
  }

  async intakeItem(
    input: IntakeItemInput
  ): Promise<
    Result<
      { item: InventoryItem; movement: InventoryMovement },
      ValidationError | ConflictError | NotFoundError | ForbiddenError | BusinessRuleViolationError
    >
  > {
    const tenId = createEntityId<TenantId>(input.tenantId);
    const varId = createEntityId<ProductVariantId>(input.productVariantId);
    const locId = createEntityId<InventoryLocationId>(input.locationId);
    const storeId = input.storeId ? createEntityId<StoreId>(input.storeId) : undefined;
    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    // 1. Verify variant exists and belongs to same tenant
    const variant = await this.variantRepo.findById(varId, tenId);
    if (!variant) {
      const anyVar = await this.variantRepo.findById(varId);
      if (anyVar && anyVar.tenantId !== tenId) {
        return err(new ForbiddenError('Variant belongs to another tenant.'));
      }
      return err(new NotFoundError(`Variant "${input.productVariantId}" not found.`));
    }

    // 2. Verify destination location exists and is ACTIVE
    const location = await this.locationRepo.findById(locId, tenId);
    if (!location) {
      const anyLoc = await this.locationRepo.findById(locId);
      if (anyLoc && anyLoc.tenantId !== tenId) {
        return err(new ForbiddenError('Location belongs to another tenant.'));
      }
      return err(new NotFoundError(`Location "${input.locationId}" not found.`));
    }
    if (location.status !== 'ACTIVE') {
      return err(new BusinessRuleViolationError(`Cannot intake item into INACTIVE location "${location.name}".`));
    }

    // 3. Verify Serial Number uniqueness if provided
    if (input.serialNumber && input.serialNumber.trim().length > 0) {
      const existingSerial = await this.itemRepo.findBySerialNumber(input.serialNumber, tenId);
      if (existingSerial) {
        return err(
          new ConflictError(
            `Serial number "${input.serialNumber}" already exists in tenant "${input.tenantId}".`
          )
        );
      }
    }

    // 4. Validate SKU
    const skuRes = SKU.create(input.sku);
    if (skuRes.isErr) return err(skuRes.error);

    // 5. Validate Weights and Purity
    const grossRes = Weight.fromGrams(input.grossWeightGrams.toString());
    if (grossRes.isErr) return err(grossRes.error);

    const goldRes = Weight.fromGrams(input.goldWeightGrams.toString());
    if (goldRes.isErr) return err(goldRes.error);

    const purityRes = GoldPurity.fromFineness(new Decimal(input.purityFineness));
    if (purityRes.isErr) return err(purityRes.error);

    // 6. Execute intake in domain entity
    const intakeRes = InventoryItem.intake({
      tenantId: tenId,
      storeId,
      productVariantId: varId,
      sku: skuRes.value,
      serialNumber: input.serialNumber,
      barcode: input.barcode,
      locationId: locId,
      quantity: input.quantity,
      grossWeight: grossRes.value,
      goldWeight: goldRes.value,
      purity: purityRes.value,
      passportRef: input.passportRef,
      actor,
      notes: input.notes,
    });

    if (intakeRes.isErr) return err(intakeRes.error);

    const { item, movement } = intakeRes.value;

    // Persist item and initial INTAKE movement atomically
    await this.itemRepo.save(item);
    await this.movementRepo.record(movement);

    return ok({ item, movement });
  }

  async transferItem(
    itemId: string,
    tenantId: string,
    toLocationId: string,
    actorId?: string,
    reference?: string,
    notes?: string
  ): Promise<
    Result<
      { item: InventoryItem; movement: InventoryMovement },
      NotFoundError | ForbiddenError | ValidationError | BusinessRuleViolationError
    >
  > {
    const itmId = createEntityId<InventoryItemId>(itemId);
    const tenId = createEntityId<TenantId>(tenantId);
    const targetLocId = createEntityId<InventoryLocationId>(toLocationId);

    const item = await this.itemRepo.findById(itmId, tenId);
    if (!item) {
      const anyItem = await this.itemRepo.findById(itmId);
      if (anyItem && anyItem.tenantId !== tenId) {
        return err(new ForbiddenError('Item belongs to another tenant.'));
      }
      return err(new NotFoundError(`Inventory item "${itemId}" not found.`));
    }

    const targetLoc = await this.locationRepo.findById(targetLocId, tenId);
    if (!targetLoc) {
      const anyLoc = await this.locationRepo.findById(targetLocId);
      if (anyLoc && anyLoc.tenantId !== tenId) {
        return err(new ForbiddenError('Target location belongs to another tenant.'));
      }
      return err(new NotFoundError(`Target location "${toLocationId}" not found.`));
    }
    if (targetLoc.status !== 'ACTIVE') {
      return err(new BusinessRuleViolationError(`Target location "${targetLoc.name}" is INACTIVE.`));
    }

    const actor = actorId
      ? ActorReference.user(actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    const transferRes = item.transfer(targetLocId, actor, reference, notes);
    if (transferRes.isErr) return err(transferRes.error);

    const movement = transferRes.value;
    await this.itemRepo.save(item);
    await this.movementRepo.record(movement);

    return ok({ item, movement });
  }

  async transitionStatus(
    input: TransitionStatusInput
  ): Promise<
    Result<
      { item: InventoryItem; movement: InventoryMovement },
      NotFoundError | ForbiddenError | ValidationError | BusinessRuleViolationError
    >
  > {
    const itmId = createEntityId<InventoryItemId>(input.itemId);
    const tenId = createEntityId<TenantId>(input.tenantId);

    const item = await this.itemRepo.findById(itmId, tenId);
    if (!item) {
      const anyItem = await this.itemRepo.findById(itmId);
      if (anyItem && anyItem.tenantId !== tenId) {
        return err(new ForbiddenError('Item belongs to another tenant.'));
      }
      return err(new NotFoundError(`Inventory item "${input.itemId}" not found.`));
    }

    const actor = input.actorId
      ? ActorReference.user(input.actorId).unwrapOr(ActorReference.system())
      : ActorReference.system();

    let moveRes: Result<InventoryMovement, ValidationError | BusinessRuleViolationError>;

    switch (input.targetStatus) {
      case 'RESERVED':
        moveRes = item.reserve(actor, input.reference);
        break;

      case 'SOLD':
        moveRes = item.markAsSold(actor, input.reference);
        break;

      case 'DAMAGED':
        moveRes = item.markAsDamaged(
          actor,
          input.reason ?? 'Marked as damaged during operation',
          input.toLocationId ? createEntityId<InventoryLocationId>(input.toLocationId) : undefined
        );
        break;

      case 'LOST':
        moveRes = item.markAsLost(actor, input.reason ?? 'Marked as missing/lost');
        break;

      case 'AVAILABLE':
        if (item.status === 'SOLD') {
          // Explicit return from sold
          if (!input.reason) {
            return err(new ValidationError('Return reason is required when returning a sold item.'));
          }
          moveRes = item.returnFromSold(
            actor,
            input.reason,
            input.toLocationId ? createEntityId<InventoryLocationId>(input.toLocationId) : undefined,
            input.reference
          );
        } else if (item.status === 'RESERVED') {
          moveRes = item.releaseReservation(actor, input.reference);
        } else if (item.status === 'LOST') {
          if (!input.toLocationId) {
            return err(new ValidationError('Target location must be specified when recovering a lost item.'));
          }
          moveRes = item.recoverLost(
            actor,
            createEntityId<InventoryLocationId>(input.toLocationId),
            input.reason ?? 'Recovered into inventory'
          );
        } else if (item.status === 'DAMAGED') {
          // Repair completed
          moveRes = item.transfer(
            input.toLocationId ? createEntityId<InventoryLocationId>(input.toLocationId) : item.locationId,
            actor,
            input.reference,
            input.reason ?? 'Restored after repair'
          );
        } else {
          return err(new BusinessRuleViolationError(`Invalid transition from ${item.status} to AVAILABLE.`));
        }
        break;

      default:
        return err(new BusinessRuleViolationError(`Unsupported target status: ${input.targetStatus}`));
    }

    if (moveRes.isErr) return err(moveRes.error);

    const movement = moveRes.value;
    await this.itemRepo.save(item);
    await this.movementRepo.record(movement);

    return ok({ item, movement });
  }

  async getItem(
    itemId: string,
    tenantId: string
  ): Promise<Result<InventoryItem, NotFoundError | ForbiddenError>> {
    const itmId = createEntityId<InventoryItemId>(itemId);
    const tenId = createEntityId<TenantId>(tenantId);

    const item = await this.itemRepo.findById(itmId, tenId);
    if (!item) {
      const anyItem = await this.itemRepo.findById(itmId);
      if (anyItem && anyItem.tenantId !== tenId) {
        return err(new ForbiddenError('Item belongs to another tenant.'));
      }
      return err(new NotFoundError(`Inventory item "${itemId}" not found.`));
    }

    return ok(item);
  }

  async listItems(tenantId: string, filter?: InventoryItemListFilter): Promise<InventoryItem[]> {
    const tenId = createEntityId<TenantId>(tenantId);
    return this.itemRepo.listByTenant(tenId, filter);
  }

  async listMovements(itemId: string, tenantId: string): Promise<InventoryMovement[]> {
    const itmId = createEntityId<InventoryItemId>(itemId);
    const tenId = createEntityId<TenantId>(tenantId);
    return this.movementRepo.listByItemId(itmId, tenId);
  }
}
