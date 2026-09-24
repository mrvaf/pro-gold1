import { Entity } from '../../common/entity.js';
import { createEntityId, type EntityId } from '../../common/id.js';
import { ValidationError } from '../../common/errors.js';
import { ok, err, type Result } from '../../common/result.js';
import { AuditMetadata } from '../audit/audit-metadata.js';
import { ActorReference } from '../identity/actor-reference.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import { SellerMarketplacePresence, type CreateMarketplacePresenceProps } from './marketplace-presence.js';
import { SellerStateMachine, type SellerStatus } from './seller-status.js';
import type { InvalidSellerStateError } from './seller-errors.js';

export type SellerProfileId = EntityId<'SellerProfile'>;

export interface CreateSellerProfileProps {
  id?: string | undefined;
  tenantId: TenantId;
  storeId?: StoreId | undefined;
  displayName: string;
  slug: string;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible?: boolean | undefined;
  businessRegistrationNumber?: string | undefined;
  taxId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  initialStatus?: SellerStatus | undefined;
  actor?: ActorReference | undefined;
}

export interface SellerProfileDto {
  id: string;
  tenantId: string;
  storeId?: string | undefined;
  displayName: string;
  slug: string;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
  isPubliclyVisible: boolean;
  status: SellerStatus;
  businessRegistrationNumber?: string | undefined;
  taxId?: string | undefined;
  contactEmail?: string | undefined;
  contactPhone?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSellerProfileDto {
  id: string;
  displayName: string;
  slug: string;
  bio?: string | undefined;
  logoUrl?: string | undefined;
  bannerUrl?: string | undefined;
}

/**
 * SellerProfile Domain Entity.
 * Represents a precious metals merchant, goldsmith artisan, or jewelry boutique operating on the marketplace.
 * Crucial Invariant: Strictly bound to a parent Tenant, and optionally linked to a verified Store belonging to that same Tenant.
 */
export class SellerProfile extends Entity<SellerProfileId> {
  private readonly _tenantId: TenantId;
  private _storeId: StoreId | undefined;
  private _presence: SellerMarketplacePresence;
  private _status: SellerStatus;
  private _businessRegistrationNumber: string | undefined;
  private _taxId: string | undefined;
  private _contactEmail: string | undefined;
  private _contactPhone: string | undefined;
  private _metadata: Record<string, unknown> | undefined;
  private _audit: AuditMetadata;

  private constructor(
    id: SellerProfileId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    presence: SellerMarketplacePresence,
    status: SellerStatus,
    businessRegistrationNumber: string | undefined,
    taxId: string | undefined,
    contactEmail: string | undefined,
    contactPhone: string | undefined,
    metadata: Record<string, unknown> | undefined,
    audit: AuditMetadata
  ) {
    super(id);
    this._tenantId = tenantId;
    this._storeId = storeId;
    this._presence = presence;
    this._status = status;
    this._businessRegistrationNumber = businessRegistrationNumber;
    this._taxId = taxId;
    this._contactEmail = contactEmail;
    this._contactPhone = contactPhone;
    this._metadata = metadata;
    this._audit = audit;
  }

  get tenantId(): TenantId {
    return this._tenantId;
  }

  get storeId(): StoreId | undefined {
    return this._storeId;
  }

  get presence(): SellerMarketplacePresence {
    return this._presence;
  }

  get displayName(): string {
    return this._presence.displayName;
  }

  get slug(): string {
    return this._presence.slug.value;
  }

  get status(): SellerStatus {
    return this._status;
  }

  get businessRegistrationNumber(): string | undefined {
    return this._businessRegistrationNumber;
  }

  get taxId(): string | undefined {
    return this._taxId;
  }

  get contactEmail(): string | undefined {
    return this._contactEmail;
  }

  get contactPhone(): string | undefined {
    return this._contactPhone;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get audit(): AuditMetadata {
    return this._audit;
  }

  get isActive(): boolean {
    return this._status === 'ACTIVE';
  }

  static create(props: CreateSellerProfileProps): Result<SellerProfile, ValidationError> {
    if (!props.tenantId || props.tenantId.trim().length === 0) {
      return err(new ValidationError('SellerProfile must belong to a valid tenantId.'));
    }

    const presenceRes = SellerMarketplacePresence.create({
      displayName: props.displayName,
      slug: props.slug,
      bio: props.bio,
      logoUrl: props.logoUrl,
      bannerUrl: props.bannerUrl,
      isPubliclyVisible: props.isPubliclyVisible,
    });

    if (presenceRes.isErr) {
      return err(presenceRes.error);
    }

    const id = createEntityId<SellerProfileId>(props.id ?? `seller_${presenceRes.value.slug.value}`);
    const audit = AuditMetadata.create(props.actor ?? ActorReference.system());
    const initialStatus: SellerStatus = props.initialStatus ?? 'DRAFT';

    return ok(
      new SellerProfile(
        id,
        props.tenantId,
        props.storeId,
        presenceRes.value,
        initialStatus,
        props.businessRegistrationNumber?.trim() || undefined,
        props.taxId?.trim() || undefined,
        props.contactEmail?.trim().toLowerCase() || undefined,
        props.contactPhone?.trim() || undefined,
        props.metadata,
        audit
      )
    );
  }

  static reconstitute(
    id: SellerProfileId,
    tenantId: TenantId,
    storeId: StoreId | undefined,
    presence: SellerMarketplacePresence,
    status: SellerStatus,
    businessRegistrationNumber: string | undefined,
    taxId: string | undefined,
    contactEmail: string | undefined,
    contactPhone: string | undefined,
    metadata: Record<string, unknown> | undefined,
    audit: AuditMetadata
  ): SellerProfile {
    return new SellerProfile(
      id,
      tenantId,
      storeId,
      presence,
      status,
      businessRegistrationNumber,
      taxId,
      contactEmail,
      contactPhone,
      metadata,
      audit
    );
  }

  activate(actor?: ActorReference): Result<void, InvalidSellerStateError> {
    const val = SellerStateMachine.validateTransition(this._status, 'ACTIVE');
    if (val.isErr) return err(val.error);

    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  suspend(actor?: ActorReference, _reason?: string): Result<void, InvalidSellerStateError> {
    const val = SellerStateMachine.validateTransition(this._status, 'SUSPENDED');
    if (val.isErr) return err(val.error);

    this._status = 'SUSPENDED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  reinstate(actor?: ActorReference): Result<void, InvalidSellerStateError> {
    const val = SellerStateMachine.validateTransition(this._status, 'ACTIVE');
    if (val.isErr) return err(val.error);

    this._status = 'ACTIVE';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  archive(actor?: ActorReference, _reason?: string): Result<void, InvalidSellerStateError> {
    const val = SellerStateMachine.validateTransition(this._status, 'ARCHIVED');
    if (val.isErr) return err(val.error);

    this._status = 'ARCHIVED';
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  updatePresence(
    displayName: string,
    bio?: string | undefined,
    logoUrl?: string | undefined,
    bannerUrl?: string | undefined,
    isPubliclyVisible?: boolean | undefined,
    actor?: ActorReference
  ): Result<void, ValidationError> {
    const presenceRes = this._presence.withUpdatedDisplay(
      displayName,
      bio,
      logoUrl,
      bannerUrl,
      isPubliclyVisible
    );
    if (presenceRes.isErr) return err(presenceRes.error);

    this._presence = presenceRes.value;
    this._audit = this._audit.touch(actor);
    return ok(undefined);
  }

  setStoreId(storeId: StoreId | undefined, actor?: ActorReference): void {
    this._storeId = storeId;
    this._audit = this._audit.touch(actor);
  }

  updateContactInfo(
    contact: {
      businessRegistrationNumber?: string | undefined;
      taxId?: string | undefined;
      contactEmail?: string | undefined;
      contactPhone?: string | undefined;
    },
    actor?: ActorReference
  ): void {
    if (contact.businessRegistrationNumber !== undefined) {
      this._businessRegistrationNumber = contact.businessRegistrationNumber.trim() || undefined;
    }
    if (contact.taxId !== undefined) {
      this._taxId = contact.taxId.trim() || undefined;
    }
    if (contact.contactEmail !== undefined) {
      this._contactEmail = contact.contactEmail.trim().toLowerCase() || undefined;
    }
    if (contact.contactPhone !== undefined) {
      this._contactPhone = contact.contactPhone.trim() || undefined;
    }
    this._audit = this._audit.touch(actor);
  }

  toDto(): SellerProfileDto {
    return {
      id: this.id,
      tenantId: this._tenantId,
      storeId: this._storeId,
      displayName: this._presence.displayName,
      slug: this._presence.slug.value,
      bio: this._presence.bio,
      logoUrl: this._presence.logoUrl,
      bannerUrl: this._presence.bannerUrl,
      isPubliclyVisible: this._presence.isPubliclyVisible,
      status: this._status,
      businessRegistrationNumber: this._businessRegistrationNumber,
      taxId: this._taxId,
      contactEmail: this._contactEmail,
      contactPhone: this._contactPhone,
      metadata: this._metadata,
      createdAt: this._audit.createdAt.toISOString(),
      updatedAt: this._audit.updatedAt.toISOString(),
    };
  }

  toPublicDto(): PublicSellerProfileDto {
    return {
      id: this.id,
      displayName: this._presence.displayName,
      slug: this._presence.slug.value,
      bio: this._presence.bio,
      logoUrl: this._presence.logoUrl,
      bannerUrl: this._presence.bannerUrl,
    };
  }
}
