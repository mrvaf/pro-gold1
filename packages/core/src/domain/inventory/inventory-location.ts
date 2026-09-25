import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';

export type InventoryLocationId = EntityId<'InventoryLocation'>;
export type InventoryLocationType =
  | 'STORE_FRONT'
  | 'VAULT'
  | 'DISPLAY'
  | 'WORKSHOP'
  | 'WAREHOUSE'
  | 'IN_TRANSIT'
  | 'OTHER';
export type InventoryLocationStatus = 'ACTIVE' | 'INACTIVE';

export interface CreateInventoryLocationProps {
  id?: string | undefined;
  tenantId: TenantId;
  storeId?: StoreId | undefined;
  name: string;
  code: string;
  type: InventoryLocationType;
  actor?: ActorReference | undefined;
}

export interface InventoryLocationDto {
  id: string;
  tenantId: string;
  storeId?: string | undefined;
  name: string;
  code: string;
  type: InventoryLocationType;
  status: InventoryLocationStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Inventory Location Entity.
 * Represents physical storage areas within a store or merchant facility (Vault, Showcase, Workshop).
 * Bound strictly to Tenant (and optionally Store).
 * Uniqueness: (tenantId + code) is unique.
 */
export class InventoryLocation extends Entity<InventoryLocationId> {
  private readonly _tenantId: TenantId;
  private readonly _storeId: StoreId | undefined;
  private _name: string;
  private readonly _code: string;
  private readonly _type: InventoryLocationType;
  private _status: InventoryLocationStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: InventoryLocationId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    name: string,
    code: string,
    type: InventoryLocationType,
    status: InventoryLocationStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._storeId = storeId;
    this._name = name;
    this._code = code;
    this._type = type;
    this._status = status;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get name(): string {
    return this._name;
  }

  get code(): string {
    return this._code;
  }

  get type(): InventoryLocationType {
    return this._type;
  }

  get status(): InventoryLocationStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateInventoryLocationProps): Result<InventoryLocation, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Inventory location must belong to a valid tenant.'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return err(new ValidationError('Location name cannot be empty.'));
    }

    if (!props.code || props.code.trim().length === 0) {
      return err(new ValidationError('Location code cannot be empty.'));
    }

    const trimmedCode = props.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,64}$/.test(trimmedCode)) {
      return err(
        new ValidationError(
          `Invalid location code: "${props.code}". Code must contain 2-64 uppercase alphanumeric characters, dashes, or underscores.`
        )
      );
    }

    const validTypes: InventoryLocationType[] = [
      'STORE_FRONT',
      'VAULT',
      'DISPLAY',
      'WORKSHOP',
      'WAREHOUSE',
      'IN_TRANSIT',
      'OTHER',
    ];
    if (!validTypes.includes(props.type)) {
      return err(
        new ValidationError(
          `Invalid location type: "${props.type}". Must be one of: ${validTypes.join(', ')}`
        )
      );
    }

    const id = createEntityId<InventoryLocationId>(
      props.id ?? generateId('loc')
    );
    const audit = AuditMetadata.create(props.actor);

    return ok(
      new InventoryLocation(
        id,
        props.tenantId,
        props.storeId,
        props.name.trim(),
        trimmedCode,
        props.type,
        'ACTIVE',
        audit
      )
    );
  }

  static reconstitute(
    id: InventoryLocationId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    name: string,
    code: string,
    type: InventoryLocationType,
    status: InventoryLocationStatus,
    audit: AuditMetadata
  ): InventoryLocation {
    return new InventoryLocation(id, tenantId, storeId, name, code, type, status, audit);
  }

  deactivate(actor?: ActorReference): void {
    this._status = 'INACTIVE';
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }

  toDto(): InventoryLocationDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      storeId: this._storeId,
      name: this._name,
      code: this._code,
      type: this._type,
      status: this._status,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }
}
