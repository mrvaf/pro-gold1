import { eq, and } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type ContentStudioRepositoryPort,
  ContentAsset,
  createEntityId,
  type ContentAssetId,
  type TenantId,
  type ProductId,
  type ContentType,
  type ContentLanguage,
  type GroundingAttributes,
} from '@v-gold/core';
import { contentAssetsTable } from '../schema/content-assets.js';

export class DrizzleContentStudioRepository implements ContentStudioRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  private mapToDomain(row: typeof contentAssetsTable.$inferSelect): ContentAsset {
    return new ContentAsset(createEntityId<ContentAssetId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      productId: row.productId ? createEntityId<ProductId>(row.productId) : undefined,
      contentType: row.contentType as ContentType,
      language: row.language as ContentLanguage,
      headline: row.headline,
      body: row.body,
      tags: (row.tags as string[] | null) ?? undefined,
      groundingAttributes: row.groundingAttributes as GroundingAttributes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(asset: ContentAsset): Promise<void> {
    await this.db
      .insert(contentAssetsTable)
      .values({
        id: asset.id,
        tenantId: asset.tenantId,
        productId: asset.productId ?? null,
        contentType: asset.contentType,
        language: asset.language,
        headline: asset.headline,
        body: asset.body,
        tags: asset.tags ? [...asset.tags] : null,
        groundingAttributes: asset.groundingAttributes,
        createdAt: asset.createdAt,
        updatedAt: asset.updatedAt,
      })
      .onConflictDoUpdate({
        target: contentAssetsTable.id,
        set: {
          productId: asset.productId ?? null,
          contentType: asset.contentType,
          language: asset.language,
          headline: asset.headline,
          body: asset.body,
          tags: asset.tags ? [...asset.tags] : null,
          groundingAttributes: asset.groundingAttributes,
          updatedAt: asset.updatedAt,
        },
      });
  }

  async findById(id: ContentAssetId, tenantId: TenantId): Promise<ContentAsset | null> {
    const rows = await this.db
      .select()
      .from(contentAssetsTable)
      .where(and(eq(contentAssetsTable.id, id), eq(contentAssetsTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByProductId(productId: string, tenantId: TenantId): Promise<ContentAsset[]> {
    const rows = await this.db
      .select()
      .from(contentAssetsTable)
      .where(and(eq(contentAssetsTable.productId, productId), eq(contentAssetsTable.tenantId, tenantId)));

    return rows.map((r) => this.mapToDomain(r));
  }

  async findByTenantId(tenantId: TenantId): Promise<ContentAsset[]> {
    const rows = await this.db
      .select()
      .from(contentAssetsTable)
      .where(eq(contentAssetsTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }

  async delete(id: ContentAssetId, tenantId: TenantId): Promise<boolean> {
    const result = await this.db
      .delete(contentAssetsTable)
      .where(and(eq(contentAssetsTable.id, id), eq(contentAssetsTable.tenantId, tenantId)));

    return (result.rowCount ?? 0) > 0;
  }
}
