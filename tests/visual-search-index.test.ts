import { describe, it, expect, beforeEach } from 'vitest';
import {
  FeatureVector,
  createEntityId,
  type TenantId,
  type ProductId,
} from '@v-gold/core';
import { InMemoryVectorIndexRepository } from '@v-gold/database';

describe('Stage 11 InMemoryVectorIndexRepository Tests', () => {
  let repo: InMemoryVectorIndexRepository;
  const tenant1 = createEntityId<TenantId>('tenant-alpha');
  const tenant2 = createEntityId<TenantId>('tenant-beta');

  beforeEach(() => {
    repo = new InMemoryVectorIndexRepository();
  });

  it('indexes product embeddings and retrieves top matches ranked by cosine similarity', async () => {
    const vecTarget = FeatureVector.create([1, 1, 0, 0, 0, 0, 0, 0]).unwrap();
    const vecClose = FeatureVector.create([1, 0.9, 0.1, 0, 0, 0, 0, 0]).unwrap();
    const vecFar = FeatureVector.create([0.2, 0.1, 0, 0, 1, 1, 0, 0]).unwrap();

    await repo.indexProductEmbedding({
      id: 'emb-1',
      tenantId: tenant1,
      productId: createEntityId<ProductId>('prod-close'),
      embedding: vecClose,
      metadata: { productName: 'Close Match Gold Band', jewelryType: 'RING' },
    });

    await repo.indexProductEmbedding({
      id: 'emb-2',
      tenantId: tenant1,
      productId: createEntityId<ProductId>('prod-far'),
      embedding: vecFar,
      metadata: { productName: 'Far Match Necklace', jewelryType: 'NECKLACE' },
    });

    // Query with target vector (minSimilarity = 0.05 to capture both)
    const results = await repo.searchSimilar(tenant1, vecTarget, 10, 0.05);
    expect(results.length).toBe(2);
    expect(results[0]?.productId).toBe('prod-close');
    expect(results[0]?.similarityScore).toBeGreaterThan(results[1]?.similarityScore ?? 0);
    expect(results[0]?.rank).toBe(1);
    expect(results[0]?.matchedAttributes?.jewelryType).toBe('RING');
  });

  it('enforces strict tenant isolation during similarity search', async () => {
    const vec = FeatureVector.create([1, 1, 1, 1, 0, 0, 0, 0]).unwrap();

    await repo.indexProductEmbedding({
      id: 'emb-tenant1',
      tenantId: tenant1,
      productId: createEntityId<ProductId>('prod-tenant1'),
      embedding: vec,
      metadata: { productName: 'Tenant 1 Ring' },
    });

    await repo.indexProductEmbedding({
      id: 'emb-tenant2',
      tenantId: tenant2,
      productId: createEntityId<ProductId>('prod-tenant2'),
      embedding: vec,
      metadata: { productName: 'Tenant 2 Ring' },
    });

    const tenant1Results = await repo.searchSimilar(tenant1, vec, 10, 0.5);
    expect(tenant1Results.length).toBe(1);
    expect(tenant1Results[0]?.productId).toBe('prod-tenant1');

    const tenant2Results = await repo.searchSimilar(tenant2, vec, 10, 0.5);
    expect(tenant2Results.length).toBe(1);
    expect(tenant2Results[0]?.productId).toBe('prod-tenant2');
  });
});
