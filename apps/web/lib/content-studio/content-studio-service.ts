import {
  type ContentStudioRepositoryPort,
  ContentAsset,
  ContentSpecNotFoundError,
  createEntityId,
  type ContentAssetId,
  type TenantId,
  type ProductId,
  type ContentType,
  type ContentLanguage,
  type GroundingAttributes,
} from '@v-gold/core';

export interface GenerateContentDto {
  tenantId: string;
  productId?: string;
  contentType: ContentType;
  language: ContentLanguage;
  headline: string;
  body: string;
  tags?: string[];
  groundingAttributes: GroundingAttributes;
}

export class ContentStudioService {
  constructor(private readonly contentRepo: ContentStudioRepositoryPort) {}

  async generateAndSaveContent(dto: GenerateContentDto): Promise<ContentAsset> {
    const assetId = createEntityId<ContentAssetId>(`cnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const assetResult = ContentAsset.create(assetId, {
      tenantId: createEntityId<TenantId>(dto.tenantId),
      productId: dto.productId ? createEntityId<ProductId>(dto.productId) : undefined,
      contentType: dto.contentType,
      language: dto.language,
      headline: dto.headline,
      body: dto.body,
      tags: dto.tags,
      groundingAttributes: dto.groundingAttributes,
    });

    if (assetResult.isErr) {
      throw assetResult.error;
    }

    const asset = assetResult.value;
    await this.contentRepo.save(asset);
    return asset;
  }

  async getAssetById(id: string, tenantId: string): Promise<ContentAsset> {
    const asset = await this.contentRepo.findById(
      createEntityId<ContentAssetId>(id),
      createEntityId<TenantId>(tenantId)
    );
    if (!asset) {
      throw new ContentSpecNotFoundError(id);
    }
    return asset;
  }

  async listByTenant(tenantId: string): Promise<ContentAsset[]> {
    return this.contentRepo.findByTenantId(createEntityId<TenantId>(tenantId));
  }

  async listByProduct(productId: string, tenantId: string): Promise<ContentAsset[]> {
    return this.contentRepo.findByProductId(productId, createEntityId<TenantId>(tenantId));
  }
}
