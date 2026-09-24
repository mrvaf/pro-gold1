import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from './tenant.js';

export type StoreId = EntityId<'Store'>;
export type StoreStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING';

export interface CreateStoreProps {
  id?: string;
  tenantId: TenantId;
  name: string;
  code: string;
  actor?: ActorReference;
}

/**
 * Store Entity.
 * Represents a physical or digital jewelry retail/artisan storefront.
 * Crucial Invariant: Always strictly bound to a parent Tenant (tenantId).
 */
export class Store extends Entity<StoreId> {
  private readonly _tenantId: TenantId;
  private _name: string;
  private _code: string;
  private _status: StoreStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: StoreId,
    tenantId: TenantId,
    name: string,
    code: string,
    status: StoreStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._name = name;
    this._code = code;
    this._status = status;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get name(): string {
    return this._name;
  }

  get code(): string {
    return this._code;
  }

  get status(): StoreStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateStoreProps): Result<Store, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Store must belong to a valid tenantId.'));
    }
    if (!props.name || props.name.trim().length === 0) {
      return err(new ValidationError('Store name cannot be empty.'));
    }
    if (!props.code || props.code.trim().length === 0) {
      return err(new ValidationError('Store code cannot be empty.'));
    }

    const trimmedCode = props.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(trimmedCode)) {
      return err(
        new ValidationError(`Invalid store code: "${props.code}". Must contain only alphanumeric characters, underscores, and hyphens.`)
      );
    }

    const storeId = createEntityId<StoreId>(props.id ?? `store_${trimmedCode.toLowerCase()}`);
    const audit = AuditMetadata.create(props.actor);

    return ok(new Store(storeId, props.tenantId, props.name.trim(), trimmedCode, 'ACTIVE', audit));
  }

  static reconstitute(
    id: StoreId,
    tenantId: TenantId,
    name: string,
    code: string,
    status: StoreStatus,
    audit: AuditMetadata
  ): Store {
    return new Store(id, tenantId, name, code, status, audit);
  }

  updateName(newName: string, actor?: ActorReference): Result<void, ValidationError> {
    if (!newName || newName.trim().length === 0) {
      return err(new ValidationError('Store name cannot be empty.'));
    }
    this._name = newName.trim();
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  deactivate(actor?: ActorReference): void {
    this._status = 'INACTIVE';
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }
}
