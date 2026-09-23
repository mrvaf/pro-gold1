import type {
  ProductVariant,
  ProductVariantId,
  ProductVariantStatus,
} from '../domain/catalog/product-variant.js';
import type { ProductId } from '../domain/catalog/product.js';
import type { SKU } from '../domain/catalog/sku.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface ProductVariantListFilter {
  status?: ProductVariantStatus | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

export interface ProductVariantRepositoryPort {
  save(variant: ProductVariant): Promise<void>;
  findById(id: ProductVariantId, tenantId?: TenantId): Promise<ProductVariant | null>;
  findBySku(sku: SKU | string, tenantId: TenantId): Promise<ProductVariant | null>;
  listByProductId(productId: ProductId, tenantId: TenantId): Promise<ProductVariant[]>;
  listByTenant(tenantId: TenantId, filter?: ProductVariantListFilter): Promise<ProductVariant[]>;
  count(tenantId?: TenantId): Promise<number>;
}
