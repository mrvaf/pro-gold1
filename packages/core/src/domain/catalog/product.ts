import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError, BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import type { JewelryType } from './jewelry-specification.js';

export type ProductId = EntityId<'Product'>;
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface CreateProductProps {
  id?: string | undefined;
  tenantId: TenantId;
  storeId?: StoreId | undefined;
  name: string;
  description?: string | undefined;
  productType: JewelryType;
  actor?: ActorReference | undefined;
}

export interface ProductDto {
  id: string;
  tenantId: string;
  storeId?: string | undefined;
  name: string;
  description?: string | undefined;
  productType: JewelryType;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  createdByActorId?: string | undefined;
  updatedByActorId?: string | undefined;
}

/**
 * Product Entity.
 * Represents the commercial/catalog concept of a jewelry item.
 * Explicitly decoupled from discrete physical InventoryItem instances.
 */
export class Product extends Entity<ProductId> {
  private readonly _tenantId: TenantId;
  private readonly _storeId: StoreId | undefined;
  private _name: string;
  private _description: string | undefined;
  private readonly _productType: JewelryType;
  private _status: ProductStatus;
  private _audit: AuditMetadata;

  private constructor(
    id: ProductId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    name: string,
    description: string | undefined,
    productType: JewelryType,
    status: ProductStatus,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._storeId = storeId;
    this._name = name;
    this._description = description;
    this._productType = productType;
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

  get description(): string | undefined {
    return this._description;
  }

  get productType(): JewelryType {
    return this._productType;
  }

  get status(): ProductStatus {
    return this._status;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateProductProps): Result<Product, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Product must belong to a valid tenant.'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return err(new ValidationError('Product name cannot be empty.'));
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 255) {
      return err(new ValidationError('Product name must be between 2 and 255 characters.'));
    }

    const productId = createEntityId<ProductId>(
      props.id ?? `prod_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );
    const audit = AuditMetadata.create(props.actor);

    return ok(
      new Product(
        productId,
        props.tenantId,
        props.storeId,
        trimmedName,
        props.description?.trim() || undefined,
        props.productType,
        'DRAFT', // Products start as DRAFT
        audit
      )
    );
  }

  static reconstitute(
    id: ProductId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    name: string,
    description: string | undefined,
    productType: JewelryType,
    status: ProductStatus,
    audit: AuditMetadata
  ): Product {
    return new Product(id, tenantId, storeId, name, description, productType, status, audit);
  }

  /**
   * Transition: DRAFT -> ACTIVE
   */
  publish(actor?: ActorReference): Result<void, BusinessRuleViolationError> {
    if (this._status === 'ACTIVE') {
      return ok(undefined);
    }
    if (this._status === 'ARCHIVED') {
      return err(
        new BusinessRuleViolationError('Cannot publish an ARCHIVED product directly. Reactivate to DRAFT first.')
      );
    }
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  /**
   * Transition: ACTIVE | DRAFT -> ARCHIVED
   */
  archive(actor?: ActorReference): Result<void, BusinessRuleViolationError> {
    if (this._status === 'ARCHIVED') {
      return ok(undefined);
    }
    this._status = 'ARCHIVED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  /**
   * Transition: ARCHIVED -> DRAFT
   */
  reactivate(actor?: ActorReference): Result<void, BusinessRuleViolationError> {
    if (this._status !== 'ARCHIVED') {
      return err(new BusinessRuleViolationError(`Product is already ${this._status}.`));
    }
    this._status = 'DRAFT';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updateDetails(
    params: { name?: string; description?: string },
    actor?: ActorReference
  ): Result<void, ValidationError> {
    if (params.name !== undefined) {
      const trimmed = params.name.trim();
      if (trimmed.length < 2 || trimmed.length > 255) {
        return err(new ValidationError('Product name must be between 2 and 255 characters.'));
      }
      this._name = trimmed;
    }
    if (params.description !== undefined) {
      this._description = params.description.trim() || undefined;
    }
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  toDto(): ProductDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      storeId: this._storeId,
      name: this._name,
      description: this._description,
      productType: this._productType,
      status: this._status,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
      createdByActorId: this._audit.createdBy?.actorId,
      updatedByActorId: this._audit.updatedBy?.actorId,
    };
  }
}
