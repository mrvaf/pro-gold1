import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { InventoryItemId } from './inventory-item.js';
import type { InventoryLocationId } from './inventory-location.js';
import type { InventoryStatus } from './inventory-status.js';
import { Decimal } from 'decimal.js';

export type InventoryMovementId = EntityId<'InventoryMovement'>;

export type InventoryMovementType =
  | 'INTAKE' // Initial reception of item into warehouse/vault
  | 'TRANSFER' // Physical transfer between locations
  | 'RESERVATION' // Placed on hold for a customer
  | 'RELEASE_RESERVATION' // Reservation released back to available
  | 'SALE' // Item sold
  | 'RETURN' // Item returned from sold state
  | 'DAMAGE' // Item marked damaged / repair needed
  | 'REPAIR' // Item restored from repair
  | 'LOSS' // Item lost / missing
  | 'RECOVERY' // Item found / recovered
  | 'ADJUSTMENT'; // Audit reconciliation

export interface RecordMovementProps {
  id?: string | undefined;
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  movementType: InventoryMovementType;
  fromLocationId?: InventoryLocationId | undefined;
  toLocationId?: InventoryLocationId | undefined;
  fromStatus: InventoryStatus;
  toStatus: InventoryStatus;
  quantity?: Decimal | string | number | undefined;
  occurredAt?: Date | undefined;
  actor: ActorReference;
  reference?: string | undefined;
  notes?: string | undefined;
}

export interface InventoryMovementDto {
  id: string;
  tenantId: string;
  inventoryItemId: string;
  movementType: InventoryMovementType;
  fromLocationId?: string | undefined;
  toLocationId?: string | undefined;
  fromStatus: InventoryStatus;
  toStatus: InventoryStatus;
  quantity: string;
  occurredAt: string;
  actorId: string;
  actorType: string;
  reference?: string | undefined;
  notes?: string | undefined;
}

/**
 * Inventory Movement Entity.
 * Strictly Append-Only Audit Trail for all physical inventory transitions and relocations.
 * Cannot be modified or deleted once recorded.
 */
export class InventoryMovement extends Entity<InventoryMovementId> {
  private readonly _tenantId: TenantId;
  private readonly _inventoryItemId: InventoryItemId;
  private readonly _movementType: InventoryMovementType;
  private readonly _fromLocationId: InventoryLocationId | undefined;
  private readonly _toLocationId: InventoryLocationId | undefined;
  private readonly _fromStatus: InventoryStatus;
  private readonly _toStatus: InventoryStatus;
  private readonly _quantity: Decimal;
  private readonly _occurredAt: Date;
  private readonly _actor: ActorReference;
  private readonly _reference: string | undefined;
  private readonly _notes: string | undefined;

  private constructor(
    id: InventoryMovementId,
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    movementType: InventoryMovementType,
    fromLocationId: InventoryLocationId | undefined,
    toLocationId: InventoryLocationId | undefined,
    fromStatus: InventoryStatus,
    toStatus: InventoryStatus,
    quantity: Decimal,
    occurredAt: Date,
    actor: ActorReference,
    reference: string | undefined,
    notes: string | undefined
  ) {
    super(id);
    this._tenantId = tenantId;
    this._inventoryItemId = inventoryItemId;
    this._movementType = movementType;
    this._fromLocationId = fromLocationId;
    this._toLocationId = toLocationId;
    this._fromStatus = fromStatus;
    this._toStatus = toStatus;
    this._quantity = quantity;
    this._occurredAt = occurredAt;
    this._actor = actor;
    this._reference = reference;
    this._notes = notes;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get inventoryItemId(): InventoryItemId {
    return this._inventoryItemId;
  }

  get movementType(): InventoryMovementType {
    return this._movementType;
  }

  get fromLocationId(): InventoryLocationId | undefined {
    return this._fromLocationId;
  }

  get toLocationId(): InventoryLocationId | undefined {
    return this._toLocationId;
  }

  get fromStatus(): InventoryStatus {
    return this._fromStatus;
  }

  get toStatus(): InventoryStatus {
    return this._toStatus;
  }

  get quantity(): Decimal {
    return this._quantity;
  }

  get occurredAt(): Date {
    return new Date(this._occurredAt.getTime());
  }

  get actor(): ActorReference {
    return this._actor;
  }

  get reference(): string | undefined {
    return this._reference;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  static record(props: RecordMovementProps): Result<InventoryMovement, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Movement must belong to a valid tenant.'));
    }

    if (!props.inventoryItemId || props.inventoryItemId.trim().length === 0) {
      return err(new ValidationError('Movement must reference a valid inventory item.'));
    }

    if (!props.actor) {
      return err(new ValidationError('Movement must specify an authoritative actor.'));
    }

    let qty = new Decimal(1);
    if (props.quantity !== undefined) {
      try {
        qty = props.quantity instanceof Decimal ? props.quantity : new Decimal(props.quantity);
        if (!qty.isFinite() || qty.isNaN() || qty.lessThanOrEqualTo(0)) {
          return err(new ValidationError(`Movement quantity must be greater than zero. Received: "${props.quantity}"`));
        }
      } catch {
        return err(new ValidationError(`Invalid movement quantity: "${props.quantity}"`));
      }
    }

    const id = createEntityId<InventoryMovementId>(
      props.id ?? generateId('mov')
    );
    const occurredAt = props.occurredAt ?? new Date();

    return ok(
      new InventoryMovement(
        id,
        props.tenantId,
        props.inventoryItemId,
        props.movementType,
        props.fromLocationId,
        props.toLocationId,
        props.fromStatus,
        props.toStatus,
        qty,
        occurredAt,
        props.actor,
        props.reference?.trim() || undefined,
        props.notes?.trim() || undefined
      )
    );
  }

  static reconstitute(
    id: InventoryMovementId,
    tenantId: TenantId,
    inventoryItemId: InventoryItemId,
    movementType: InventoryMovementType,
    fromLocationId: InventoryLocationId | undefined,
    toLocationId: InventoryLocationId | undefined,
    fromStatus: InventoryStatus,
    toStatus: InventoryStatus,
    quantity: Decimal,
    occurredAt: Date,
    actor: ActorReference,
    reference: string | undefined,
    notes: string | undefined
  ): InventoryMovement {
    return new InventoryMovement(
      id,
      tenantId,
      inventoryItemId,
      movementType,
      fromLocationId,
      toLocationId,
      fromStatus,
      toStatus,
      quantity,
      occurredAt,
      actor,
      reference,
      notes
    );
  }

  toDto(): InventoryMovementDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      inventoryItemId: this._inventoryItemId,
      movementType: this._movementType,
      fromLocationId: this._fromLocationId,
      toLocationId: this._toLocationId,
      fromStatus: this._fromStatus,
      toStatus: this._toStatus,
      quantity: this._quantity.toString(),
      occurredAt: this._occurredAt.toISOString(),
      actorId: this._actor.actorId,
      actorType: this._actor.actorType,
      reference: this._reference,
      notes: this._notes,
    };
  }
}
