import { Entity } from '../../common/entity.js';
import type { EntityId } from '../../common/id.js';
import { ok, err, type Result } from '../../common/result.js';
import type { TenantId } from '../tenant/tenant.js';
import type { ProductId } from '../catalog/product.js';
import type { ProductVariantId } from '../catalog/product-variant.js';
import {
  Invalid3DAssetTypeError,
  Oversized3DAssetError,
} from './studio-3d-errors.js';
import type { BoundingBox3D } from './bounding-box-3d.js';
import type { PbrMaterialMap } from './pbr-material-map.js';

export type Studio3DAssetId = EntityId<'Studio3DAsset'>;

export const ALLOWED_3D_MIME_TYPES = [
  'model/gltf-binary', // .glb
  'model/gltf+json',   // .gltf
] as const;

export type Allowed3DAssetMimeType = (typeof ALLOWED_3D_MIME_TYPES)[number];

export const MAX_3D_ASSET_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export interface Studio3DAssetProps {
  readonly tenantId: TenantId;
  readonly productId: ProductId;
  readonly variantId?: ProductVariantId | undefined;
  readonly format: 'GLB' | 'GLTF';
  readonly mimeType: Allowed3DAssetMimeType;
  readonly fileSizeBytes: number;
  readonly storageKey: string;
  readonly boundingBox: BoundingBox3D;
  readonly material: PbrMaterialMap;
  readonly lodLevels?: number | undefined; // e.g. 1, 2, 3
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateStudio3DAssetInput {
  readonly tenantId: TenantId;
  readonly productId: ProductId;
  readonly variantId?: ProductVariantId | undefined;
  readonly format: 'GLB' | 'GLTF';
  readonly mimeType: string;
  readonly fileSizeBytes: number;
  readonly storageKey: string;
  readonly boundingBox: BoundingBox3D;
  readonly material: PbrMaterialMap;
  readonly lodLevels?: number | undefined;
}

export class Studio3DAsset extends Entity<Studio3DAssetId> {
  private readonly _props: Studio3DAssetProps;

  private constructor(id: Studio3DAssetId, props: Studio3DAssetProps) {
    super(id);
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

  get format(): 'GLB' | 'GLTF' {
    return this._props.format;
  }

  get mimeType(): Allowed3DAssetMimeType {
    return this._props.mimeType;
  }

  get fileSizeBytes(): number {
    return this._props.fileSizeBytes;
  }

  get storageKey(): string {
    return this._props.storageKey;
  }

  get boundingBox(): BoundingBox3D {
    return this._props.boundingBox;
  }

  get material(): PbrMaterialMap {
    return this._props.material;
  }

  get lodLevels(): number | undefined {
    return this._props.lodLevels;
  }

  get createdAt(): Date {
    return this._props.createdAt;
  }

  get updatedAt(): Date {
    return this._props.updatedAt;
  }

  static create(
    id: Studio3DAssetId,
    input: CreateStudio3DAssetInput
  ): Result<Studio3DAsset, Invalid3DAssetTypeError | Oversized3DAssetError> {
    const normalizedMime = input.mimeType.toLowerCase().trim();
    if (!ALLOWED_3D_MIME_TYPES.includes(normalizedMime as Allowed3DAssetMimeType)) {
      return err(
        new Invalid3DAssetTypeError(normalizedMime, [...ALLOWED_3D_MIME_TYPES])
      );
    }

    if (input.fileSizeBytes <= 0 || input.fileSizeBytes > MAX_3D_ASSET_SIZE_BYTES) {
      return err(
        new Oversized3DAssetError(input.fileSizeBytes, MAX_3D_ASSET_SIZE_BYTES)
      );
    }

    const now = new Date();
    return ok(
      new Studio3DAsset(id, {
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantId,
        format: input.format,
        mimeType: normalizedMime as Allowed3DAssetMimeType,
        fileSizeBytes: input.fileSizeBytes,
        storageKey: input.storageKey,
        boundingBox: input.boundingBox,
        material: input.material,
        lodLevels: input.lodLevels ?? 1,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  static reconstitute(id: Studio3DAssetId, props: Studio3DAssetProps): Studio3DAsset {
    return new Studio3DAsset(id, props);
  }

  toDto(): {
    id: string;
    tenantId: string;
    productId: string;
    variantId?: string | undefined;
    format: string;
    mimeType: string;
    fileSizeBytes: number;
    storageKey: string;
    boundingBox: ReturnType<BoundingBox3D['toDto']>;
    material: ReturnType<PbrMaterialMap['toDto']>;
    lodLevels?: number | undefined;
    createdAt: string;
    updatedAt: string;
  } {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      variantId: this.variantId,
      format: this.format,
      mimeType: this.mimeType,
      fileSizeBytes: this.fileSizeBytes,
      storageKey: this.storageKey,
      boundingBox: this.boundingBox.toDto(),
      material: this.material.toDto(),
      lodLevels: this.lodLevels,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
