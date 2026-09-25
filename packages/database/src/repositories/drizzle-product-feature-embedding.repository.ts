import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type VectorSearchIndexPort,
  type ProductFeatureEmbedding,
  FeatureVector,
  type TenantId,
  type ProductId,
  type VisualSearchResultItem,
  VisualSearchResultItem as VisualSearchResultItemVO,
  createEntityId,
} from '@v-gold/core';
import {
  productFeatureEmbeddingsTable,
  type InsertProductFeatureEmbeddingRecord,
} from '../schema/product-feature-embeddings.js';

export class DrizzleProductFeatureEmbeddingRepository implements VectorSearchIndexPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async indexProductEmbedding(item: ProductFeatureEmbedding): Promise<void> {
    const record: InsertProductFeatureEmbeddingRecord = {
      id: item.id,
      tenantId: item.tenantId,
      productId: item.productId,
      variantId: item.variantId ?? null,
      featureDimensions: item.embedding.dimensions,
      embeddingJson: JSON.stringify(item.embedding.values),
      metadataJson: item.metadata ? JSON.stringify(item.metadata) : null,
    };

    await this.db
      .insert(productFeatureEmbeddingsTable)
      .values(record)
      .onConflictDoUpdate({
        target: productFeatureEmbeddingsTable.id,
        set: {
          variantId: record.variantId,
          featureDimensions: record.featureDimensions,
          embeddingJson: record.embeddingJson,
          metadataJson: record.metadataJson,
          updatedAt: new Date(),
        },
      });
  }

  async searchSimilar(
    tenantId: TenantId,
    queryVector: FeatureVector,
    limit = 10,
    minSimilarity = 0.5
  ): Promise<VisualSearchResultItem[]> {
    const records = await this.db
      .select()
      .from(productFeatureEmbeddingsTable)
      .where(eq(productFeatureEmbeddingsTable.tenantId, tenantId));

    const scored: Array<{
      productId: ProductId;
      variantId?: any;
      productName: string;
      similarity: number;
      metadata?: any;
    }> = [];

    for (const record of records) {
      try {
        const values: number[] = JSON.parse(record.embeddingJson);
        const itemVec = FeatureVector.create(values).unwrapOr(null as any);
        if (!itemVec) continue;

        const simRes = queryVector.cosineSimilarity(itemVec);
        if (simRes.isOk && simRes.value >= minSimilarity) {
          let metadata: any = {};
          if (record.metadataJson) {
            try {
              metadata = JSON.parse(record.metadataJson);
            } catch {
              metadata = {};
            }
          }

          scored.push({
            productId: createEntityId<ProductId>(record.productId),
            variantId: record.variantId ? createEntityId<any>(record.variantId) : undefined,
            productName: (metadata?.productName as string) ?? 'Jewelry Item',
            similarity: simRes.value,
            metadata,
          });
        }
      } catch {
        continue;
      }
    }

    scored.sort((a, b) => b.similarity - a.similarity);

    return scored.slice(0, limit).map((s, index) =>
      VisualSearchResultItemVO.create({
        productId: s.productId,
        variantId: s.variantId,
        productName: s.productName,
        similarityScore: Math.round(s.similarity * 10000) / 10000,
        rank: index + 1,
        matchedAttributes: {
          jewelryType: s.metadata?.jewelryType,
          metalType: s.metadata?.metalType,
          category: s.metadata?.category,
        },
      })
    );
  }

  async deleteByProduct(productId: ProductId, tenantId: TenantId): Promise<void> {
    await this.db
      .delete(productFeatureEmbeddingsTable)
      .where(
        and(
          eq(productFeatureEmbeddingsTable.productId, productId),
          eq(productFeatureEmbeddingsTable.tenantId, tenantId)
        )
      );
  }
}
