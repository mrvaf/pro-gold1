import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError, BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import type { ProductVariantId } from '../catalog/product-variant.js';
import type { SKU } from '../catalog/sku.js';
import { Weight } from '../material/weight.js';
import { GoldPurity } from '../material/gold-purity.js';
import { JewelryIdentity } from '../product/jewelry-identity.js';
import { InventoryLocationId } from './inventory-location.js';
import { InventoryStatus, InventoryStateMachine } from './inventory-status.js';
import { InventoryMovement } from './inventory-movement.js';
import { Decimal } from 'decimal.js';

export type InventoryItemId = EntityId<'InventoryItem'>;

export interface CreateInventoryItemProps {
  id?: string | undefined;
  tenantId: TenantId;
  storeId?: StoreId | undefined;
  productVariantId: ProductVariantId;
  sku: SKU;
  serialNumber?: string | undefined;
  barcode?: string | undefined;
  locationId: InventoryLocationId;
  quantity?: Decimal | string | number | undefined;
  grossWeight: Weight;
  goldWeight: Weight;
  purity: GoldPurity;
  passportRef?: string | undefined;
  actor: ActorReference;
  notes?: string | undefined;
}

export interface InventoryItemDto {
  id: string;
  tenantId: string;
  storeId?: string | undefined;
  productVariantId: string;
  sku: string;
  serialNumber?: string | undefined;
  barcode?: string | undefined;
  locationId: string;
  status: InventoryStatus;
  quantity: string;
  grossWeightGrams: string;
  goldWeightGrams: string;
  purityFineness: string;
  purityKarat: string;
  passportRef?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface ItemMutationResult {
  item: InventoryItem;
  movement: InventoryMovement;
}

/**
 * Inventory Item Entity.
 * Represents a physical, serialized precious metals jewelry piece held in inventory.
 * Enforces:
 * 1. Physical weight invariants: grossWeight >= goldWeight.
 * 2. Strict State Machine transitions via InventoryStateMachine.
 * 3. Atomic generation of append-only InventoryMovement records for all mutations.
 */
export class InventoryItem extends Entity<InventoryItemId> {
  private readonly _tenantId: TenantId;
  private readonly _storeId: StoreId | undefined;
  private readonly _productVariantId: ProductVariantId;
  private readonly _sku: SKU;
  private readonly _serialNumber: string | undefined;
  private readonly _barcode: string | undefined;
  private _locationId: InventoryLocationId;
  private _status: InventoryStatus;
  private readonly _quantity: Decimal;
  private readonly _grossWeight: Weight;
  private readonly _goldWeight: Weight;
  private readonly _purity: GoldPurity;
  private readonly _passportRef: string | undefined;
  private _audit: AuditMetadata;

  private constructor(
    id: InventoryItemId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    productVariantId: ProductVariantId,
    sku: SKU,
    serialNumber: string | undefined,
    barcode: string | undefined,
    locationId: InventoryLocationId,
    status: InventoryStatus,
    quantity: Decimal,
    grossWeight: Weight,
    goldWeight: Weight,
    purity: GoldPurity,
    passportRef: string | undefined,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._storeId = storeId;
    this._productVariantId = productVariantId;
    this._sku = sku;
    this._serialNumber = serialNumber;
    this._barcode = barcode;
    this._locationId = locationId;
    this._status = status;
    this._quantity = quantity;
    this._grossWeight = grossWeight;
    this._goldWeight = goldWeight;
    this._purity = purity;
    this._passportRef = passportRef;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get productVariantId(): ProductVariantId {
    return this._productVariantId;
  }

  get sku(): SKU {
    return this._sku;
  }

  get serialNumber(): string | undefined {
    return this._serialNumber;
  }

  get barcode(): string | undefined {
    return this._barcode;
  }

  get locationId(): InventoryLocationId {
    return this._locationId;
  }

  get status(): InventoryStatus {
    return this._status;
  }

  get quantity(): Decimal {
    return this._quantity;
  }

  get grossWeight(): Weight {
    return this._grossWeight;
  }

  get goldWeight(): Weight {
    return this._goldWeight;
  }

  get purity(): GoldPurity {
    return this._purity;
  }

  get passportRef(): string | undefined {
    return this._passportRef;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  /**
   * Derive foundational Stage 2 JewelryIdentity for integration.
   */
  get identity(): JewelryIdentity {
    return JewelryIdentity.create(this.id, this._sku.value, this._barcode).unwrap();
  }

  /**
   * Primary intake factory: Creates the physical item and its corresponding INTAKE movement.
   */
  static intake(
    props: CreateInventoryItemProps
  ): Result<ItemMutationResult, ValidationError | BusinessRuleViolationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Inventory item must belong to a valid tenant.'));
    }

    if (!props.productVariantId || props.productVariantId.trim().length === 0) {
      return err(new ValidationError('Inventory item must reference a product variant.'));
    }

    if (!props.locationId || props.locationId.trim().length === 0) {
      return err(new ValidationError('Inventory item must be placed in a valid location.'));
    }

    // Weight Invariant: Gross weight cannot be less than gold weight
    if (props.grossWeight.grams.lessThan(props.goldWeight.grams)) {
      return err(
        new ValidationError(
          `Gross weight (${props.grossWeight.toString()}) cannot be less than gold weight (${props.goldWeight.toString()}).`
        )
      );
    }

    let qty = new Decimal(1);
    if (props.quantity !== undefined) {
      try {
        qty = props.quantity instanceof Decimal ? props.quantity : new Decimal(props.quantity);
        if (!qty.isFinite() || qty.isNaN() || qty.lessThanOrEqualTo(0)) {
          return err(new ValidationError(`Quantity must be greater than zero. Received: "${props.quantity}"`));
        }
      } catch {
        return err(new ValidationError(`Invalid quantity: "${props.quantity}"`));
      }
    }

    const itemId = createEntityId<InventoryItemId>(
      props.id ?? generateId('inv')
    );
    const audit = AuditMetadata.create(props.actor);

    const item = new InventoryItem(
      itemId,
      props.tenantId,
      props.storeId,
      props.productVariantId,
      props.sku,
      props.serialNumber?.trim() || undefined,
      props.barcode?.trim() || undefined,
      props.locationId,
      'AVAILABLE', // Initial state
      qty,
      props.grossWeight,
      props.goldWeight,
      props.purity,
      props.passportRef?.trim() || undefined,
      audit
    );

    // Generate initial INTAKE movement
    const movementRes = InventoryMovement.record({
      tenantId: props.tenantId,
      inventoryItemId: itemId,
      movementType: 'INTAKE',
      toLocationId: props.locationId,
      fromStatus: 'AVAILABLE',
      toStatus: 'AVAILABLE',
      quantity: qty,
      occurredAt: audit.createdAt,
      actor: props.actor,
      reference: props.serialNumber ? `INTAKE-${props.serialNumber}` : 'INITIAL_INTAKE',
      notes: props.notes,
    });

    if (movementRes.isErr) {
      return err(movementRes.error);
    }

    return ok({ item, movement: movementRes.value });
  }

  static reconstitute(
    id: InventoryItemId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    productVariantId: ProductVariantId,
    sku: SKU,
    serialNumber: string | undefined,
    barcode: string | undefined,
    locationId: InventoryLocationId,
    status: InventoryStatus,
    quantity: Decimal,
    grossWeight: Weight,
    goldWeight: Weight,
    purity: GoldPurity,
    passportRef: string | undefined,
    audit: AuditMetadata
  ): InventoryItem {
    return new InventoryItem(
      id,
      tenantId,
      storeId,
      productVariantId,
      sku,
      serialNumber,
      barcode,
      locationId,
      status,
      quantity,
      grossWeight,
      goldWeight,
      purity,
      passportRef,
      audit
    );
  }

  /**
   * Transfer item to another physical location within the same tenant.
   */
  transfer(
    toLocationId: InventoryLocationId,
    actor: ActorReference,
    reference?: string,
    notes?: string
  ): Result<InventoryMovement, ValidationError | BusinessRuleViolationError> {
    if (!toLocationId || toLocationId.trim().length === 0) {
      return err(new ValidationError('Target location cannot be empty.'));
    }
    if (this._locationId === toLocationId) {
      return err(new BusinessRuleViolationError('Item is already in the specified location.'));
    }
    if (this._status === 'SOLD' || this._status === 'LOST') {
      return err(
        new BusinessRuleViolationError(`Cannot relocate item in status "${this._status}".`)
      );
    }

    const fromLoc = this._locationId;
    this._locationId = toLocationId;
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'TRANSFER',
      fromLocationId: fromLoc,
      toLocationId,
      fromStatus: this._status,
      toStatus: this._status,
      quantity: this._quantity,
      actor,
      reference,
      notes,
    });
  }

  /**
   * Begin transit transfer to another physical location (sets status to IN_TRANSIT).
   */
  startTransfer(
    toLocationId: InventoryLocationId,
    actor: ActorReference,
    reference?: string,
    notes?: string
  ): Result<InventoryMovement, ValidationError | BusinessRuleViolationError> {
    if (!toLocationId || toLocationId.trim().length === 0) {
      return err(new ValidationError('Target location cannot be empty.'));
    }
    if (this._locationId === toLocationId) {
      return err(new BusinessRuleViolationError('Item is already in the specified location.'));
    }

    const val = InventoryStateMachine.validateTransition(this._status, 'IN_TRANSIT');
    if (val.isErr) return err(val.error);

    const fromStatus = this._status;
    this._status = 'IN_TRANSIT';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'TRANSFER',
      fromLocationId: this._locationId,
      toLocationId,
      fromStatus,
      toStatus: 'IN_TRANSIT',
      quantity: this._quantity,
      actor,
      reference,
      notes: notes ?? 'Dispatching for physical transit',
    });
  }

  /**
   * Complete arrival of an item that is IN_TRANSIT at its target destination location.
   */
  completeTransfer(
    arrivalLocationId: InventoryLocationId,
    actor: ActorReference,
    reference?: string,
    notes?: string
  ): Result<InventoryMovement, ValidationError | BusinessRuleViolationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'AVAILABLE');
    if (val.isErr) return err(val.error);

    const fromLoc = this._locationId;
    this._locationId = arrivalLocationId;
    this._status = 'AVAILABLE';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'TRANSFER',
      fromLocationId: fromLoc,
      toLocationId: arrivalLocationId,
      fromStatus: 'IN_TRANSIT',
      toStatus: 'AVAILABLE',
      quantity: this._quantity,
      actor,
      reference,
      notes: notes ?? 'Arrived and checked into destination location',
    });
  }

  /**
   * Reserve item for a customer.
   */
  reserve(
    actor: ActorReference,
    reference?: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'RESERVED');
    if (val.isErr) return err(val.error);

    const fromStatus = this._status;
    this._status = 'RESERVED';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'RESERVATION',
      fromLocationId: this._locationId,
      toLocationId: this._locationId,
      fromStatus,
      toStatus: 'RESERVED',
      quantity: this._quantity,
      actor,
      reference,
    });
  }

  /**
   * Release reservation back to AVAILABLE.
   */
  releaseReservation(
    actor: ActorReference,
    reference?: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'AVAILABLE');
    if (val.isErr) return err(val.error);

    const fromStatus = this._status;
    this._status = 'AVAILABLE';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'RELEASE_RESERVATION',
      fromLocationId: this._locationId,
      toLocationId: this._locationId,
      fromStatus,
      toStatus: 'AVAILABLE',
      quantity: this._quantity,
      actor,
      reference,
    });
  }

  /**
   * Mark item as SOLD.
   */
  markAsSold(
    actor: ActorReference,
    reference?: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'SOLD');
    if (val.isErr) return err(val.error);

    const fromStatus = this._status;
    this._status = 'SOLD';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'SALE',
      fromLocationId: this._locationId,
      toLocationId: this._locationId,
      fromStatus,
      toStatus: 'SOLD',
      quantity: this._quantity,
      actor,
      reference,
    });
  }

  /**
   * Formal return from SOLD state back into AVAILABLE inventory.
   * Invariant: SOLD cannot silently become AVAILABLE without an explicit return workflow.
   */
  returnFromSold(
    actor: ActorReference,
    reason: string,
    toLocationId?: InventoryLocationId,
    reference?: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'AVAILABLE', {
      isExplicitReturnWorkflow: true,
      reason,
      reference,
    });
    if (val.isErr) return err(val.error);

    const fromLoc = this._locationId;
    const targetLoc = toLocationId ?? this._locationId;

    this._locationId = targetLoc;
    this._status = 'AVAILABLE';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'RETURN',
      fromLocationId: fromLoc,
      toLocationId: targetLoc,
      fromStatus: 'SOLD',
      toStatus: 'AVAILABLE',
      quantity: this._quantity,
      actor,
      reference,
      notes: reason,
    });
  }

  /**
   * Mark item as DAMAGED.
   */
  markAsDamaged(
    actor: ActorReference,
    reason: string,
    toLocationId?: InventoryLocationId
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'DAMAGED');
    if (val.isErr) return err(val.error);

    const fromLoc = this._locationId;
    if (toLocationId) {
      this._locationId = toLocationId;
    }
    const fromStatus = this._status;
    this._status = 'DAMAGED';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'DAMAGE',
      fromLocationId: fromLoc,
      toLocationId: this._locationId,
      fromStatus,
      toStatus: 'DAMAGED',
      quantity: this._quantity,
      actor,
      notes: reason,
    });
  }

  /**
   * Mark item as LOST.
   */
  markAsLost(
    actor: ActorReference,
    reason: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'LOST');
    if (val.isErr) return err(val.error);

    const fromStatus = this._status;
    this._status = 'LOST';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'LOSS',
      fromLocationId: this._locationId,
      toLocationId: this._locationId,
      fromStatus,
      toStatus: 'LOST',
      quantity: this._quantity,
      actor,
      notes: reason,
    });
  }

  /**
   * Recover a LOST item back into AVAILABLE status.
   */
  recoverLost(
    actor: ActorReference,
    toLocationId: InventoryLocationId,
    notes: string
  ): Result<InventoryMovement, BusinessRuleViolationError | ValidationError> {
    const val = InventoryStateMachine.validateTransition(this._status, 'AVAILABLE', {
      isRecoveryWorkflow: true,
      reason: notes,
    });
    if (val.isErr) return err(val.error);

    const fromLoc = this._locationId;
    this._locationId = toLocationId;
    this._status = 'AVAILABLE';
    this._audit = this._audit.touch(actor);

    return InventoryMovement.record({
      tenantId: this._tenantId,
      inventoryItemId: this.id,
      movementType: 'RECOVERY',
      fromLocationId: fromLoc,
      toLocationId,
      fromStatus: 'LOST',
      toStatus: 'AVAILABLE',
      quantity: this._quantity,
      actor,
      notes,
    });
  }

  toDto(): InventoryItemDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      storeId: this._storeId,
      productVariantId: this._productVariantId,
      sku: this._sku.value,
      serialNumber: this._serialNumber,
      barcode: this._barcode,
      locationId: this._locationId,
      status: this._status,
      quantity: this._quantity.toString(),
      grossWeightGrams: this._grossWeight.grams.toString(),
      goldWeightGrams: this._goldWeight.grams.toString(),
      purityFineness: this._purity.fineness.toString(),
      purityKarat: this._purity.karat.toString(),
      passportRef: this._passportRef,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
