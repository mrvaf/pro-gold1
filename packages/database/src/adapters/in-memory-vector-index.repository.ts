import {
  type VectorSearchIndexPort,
  type ProductFeatureEmbedding,
  type FeatureVector,
  type TenantId,
  type ProductId,
  type VisualSearchResultItem,
  VisualSearchResultItem as VisualSearchResultItemVO,
} from '@v-gold/core';

export class InMemoryVectorIndexRepository implements VectorSearchIndexPort {
  private readonly items = new Map<string, ProductFeatureEmbedding>();

  async indexProductEmbedding(item: ProductFeatureEmbedding): Promise<void> {
    this.items.set(item.id, {
      ...item,
      metadata: item.metadata ? JSON.parse(JSON.stringify(item.metadata)) : undefined,
    });
  }

  async searchSimilar(
    tenantId: TenantId,
    queryVector: FeatureVector,
    limit = 10,
    minSimilarity = 0.5
  ): Promise<VisualSearchResultItem[]> {
    const scored: Array<{
      productId: ProductId;
      variantId?: any;
      productName: string;
      similarity: number;
      metadata?: any;
    }> = [];

    for (const item of this.items.values()) {
      if (item.tenantId !== tenantId) continue;

      const simRes = queryVector.cosineSimilarity(item.embedding);
      if (simRes.isOk && simRes.value >= minSimilarity) {
        scored.push({
          productId: item.productId,
          variantId: item.variantId,
          productName: (item.metadata?.productName as string) ?? 'Jewelry Item',
          similarity: simRes.value,
          metadata: item.metadata,
        });
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
    for (const [id, item] of this.items.entries()) {
      if (item.productId === productId && item.tenantId === tenantId) {
        this.items.delete(id);
      }
    }
  }

  clear(): void {
    this.items.clear();
  }
}
