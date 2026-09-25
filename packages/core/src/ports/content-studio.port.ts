import { ContentAsset, type ContentAssetId } from '../domain/content-studio/content-asset.js';
import { type TenantId } from '../domain/tenant/tenant.js';

export interface ContentStudioRepositoryPort {
  save(asset: ContentAsset): Promise<void>;
  findById(id: ContentAssetId, tenantId: TenantId): Promise<ContentAsset | null>;
  findByProductId(productId: string, tenantId: TenantId): Promise<ContentAsset[]>;
  findByTenantId(tenantId: TenantId): Promise<ContentAsset[]>;
  delete(id: ContentAssetId, tenantId: TenantId): Promise<boolean>;
}
