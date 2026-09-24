import type {
  ProductRepositoryPort,
  ProductListFilter,
  Product,
  ProductId,
  TenantId,
} from '@v-gold/core';

export class InMemoryProductRepository implements ProductRepositoryPort {
  private readonly products = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    this.products.set(product.id, product);
  }

  async findById(id: ProductId, tenantId?: TenantId): Promise<Product | null> {
    const product = this.products.get(id);
    if (!product) return null;

    if (tenantId !== undefined && product.tenantId !== tenantId) {
      return null; // Tenant isolation
    }

    return product;
  }

  async listByTenant(tenantId: TenantId, filter?: ProductListFilter): Promise<Product[]> {
    let result = Array.from(this.products.values()).filter((p) => p.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((p) => p.status === filter.status);
    }

    if (filter?.productType) {
      result = result.filter((p) => p.productType === filter.productType);
    }

    // Default newest first
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
    if (!tenantId) return this.products.size;
    return Array.from(this.products.values()).filter((p) => p.tenantId === tenantId).length;
  }

  clear(): void {
    this.products.clear();
  }
}
