import { Entity } from '../../common/entity.js';
import type { EntityId } from '../../common/id.js';
import { ok, err, type Result } from '../../common/result.js';
import type { TenantId } from '../tenant/tenant.js';
import type { ProductId } from '../catalog/product.js';
import type { ProductVariantId } from '../catalog/product-variant.js';
import type { Studio3DAssetId } from '../studio-3d/studio-3d-asset.js';
import type { BodyPartAnchoring } from './body-part-anchoring.js';
import { TryOnSessionExpiredError } from './try-on-errors.js';

export type TryOnSessionId = EntityId<'TryOnSession'>;

export type TryOnSessionStatus = 'ACTIVE' | 'EXPIRED' | 'COMPLETED';

export interface TryOnSessionProps {
  readonly tenantId: TenantId;
  readonly productId: ProductId;
  readonly variantId?: ProductVariantId | undefined;
  readonly asset3dId: Studio3DAssetId;
  readonly anchoring: BodyPartAnchoring;
  readonly status: TryOnSessionStatus;
  readonly signedAssetUrl: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTryOnSessionInput {
  readonly tenantId: TenantId;
  readonly productId: ProductId;
  readonly variantId?: ProductVariantId | undefined;
  readonly asset3dId: Studio3DAssetId;
  readonly anchoring: BodyPartAnchoring;
  readonly signedAssetUrl: string;
  readonly durationSeconds?: number | undefined; // default 600s (10 min)
}

export class TryOnSession extends Entity<TryOnSessionId> {
  private _status: TryOnSessionStatus;
  private readonly _props: TryOnSessionProps;

  private constructor(id: TryOnSessionId, props: TryOnSessionProps) {
    super(id);
    this._status = props.status;
    this._props = props;
  }

  get tenantId(): TenantId {
    return this._props.tenantId;
  }

  get productId(): ProductId {
    return this._props.productId;
  }

  get variantId(): ProductVariantId | undefined {
    return this._props.variantId;
  }

  get asset3dId(): Studio3DAssetId {
    return this._props.asset3dId;
  }

  get anchoring(): BodyPartAnchoring {
    return this._props.anchoring;
  }

  get status(): TryOnSessionStatus {
    return this._status;
  }

  get signedAssetUrl(): string {
    return this._props.signedAssetUrl;
  }

  get expiresAt(): Date {
    return this._props.expiresAt;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  static create(
    id: TryOnSessionId,
    input: CreateTryOnSessionInput
  ): TryOnSession {
    const now = new Date();
    const duration = input.durationSeconds ?? 600; // 10 minutes privacy lifecycle
    const expiresAt = new Date(now.getTime() + duration * 1000);

    return new TryOnSession(id, {
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantId,
      asset3dId: input.asset3dId,
      anchoring: input.anchoring,
      status: 'ACTIVE',
      signedAssetUrl: input.signedAssetUrl,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: TryOnSessionId, props: TryOnSessionProps): TryOnSession {
    return new TryOnSession(id, props);
  }

  isExpired(atDate: Date = new Date()): boolean {
    return this._status === 'EXPIRED' || atDate.getTime() > this.expiresAt.getTime();
  }

  verifyActive(atDate: Date = new Date()): Result<void, TryOnSessionExpiredError> {
    if (this.isExpired(atDate)) {
      this._status = 'EXPIRED';
      return err(new TryOnSessionExpiredError(this.id));
    }
    return ok(undefined);
  }

  complete(): void {
    this._status = 'COMPLETED';
  }

  expire(): void {
    this._status = 'EXPIRED';
  }

  toDto(): {
    id: string;
    tenantId: string;
    productId: string;
    variantId?: string | undefined;
    asset3dId: string;
    anchoring: ReturnType<BodyPartAnchoring['toDto']>;
    status: TryOnSessionStatus;
    signedAssetUrl: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      variantId: this.variantId,
      asset3dId: this.asset3dId,
      anchoring: this.anchoring.toDto(),
      status: this._status,
      signedAssetUrl: this.signedAssetUrl,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
