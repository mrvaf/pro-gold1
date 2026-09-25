import type {
  Studio3DAsset,
  Studio3DAssetId,
  Studio3DAssetRepositoryPort,
  TenantId,
  ProductId,
} from '@v-gold/core';

export class InMemoryStudio3DAssetRepository implements Studio3DAssetRepositoryPort {
  private readonly assets = new Map<string, Studio3DAsset>();

  async save(asset: Studio3DAsset): Promise<void> {
    this.assets.set(asset.id, asset);
  }

  async findById(id: Studio3DAssetId, tenantId?: TenantId): Promise<Studio3DAsset | null> {
    const asset = this.assets.get(id);
    if (!asset) return null;
    if (tenantId && asset.tenantId !== tenantId) return null;
    return asset;
  }

  async findByProduct(productId: ProductId, tenantId: TenantId): Promise<Studio3DAsset[]> {
    return Array.from(this.assets.values()).filter(
      (asset) => asset.productId === productId && asset.tenantId === tenantId
    );
  }

  async delete(id: Studio3DAssetId, tenantId?: TenantId): Promise<void> {
    const asset = this.assets.get(id);
    if (asset) {
      if (tenantId && asset.tenantId !== tenantId) return;
      this.assets.delete(id);
    }
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.assets.size;
    return Array.from(this.assets.values()).filter((a) => a.tenantId === tenantId).length;
  }

  clear(): void {
    this.assets.clear();
  }
}
