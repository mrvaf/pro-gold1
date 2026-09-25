import {
  type TenantId,
  type ProductId,
  type ProductVariantId,
  createEntityId,
  type Result,
  ok,
  err,
  DomainError,
  Studio3DAsset,
  type Studio3DAssetId,
  type Studio3DAssetRepositoryPort,
  type Studio3DStoragePort,
  BoundingBox3D,
  PbrMaterialMap,
  Studio3DAssetNotFoundError,
} from '@v-gold/core';

export interface RegisterStudio3DAssetCommand {
  tenantId: TenantId;
  productId: ProductId;
  variantId?: ProductVariantId | undefined;
  format: 'GLB' | 'GLTF';
  mimeType: string;
  fileSizeBytes: number;
  storageKey: string;
  boundingBox: {
    widthMeters: number;
    heightMeters: number;
    depthMeters: number;
  };
  material: {
    metalnessFactor: number;
    roughnessFactor: number;
    baseColorHex: string;
    normalMapUrl?: string | undefined;
    occlusionMapUrl?: string | undefined;
    emissiveHex?: string | undefined;
  };
  lodLevels?: number | undefined;
}

export interface GetStudioPreviewResult {
  asset: ReturnType<Studio3DAsset['toDto']>;
  downloadUrl: string;
}

export class Studio3DService {
  constructor(
    private readonly assetRepo: Studio3DAssetRepositoryPort,
    private readonly storage: Studio3DStoragePort
  ) {}

  async registerAsset(
    cmd: RegisterStudio3DAssetCommand
  ): Promise<Result<Studio3DAsset, DomainError>> {
    const bboxRes = BoundingBox3D.create(cmd.boundingBox);
    if (bboxRes.isErr) {
      return err(bboxRes.error);
    }

    const material = PbrMaterialMap.create(cmd.material);
    const assetId = createEntityId<Studio3DAssetId>(`asset_3d_${Date.now()}`);

    const assetRes = Studio3DAsset.create(assetId, {
      tenantId: cmd.tenantId,
      productId: cmd.productId,
      variantId: cmd.variantId,
      format: cmd.format,
      mimeType: cmd.mimeType,
      fileSizeBytes: cmd.fileSizeBytes,
      storageKey: cmd.storageKey,
      boundingBox: bboxRes.value,
      material,
      lodLevels: cmd.lodLevels,
    });

    if (assetRes.isErr) {
      return err(assetRes.error);
    }

    await this.assetRepo.save(assetRes.value);
    return ok(assetRes.value);
  }

  async getPreview(
    id: Studio3DAssetId,
    tenantId: TenantId
  ): Promise<Result<GetStudioPreviewResult, DomainError>> {
    const asset = await this.assetRepo.findById(id, tenantId);
    if (!asset) {
      return err(new Studio3DAssetNotFoundError(id));
    }

    const downloadUrl = await this.storage.generateSignedDownloadUrl(asset.storageKey, {
      expiresInSeconds: 900, // 15 min signed URL
    });

    return ok({
      asset: asset.toDto(),
      downloadUrl,
    });
  }

  async listByProduct(
    productId: ProductId,
    tenantId: TenantId
  ): Promise<Result<GetStudioPreviewResult[], DomainError>> {
    const assets = await this.assetRepo.findByProduct(productId, tenantId);
    const previews: GetStudioPreviewResult[] = [];

    for (const asset of assets) {
      const downloadUrl = await this.storage.generateSignedDownloadUrl(asset.storageKey, {
        expiresInSeconds: 900,
      });
      previews.push({
        asset: asset.toDto(),
        downloadUrl,
      });
    }

    return ok(previews);
  }
}
