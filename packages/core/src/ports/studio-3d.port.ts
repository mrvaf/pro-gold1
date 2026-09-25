import type { TenantId } from '../domain/tenant/tenant.js';
import type { ProductId } from '../domain/catalog/product.js';
import type { Studio3DAsset, Studio3DAssetId } from '../domain/studio-3d/studio-3d-asset.js';

export interface Studio3DAssetRepositoryPort {
  save(asset: Studio3DAsset): Promise<void>;
  findById(id: Studio3DAssetId, tenantId?: TenantId): Promise<Studio3DAsset | null>;
  findByProduct(productId: ProductId, tenantId: TenantId): Promise<Studio3DAsset[]>;
  delete(id: Studio3DAssetId, tenantId?: TenantId): Promise<void>;
  count(tenantId?: TenantId): Promise<number>;
}

export interface Signed3DAssetUrlOptions {
  expiresInSeconds?: number; // e.g. 900 seconds (15 min)
}

export interface Studio3DStoragePort {
  generateSignedDownloadUrl(storageKey: string, options?: Signed3DAssetUrlOptions): Promise<string>;
  generateSignedUploadUrl(storageKey: string, mimeType: string, options?: Signed3DAssetUrlOptions): Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresAt: Date;
  }>;
  deleteAsset(storageKey: string): Promise<void>;
}
