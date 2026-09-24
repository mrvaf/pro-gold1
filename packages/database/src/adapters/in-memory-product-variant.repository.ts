import type {
  ProductVariantRepositoryPort,
  ProductVariantListFilter,
  ProductVariant,
  ProductVariantId,
  ProductId,
  SKU,
  TenantId,
} from '@v-gold/core';

export class InMemoryProductVariantRepository implements ProductVariantRepositoryPort {
  private readonly variants = new Map<string, ProductVariant>();

  async save(variant: ProductVariant): Promise<void> {
    this.variants.set(variant.id, variant);
  }

  async findById(id: ProductVariantId, tenantId?: TenantId): Promise<ProductVariant | null> {
    const variant = this.variants.get(id);
    if (!variant) return null;

    if (tenantId !== undefined && variant.tenantId !== tenantId) {
      return null;
    }

    return variant;
  }

  async findBySku(sku: SKU | string, tenantId: TenantId): Promise<ProductVariant | null> {
    const skuStr = typeof sku === 'string' ? sku : sku.value;
    for (const v of this.variants.values()) {
      if (v.tenantId === tenantId && v.sku.value === skuStr) {
        return v;
      }
    }
    return null;
  }

  async listByProductId(productId: ProductId, tenantId: TenantId): Promise<ProductVariant[]> {
    return Array.from(this.variants.values()).filter(
      (v) => v.productId === productId && v.tenantId === tenantId
    );
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: ProductVariantListFilter
  ): Promise<ProductVariant[]> {
    let result = Array.from(this.variants.values()).filter((v) => v.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((v) => v.status === filter.status);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.variants.size;
    return Array.from(this.variants.values()).filter((v) => v.tenantId === tenantId).length;
  }

  clear(): void {
    this.variants.clear();
  }
}
