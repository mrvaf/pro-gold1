import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError, BusinessRuleViolationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import type { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { ProductId } from './product.js';
import type { SKU } from './sku.js';
import type { JewelrySpecification, JewelrySpecificationDto } from './jewelry-specification.js';
import type { PricingRuleId } from '../pricing/pricing-rule.js';

export type ProductVariantId = EntityId<'ProductVariant'>;
export type ProductVariantStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface CreateProductVariantProps {
  id?: string | undefined;
  productId: ProductId;
  tenantId: TenantId;
  sku: SKU;
  name: string;
  specification: JewelrySpecification;
  pricingRuleId?: PricingRuleId | undefined;
  actor?: ActorReference | undefined;
}

export interface ProductVariantDto {
  id: string;
  productId: string;
  tenantId: string;
  sku: string;
  name: string;
  status: ProductVariantStatus;
  specification: JewelrySpecificationDto;
  pricingRuleId?: string | undefined;
  createdAt: string;
  updatedAt: string;
  createdByActorId?: string | undefined;
  updatedByActorId?: string | undefined;
}

/**
 * Product Variant Entity.
 * Represents a distinct physical/specification variant of a parent Product.
 * Holds its own tenant-scoped immutable SKU and JewelrySpecification.
 * Does NOT perform price calculations; references Stage 5 pricing rules by ID only.
 */
export class ProductVariant extends Entity<ProductVariantId> {
  private readonly _productId: ProductId;
  private readonly _tenantId: TenantId;
  private readonly _sku: SKU;
  private _name: string;
  private _status: ProductVariantStatus;
  private _specification: JewelrySpecification;
  private _pricingRuleId: PricingRuleId | undefined;
  private _audit: AuditMetadata;

  private constructor(
    id: ProductVariantId,
    productId: ProductId,
    tenantId: TenantId,
    sku: SKU,
    name: string,
    status: ProductVariantStatus,
    specification: JewelrySpecification,
    pricingRuleId: PricingRuleId | undefined,
    audit: AuditMetadata
  ) {
    super(id);
    this._productId = productId;
    this._tenantId = tenantId;
    this._sku = sku;
    this._name = name;
    this._status = status;
    this._specification = specification;
    this._pricingRuleId = pricingRuleId;
    this._audit = audit;
  }

  get productId(): ProductId {
    return this._productId;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get sku(): SKU {
    return this._sku;
  }

  get name(): string {
    return this._name;
  }

  get status(): ProductVariantStatus {
    return this._status;
  }

  get specification(): JewelrySpecification {
    return this._specification;
  }

  get pricingRuleId(): PricingRuleId | undefined {
    return this._pricingRuleId;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  static create(props: CreateProductVariantProps): Result<ProductVariant, ValidationError> {
    if (!props.productId || props.productId.trim().length === 0) {
      return err(new ValidationError('Product variant must reference a valid productId.'));
    }

    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('Product variant must belong to a valid tenant.'));
    }

    if (!props.sku) {
      return err(new ValidationError('Product variant must have a valid SKU.'));
    }

    if (!props.name || props.name.trim().length === 0) {
      return err(new ValidationError('Product variant name cannot be empty.'));
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 255) {
      return err(new ValidationError('Product variant name must be between 2 and 255 characters.'));
    }

    const variantId = createEntityId<ProductVariantId>(
      props.id ?? `var_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );
    const audit = AuditMetadata.create(props.actor);

    return ok(
      new ProductVariant(
        variantId,
        props.productId,
        props.tenantId,
        props.sku,
        trimmedName,
        'ACTIVE',
        props.specification,
        props.pricingRuleId,
        audit
      )
    );
  }

  static reconstitute(
    id: ProductVariantId,
    productId: ProductId,
    tenantId: TenantId,
    sku: SKU,
    name: string,
    status: ProductVariantStatus,
    specification: JewelrySpecification,
    pricingRuleId: PricingRuleId | undefined,
    audit: AuditMetadata
  ): ProductVariant {
    return new ProductVariant(
      id,
      productId,
      tenantId,
      sku,
      name,
      status,
      specification,
      pricingRuleId,
      audit
    );
  }

  updatePricingRule(ruleId?: PricingRuleId, actor?: ActorReference): void {
    this._pricingRuleId = ruleId;
    this._audit = this._audit.touch(actor);
  }

  updateSpecification(spec: JewelrySpecification, actor?: ActorReference): void {
    this._specification = spec;
    this._audit = this._audit.touch(actor);
  }

  activate(actor?: ActorReference): void {
    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
  }

  deactivate(actor?: ActorReference): void {
    this._status = 'INACTIVE';
    this._audit = this._audit.touch(actor);
  }

  archive(actor?: ActorReference): void {
    this._status = 'ARCHIVED';
    this._audit = this._audit.touch(actor);
  }

  toDto(): ProductVariantDto {
    return {
      id: this.id,
      productId: this._productId,
      tenantId: this._tenantId,
      sku: this._sku.value,
      name: this._name,
      status: this._status,
      specification: this._specification.toDto(),
      pricingRuleId: this._pricingRuleId,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
      createdByActorId: this._audit.createdBy?.actorId,
      updatedByActorId: this._audit.updatedBy?.actorId,
    };
  }
}
