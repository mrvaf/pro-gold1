import type { Product, ProductId, ProductStatus } from '../domain/catalog/product.js';
import type { JewelryType } from '../domain/catalog/jewelry-specification.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface ProductListFilter {
  status?: ProductStatus | undefined;
  productType?: JewelryType | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ProductRepositoryPort {
  save(product: Product): Promise<void>;
  findById(id: ProductId, tenantId?: TenantId): Promise<Product | null>;
  listByTenant(tenantId: TenantId, filter?: ProductListFilter): Promise<Product[]>;
  count(tenantId?: TenantId): Promise<number>;
}
