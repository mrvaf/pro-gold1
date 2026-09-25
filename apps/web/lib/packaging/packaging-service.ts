import {
  type PackagingRepositoryPort,
  PackagingSpecification,
  PackagingSpecificationNotFoundError,
  createEntityId,
  type PackagingSpecId,
  type TenantId,
  type ProductId,
  type BoxMaterial,
  type LuxuryTier,
  type DielineSpecification,
  Result,
} from '@v-gold/core';

export interface CreatePackagingDto {
  tenantId: string;
  productId?: string;
  name: string;
  dimensions: {
    widthMm: number;
    lengthMm: number;
    heightMm: number;
  };
  material: BoxMaterial;
  tier: LuxuryTier;
  primaryColorHex: string;
  accentColorHex?: string;
  hasCustomDieline?: boolean;
  hasFoilEmbossing?: boolean;
  dieline?: DielineSpecification;
  currency?: 'USD' | 'EUR' | 'IRR' | 'TOMAN';
}

export class PackagingService {
  constructor(private readonly packagingRepo: PackagingRepositoryPort) {}

  async createSpecification(dto: CreatePackagingDto): Promise<PackagingSpecification> {
    const specId = createEntityId<PackagingSpecId>(`pkg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const specResult = PackagingSpecification.create(specId, {
      tenantId: createEntityId<TenantId>(dto.tenantId),
      productId: dto.productId ? createEntityId<ProductId>(dto.productId) : undefined,
      name: dto.name,
      dimensions: dto.dimensions,
      material: dto.material,
      tier: dto.tier,
      primaryColorHex: dto.primaryColorHex,
      accentColorHex: dto.accentColorHex,
      hasCustomDieline: dto.hasCustomDieline,
      hasFoilEmbossing: dto.hasFoilEmbossing,
      dieline: dto.dieline,
      currency: dto.currency,
    });

    if (specResult.isErr) {
      throw specResult.error;
    }

    const spec = specResult.value;
    await this.packagingRepo.save(spec);
    return spec;
  }

  async getSpecificationById(id: string, tenantId: string): Promise<PackagingSpecification> {
    const spec = await this.packagingRepo.findById(
      createEntityId<PackagingSpecId>(id),
      createEntityId<TenantId>(tenantId)
    );
    if (!spec) {
      throw new PackagingSpecificationNotFoundError(id);
    }
    return spec;
  }

  async listSpecifications(tenantId: string): Promise<PackagingSpecification[]> {
    return this.packagingRepo.findByTenantId(createEntityId<TenantId>(tenantId));
  }

  async listByProduct(productId: string, tenantId: string): Promise<PackagingSpecification[]> {
    return this.packagingRepo.findByProductId(productId, createEntityId<TenantId>(tenantId));
  }

  async generateAiPreview(
    id: string,
    tenantId: string,
    previewImageUrl?: string
  ): Promise<PackagingSpecification> {
    const spec = await this.getSpecificationById(id, tenantId);
    
    // In dev / test / production-fallback, construct realistic preview image URL
    const url =
      previewImageUrl ||
      `https://cdn.v-gold.internal/packaging/${tenantId}/${id}/preview-${spec.material.toLowerCase()}-${spec.primaryColorHex.replace('#', '')}.png`;

    spec.setAiPreviewImageUrl(url);
    await this.packagingRepo.save(spec);
    return spec;
  }
}
