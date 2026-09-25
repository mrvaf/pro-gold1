import type { Result } from '../common/result.js';
import type { AiProviderUnavailableError, DomainError } from '../common/errors.js';
import type { FeatureVector } from '../domain/visual-search/feature-vector.js';
import type { VisualSearchImage } from '../domain/visual-search/visual-search-image.js';
import type { TenantId } from '../domain/tenant/tenant.js';
import type { ProductId } from '../domain/catalog/product.js';
import type { ProductVariantId } from '../domain/catalog/product-variant.js';
import type { VisualSearchResultItem } from '../domain/visual-search/visual-search-result.js';

export interface VisualFeatureExtractorPort {
  extractFeatures(
    image: VisualSearchImage
  ): Promise<Result<FeatureVector, AiProviderUnavailableError | DomainError>>;
}

export interface ProductFeatureEmbedding {
  id: string;
  tenantId: TenantId;
  productId: ProductId;
  variantId?: ProductVariantId | undefined;
  embedding: FeatureVector;
  metadata?: Record<string, unknown> | undefined;
}

export interface VectorSearchIndexPort {
  indexProductEmbedding(item: ProductFeatureEmbedding): Promise<void>;
  searchSimilar(
    tenantId: TenantId,
    queryVector: FeatureVector,
    limit?: number,
    minSimilarity?: number
  ): Promise<VisualSearchResultItem[]>;
  deleteByProduct(productId: ProductId, tenantId: TenantId): Promise<void>;
}
