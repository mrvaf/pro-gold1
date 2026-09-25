import {
  type TenantId,
  type ProductId,
  type ProductVariantId,
  type VectorSearchIndexPort,
  type VisualFeatureExtractorPort,
  type ProductRepositoryPort,
  VisualSearchImage,
  FeatureVector,
  type VisualSearchResultItem,
  type Result,
  ok,
  err,
  DomainError,
  createEntityId,
} from '@v-gold/core';

export interface VisualSearchCommand {
  tenantId: TenantId;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  limit?: number;
  minSimilarity?: number;
}

export interface IndexProductFeaturesCommand {
  tenantId: TenantId;
  productId: ProductId;
  variantId?: ProductVariantId | undefined;
  productName: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
  metadata?: Record<string, unknown> | undefined;
}

export class VisualSearchService {
  constructor(
    private readonly vectorIndex: VectorSearchIndexPort,
    private readonly featureExtractor: VisualFeatureExtractorPort,
    private readonly productRepo?: ProductRepositoryPort
  ) {}

  async searchByImage(
    cmd: VisualSearchCommand
  ): Promise<Result<VisualSearchResultItem[], DomainError>> {
    // 1. Validate image format, path traversal, file size via ValueObject
    const imageRes = VisualSearchImage.create({
      filename: cmd.filename,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.sizeBytes,
      dataBase64: cmd.dataBase64,
    });

    if (imageRes.isErr) {
      return err(imageRes.error);
    }

    // 2. Extract feature embedding vector
    const extractRes = await this.featureExtractor.extractFeatures(imageRes.value);
    if (extractRes.isErr) {
      return err(extractRes.error);
    }

    // 3. Query vector index for top-K matching products within tenant
    const searchResults = await this.vectorIndex.searchSimilar(
      cmd.tenantId,
      extractRes.value,
      cmd.limit ?? 10,
      cmd.minSimilarity ?? 0.5
    );

    return ok(searchResults);
  }

  async indexProductImage(
    cmd: IndexProductFeaturesCommand
  ): Promise<Result<{ embeddingId: string; dimensions: number }, DomainError>> {
    const imageRes = VisualSearchImage.create({
      filename: cmd.filename,
      mimeType: cmd.mimeType,
      sizeBytes: cmd.sizeBytes,
      dataBase64: cmd.dataBase64,
    });

    if (imageRes.isErr) {
      return err(imageRes.error);
    }

    const extractRes = await this.featureExtractor.extractFeatures(imageRes.value);
    if (extractRes.isErr) {
      return err(extractRes.error);
    }

    const embeddingId = `emb_${cmd.productId}_${Date.now()}`;
    await this.vectorIndex.indexProductEmbedding({
      id: embeddingId,
      tenantId: cmd.tenantId,
      productId: cmd.productId,
      variantId: cmd.variantId,
      embedding: extractRes.value,
      metadata: {
        productName: cmd.productName,
        ...cmd.metadata,
      },
    });

    return ok({
      embeddingId,
      dimensions: extractRes.value.dimensions,
    });
  }
}
