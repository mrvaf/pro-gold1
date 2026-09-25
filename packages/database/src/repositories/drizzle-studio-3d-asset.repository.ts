import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type Studio3DAssetRepositoryPort,
  Studio3DAsset,
  type Studio3DAssetId,
  type TenantId,
  type ProductId,
  BoundingBox3D,
  PbrMaterialMap,
  createEntityId,
} from '@v-gold/core';
import {
  studio3dAssetsTable,
  type InsertStudio3DAssetRecord,
} from '../schema/studio-3d-assets.js';

export class DrizzleStudio3DAssetRepository implements Studio3DAssetRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async save(asset: Studio3DAsset): Promise<void> {
    const record: InsertStudio3DAssetRecord = {
      id: asset.id,
      tenantId: asset.tenantId,
      productId: asset.productId,
      variantId: asset.variantId ?? null,
      format: asset.format,
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      storageKey: asset.storageKey,
      boundingBoxJson: JSON.stringify(asset.boundingBox.toDto()),
      materialJson: JSON.stringify(asset.material.toDto()),
      lodLevels: asset.lodLevels ?? 1,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };

    await this.db
      .insert(studio3dAssetsTable)
      .values(record)
      .onConflictDoUpdate({
        target: studio3dAssetsTable.id,
        set: {
          variantId: record.variantId,
          format: record.format,
          mimeType: record.mimeType,
          fileSizeBytes: record.fileSizeBytes,
          storageKey: record.storageKey,
          boundingBoxJson: record.boundingBoxJson,
          materialJson: record.materialJson,
          lodLevels: record.lodLevels,
          updatedAt: new Date(),
        },
      });
  }

  async findById(id: Studio3DAssetId, tenantId?: TenantId): Promise<Studio3DAsset | null> {
    const conditions = [eq(studio3dAssetsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(studio3dAssetsTable.tenantId, tenantId));
    }

    const rows = await this.db
      .select()
      .from(studio3dAssetsTable)
      .where(and(...conditions))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return this.mapToDomain(row);
  }

  async findByProduct(productId: ProductId, tenantId: TenantId): Promise<Studio3DAsset[]> {
    const rows = await this.db
      .select()
      .from(studio3dAssetsTable)
      .where(
        and(
          eq(studio3dAssetsTable.productId, productId),
          eq(studio3dAssetsTable.tenantId, tenantId)
        )
      );

    return rows.map((r) => this.mapToDomain(r));
  }

  async delete(id: Studio3DAssetId, tenantId?: TenantId): Promise<void> {
    const conditions = [eq(studio3dAssetsTable.id, id)];
    if (tenantId) {
      conditions.push(eq(studio3dAssetsTable.tenantId, tenantId));
    }
    await this.db.delete(studio3dAssetsTable).where(and(...conditions));
  }

  async count(tenantId?: TenantId): Promise<number> {
    const rows = tenantId
      ? await this.db
          .select()
          .from(studio3dAssetsTable)
          .where(eq(studio3dAssetsTable.tenantId, tenantId))
      : await this.db.select().from(studio3dAssetsTable);
    return rows.length;
  }

  private mapToDomain(row: typeof studio3dAssetsTable.$inferSelect): Studio3DAsset {
    const bboxData = JSON.parse(row.boundingBoxJson);
    const materialData = JSON.parse(row.materialJson);

    return Studio3DAsset.reconstitute(createEntityId<Studio3DAssetId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      productId: createEntityId<ProductId>(row.productId),
      variantId: row.variantId ? createEntityId<any>(row.variantId) : undefined,
      format: row.format as any,
      mimeType: row.mimeType as any,
      fileSizeBytes: row.fileSizeBytes,
      storageKey: row.storageKey,
      boundingBox: BoundingBox3D.create(bboxData).unwrap(),
      material: PbrMaterialMap.create(materialData),
      lodLevels: row.lodLevels,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
