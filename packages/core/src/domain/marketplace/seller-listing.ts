import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { generateId } from '../../common/id-generator.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { ProductId } from '../catalog/product.js';
import type { ProductVariantId } from '../catalog/product-variant.js';
import type { SellerProfileId } from './seller-profile.js';
import type { SellerStatus } from './seller-status.js';
import {
  ListingStateMachine,
  type ListingStatus,
  type ListingVisibility,
} from './listing-status.js';
import {
  InvalidListingStateError,
  SellerSuspendedError,
} from './seller-errors.js';

export type SellerListingId = EntityId<'SellerListing'>;

export interface CreateSellerListingProps {
  id?: string | undefined;
  tenantId: TenantId;
  sellerProfileId: SellerProfileId;
  productId: ProductId;
  productVariantId: ProductVariantId;
  title: string;
  slug?: string | undefined;
  description?: string | undefined;
  initialStatus?: ListingStatus | undefined;
  visibility?: ListingVisibility | undefined;
  tags?: string[] | undefined;
  sellerStatus?: SellerStatus | undefined;
  actor?: ActorReference | undefined;
}

export interface SellerListingDto {
  id: string;
  tenantId: string;
  sellerProfileId: string;
  productId: string;
  productVariantId: string;
  title: string;
  slug: string;
  description?: string | undefined;
  status: ListingStatus;
  visibility: ListingVisibility;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicListingDto {
  id: string;
  sellerProfileId: string;
  productId: string;
  productVariantId: string;
  title: string;
  slug: string;
  description?: string | undefined;
  tags: string[];
}

/**
 * SellerListing Domain Entity.
 * Represents a commercial listing published by a Seller for a specific ProductVariant on the marketplace.
 * Crucial Invariant: Strictly decoupled from physical inventory items; links Seller to Catalog ProductVariant.
 */
export class SellerListing extends Entity<SellerListingId> {
  private readonly _tenantId: TenantId;
  private readonly _sellerProfileId: SellerProfileId;
  private readonly _productId: ProductId;
  private readonly _productVariantId: ProductVariantId;
  private _title: string;
  private _slug: string;
  private _description: string | undefined;
  private _status: ListingStatus;
  private _visibility: ListingVisibility;
  private _tags: string[];
  private _audit: AuditMetadata;

  private constructor(
    id: SellerListingId,
    tenantId: TenantId,
    sellerProfileId: SellerProfileId,
    productId: ProductId,
    productVariantId: ProductVariantId,
    title: string,
    slug: string,
    description: string | undefined,
    status: ListingStatus,
    visibility: ListingVisibility,
    tags: string[],
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._sellerProfileId = sellerProfileId;
    this._productId = productId;
    this._productVariantId = productVariantId;
    this._title = title;
    this._slug = slug;
    this._description = description;
    this._status = status;
    this._visibility = visibility;
    this._tags = tags;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get sellerProfileId(): SellerProfileId {
    return this._sellerProfileId;
  }

  get productId(): ProductId {
    return this._productId;
  }

  get productVariantId(): ProductVariantId {
    return this._productVariantId;
  }

  get title(): string {
    return this._title;
  }

  get slug(): string {
    return this._slug;
  }

  get description(): string | undefined {
    return this._description;
  }

  get status(): ListingStatus {
    return this._status;
  }

  get visibility(): ListingVisibility {
    return this._visibility;
  }

  get tags(): readonly string[] {
    return this._tags;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  get isPubliclyVisible(): boolean {
    return this._status === 'ACTIVE' && this._visibility === 'PUBLIC';
  }

  static create(
    props: CreateSellerListingProps
  ): Result<SellerListing, ValidationError | SellerSuspendedError | InvalidListingStateError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('SellerListing must belong to a valid tenantId.'));
    }
    if (!props.sellerProfileId || props.sellerProfileId.trim().length === 0) {
      return err(new ValidationError('SellerListing must reference a valid sellerProfileId.'));
    }
    if (!props.productId || props.productId.trim().length === 0) {
      return err(new ValidationError('SellerListing must reference a valid productId.'));
    }
    if (!props.productVariantId || props.productVariantId.trim().length === 0) {
      return err(new ValidationError('SellerListing must reference a valid productVariantId.'));
    }
    if (!props.title || props.title.trim().length < 3) {
      return err(new ValidationError('Listing title must have at least 3 characters.'));
    }
    if (props.title.trim().length > 255) {
      return err(new ValidationError('Listing title cannot exceed 255 characters.'));
    }

    const trimmedTitle = props.title.trim();
    const rawSlug = props.slug?.trim() || trimmedTitle;
    const normalizedSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150);

    if (normalizedSlug.length < 2) {
      return err(new ValidationError('Generated listing slug is too short or invalid.'));
    }

    const initialStatus = props.initialStatus ?? 'DRAFT';

    // Invariant: Cannot create directly as ACTIVE if seller is suspended or not active
    if (initialStatus === 'ACTIVE') {
      if (props.sellerStatus === 'SUSPENDED') {
        return err(new SellerSuspendedError('Cannot create an active listing for a suspended seller.'));
      }
      if (props.sellerStatus !== 'ACTIVE') {
        return err(
          new InvalidListingStateError(
            `Cannot activate listing. Seller profile must be "ACTIVE", currently "${props.sellerStatus ?? 'UNKNOWN'}".`
          )
        );
      }
    }

    const id = createEntityId<SellerListingId>(props.id ?? generateId('list'));
    const audit = AuditMetadata.create(props.actor ?? ActorReference.system());
    const visibility = props.visibility ?? 'PUBLIC';
    const cleanTags = (props.tags ?? []).map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);

    return ok(
      new SellerListing(
        id,
        props.tenantId,
        props.sellerProfileId,
        props.productId,
        props.productVariantId,
        trimmedTitle,
        normalizedSlug,
        props.description?.trim() || undefined,
        initialStatus,
        visibility,
        cleanTags,
        audit
      )
    );
  }

  static reconstitute(
    id: SellerListingId,
    tenantId: TenantId,
    sellerProfileId: SellerProfileId,
    productId: ProductId,
    productVariantId: ProductVariantId,
    title: string,
    slug: string,
    description: string | undefined,
    status: ListingStatus,
    visibility: ListingVisibility,
    tags: string[],
    audit: AuditMetadata
  ): SellerListing {
    return new SellerListing(
      id,
      tenantId,
      sellerProfileId,
      productId,
      productVariantId,
      title,
      slug,
      description,
      status,
      visibility,
      tags,
      audit
    );
  }

  activate(
    sellerStatus: SellerStatus,
    actor?: ActorReference
  ): Result<void, InvalidListingStateError | SellerSuspendedError> {
    if (sellerStatus === 'SUSPENDED') {
      return err(new SellerSuspendedError('Cannot activate listing because seller profile is suspended.'));
    }
    if (sellerStatus !== 'ACTIVE') {
      return err(
        new InvalidListingStateError(
          `Cannot activate listing because seller profile is not active (current status: "${sellerStatus}").`
        )
      );
    }

    const val = ListingStateMachine.validateTransition(this._status, 'ACTIVE');
    if (val.isErr) return err(val.error);

    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  pause(actor?: ActorReference, _reason?: string): Result<void, InvalidListingStateError> {
    const val = ListingStateMachine.validateTransition(this._status, 'PAUSED');
    if (val.isErr) return err(val.error);

    this._status = 'PAUSED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  resume(
    sellerStatus: SellerStatus,
    actor?: ActorReference
  ): Result<void, InvalidListingStateError | SellerSuspendedError> {
    return this.activate(sellerStatus, actor);
  }

  archive(actor?: ActorReference, _reason?: string): Result<void, InvalidListingStateError> {
    const val = ListingStateMachine.validateTransition(this._status, 'ARCHIVED');
    if (val.isErr) return err(val.error);

    this._status = 'ARCHIVED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updateDisplay(
    title: string,
    description?: string | undefined,
    tags?: string[] | undefined,
    visibility?: ListingVisibility | undefined,
    actor?: ActorReference
  ): Result<void, ValidationError> {
    if (!title || title.trim().length < 3) {
      return err(new ValidationError('Listing title must have at least 3 characters.'));
    }
    if (title.trim().length > 255) {
      return err(new ValidationError('Listing title cannot exceed 255 characters.'));
    }

    this._title = title.trim();
    if (description !== undefined) {
      this._description = description.trim() || undefined;
    }
    if (tags !== undefined) {
      this._tags = tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0);
    }
    if (visibility !== undefined) {
      this._visibility = visibility;
    }
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  toDto(): SellerListingDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      sellerProfileId: this._sellerProfileId,
      productId: this._productId,
      productVariantId: this._productVariantId,
      title: this._title,
      slug: this._slug,
      description: this._description,
      status: this._status,
      visibility: this._visibility,
      tags: [...this._tags],
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }

  toPublicDto(): PublicListingDto {
    return {
      id: this.id,
      sellerProfileId: this._sellerProfileId,
      productId: this._productId,
      productVariantId: this._productVariantId,
      title: this._title,
      slug: this._slug,
      description: this._description,
      tags: [...this._tags],
    };
  }
}
