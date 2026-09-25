import {
  type ContentStudioRepositoryPort,
  ContentAsset,
  createEntityId,
  type ContentAssetId,
  type TenantId,
} from '@v-gold/core';

export class InMemoryContentStudioRepository implements ContentStudioRepositoryPort {
  private readonly items = new Map<string, ContentAsset>();

  private key(id: string, tenantId: string): string {
    return `${tenantId}:${id}`;
  }

  async save(asset: ContentAsset): Promise<void> {
    this.items.set(this.key(asset.id, asset.tenantId), asset);
  }

  async findById(id: ContentAssetId, tenantId: TenantId): Promise<ContentAsset | null> {
    return this.items.get(this.key(id, tenantId)) ?? null;
  }

  async findByProductId(productId: string, tenantId: TenantId): Promise<ContentAsset[]> {
    const list: ContentAsset[] = [];
    for (const a of this.items.values()) {
      if (a.tenantId === tenantId && a.productId === productId) {
        list.push(a);
      }
    }
    return list;
  }

  async findByTenantId(tenantId: TenantId): Promise<ContentAsset[]> {
    const list: ContentAsset[] = [];
    for (const a of this.items.values()) {
      if (a.tenantId === tenantId) {
        list.push(a);
      }
    }
    return list;
  }

  async delete(id: ContentAssetId, tenantId: TenantId): Promise<boolean> {
    return this.items.delete(this.key(id, tenantId));
  }
}
