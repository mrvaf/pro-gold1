import { describe, it, expect } from 'vitest';
import {
  MockVisualFeatureExtractorAdapter,
  UnavailableVisualFeatureExtractorAdapter,
} from '@v-gold/ai-gateway';
import { VisualSearchImage, AiProviderUnavailableError } from '@v-gold/core';

describe('Stage 11 Visual Feature Extractor Adapters', () => {
  const validImage = VisualSearchImage.create({
    filename: 'gold_bracelet.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 15000,
    dataBase64: 'base64sample',
  }).unwrap();

  it('MockVisualFeatureExtractorAdapter returns deterministic feature vector', async () => {
    const extractor = new MockVisualFeatureExtractorAdapter({ defaultDimensions: 32 });
    const result = await extractor.extractFeatures(validImage);

    expect(result.isOk).toBe(true);
    if (result.isOk) {
      expect(result.value.dimensions).toBe(32);
      expect(result.value.values.length).toBe(32);
    }
  });

  it('UnavailableVisualFeatureExtractorAdapter returns AiProviderUnavailableError gracefully', async () => {
    const extractor = new UnavailableVisualFeatureExtractorAdapter('Vision service offline');
    const result = await extractor.extractFeatures(validImage);

    expect(result.isErr).toBe(true);
    if (result.isErr) {
      expect(result.error).toBeInstanceOf(AiProviderUnavailableError);
      expect(result.error.message).toContain('Vision service offline');
    }
  });
});
