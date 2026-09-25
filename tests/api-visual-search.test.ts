import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as searchRoute } from '../apps/web/app/api/v1/catalog/visual-search/route';
import { POST as indexRoute } from '../apps/web/app/api/v1/catalog/products/[id]/features/route';
import {
  setVisualSearchContainer,
  getVisualSearchContainer,
} from '../apps/web/lib/visual-search/visual-search-container';
import { VisualSearchService } from '../apps/web/lib/visual-search/visual-search-service';
import { InMemoryVectorIndexRepository, InMemoryProductRepository } from '@v-gold/database';
import { MockVisualFeatureExtractorAdapter } from '@v-gold/ai-gateway';

describe('Stage 11 Visual Search API Endpoints', () => {
  let vectorRepo: InMemoryVectorIndexRepository;
  let featureExtractor: MockVisualFeatureExtractorAdapter;

  beforeEach(() => {
    vectorRepo = new InMemoryVectorIndexRepository();
    featureExtractor = new MockVisualFeatureExtractorAdapter({ defaultDimensions: 16 });
    const productRepo = new InMemoryProductRepository();
    const service = new VisualSearchService(vectorRepo, featureExtractor, productRepo);

    setVisualSearchContainer({
      vectorIndex: vectorRepo,
      featureExtractor,
      productRepo,
      visualSearchService: service,
    });
  });

  it('indexes product features and searches by image successfully', async () => {
    // 1. Index product features
    const indexReq = new NextRequest('http://localhost:3000/api/v1/catalog/products/p1/features', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productName: '18K Gold Emerald Ring',
        filename: 'emerald-ring.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 45000,
        dataBase64: 'base64sample',
        metadata: {
          jewelryType: 'RING',
          metalType: 'GOLD',
        },
      }),
    });

    const indexRes = await indexRoute(indexReq, { params: Promise.resolve({ id: 'p1' }) });
    expect(indexRes.status).toBe(200);
    const indexData = await indexRes.json();
    expect(indexData.success).toBe(true);
    expect(indexData.embeddingId).toBeDefined();

    // 2. Search using identical/similar image attributes
    const searchReq = new NextRequest('http://localhost:3000/api/v1/catalog/visual-search', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'emerald-ring.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 45000,
        dataBase64: 'base64sample',
        minSimilarity: 0.9,
      }),
    });

    const searchRes = await searchRoute(searchReq);
    expect(searchRes.status).toBe(200);
    const searchData = await searchRes.json();
    expect(searchData.count).toBe(1);
    expect(searchData.matches[0].productId).toBe('p1');
    expect(searchData.matches[0].productName).toBe('18K Gold Emerald Ring');
  });

  it('rejects image with unsupported mime type with 415 HTTP status', async () => {
    const searchReq = new NextRequest('http://localhost:3000/api/v1/catalog/visual-search', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        filename: 'sketch.bmp',
        mimeType: 'image/bmp',
        sizeBytes: 1000,
      }),
    });

    const searchRes = await searchRoute(searchReq);
    expect(searchRes.status).toBe(415);
    const data = await searchRes.json();
    expect(data.code).toBe('INVALID_IMAGE_FILE_TYPE');
  });

  it('rejects path traversal attempts with 400 Bad Request', async () => {
    const searchReq = new NextRequest('http://localhost:3000/api/v1/catalog/visual-search', {
      method: 'POST',
      headers: {
        'x-tenant-id': 'tenant-test',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        filename: '../../../../secret.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
      }),
    });

    const searchRes = await searchRoute(searchReq);
    expect(searchRes.status).toBe(400);
    const data = await searchRes.json();
    expect(data.code).toBe('PATH_TRAVERSAL_DETECTED');
  });
});
