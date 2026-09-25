import { describe, it, expect } from 'vitest';
import {
  FeatureVector,
  VisualSearchImage,
  InvalidFeatureVectorError,
  InvalidImageFileTypeError,
  PathTraversalError,
  OversizedImageError,
} from '@v-gold/core';

describe('Stage 11 Visual Search Domain Unit Tests', () => {
  describe('FeatureVector Value Object', () => {
    it('creates a valid FeatureVector with normalized values', () => {
      const vec = FeatureVector.create([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(vec.isOk).toBe(true);
      if (vec.isOk) {
        expect(vec.value.dimensions).toBe(8);
        expect(vec.value.values.length).toBe(8);
      }
    });

    it('rejects empty vector or too low dimensions (< 8)', () => {
      const empty = FeatureVector.create([]);
      expect(empty.isErr).toBe(true);
      if (empty.isErr) {
        expect(empty.error).toBeInstanceOf(InvalidFeatureVectorError);
      }

      const tooShort = FeatureVector.create([1, 2, 3]);
      expect(tooShort.isErr).toBe(true);
      if (tooShort.isErr) {
        expect(tooShort.error.message).toContain('out of bounds');
      }
    });

    it('computes exact cosine similarity between identical and orthogonal vectors', () => {
      const vecA = FeatureVector.create([1, 0, 0, 0, 0, 0, 0, 0]).unwrap();
      const vecB = FeatureVector.create([1, 0, 0, 0, 0, 0, 0, 0]).unwrap();
      const vecC = FeatureVector.create([0, 1, 0, 0, 0, 0, 0, 0]).unwrap();

      const simIdentical = vecA.cosineSimilarity(vecB);
      expect(simIdentical.isOk).toBe(true);
      expect(simIdentical.unwrap()).toBeCloseTo(1.0, 5);

      const simOrthogonal = vecA.cosineSimilarity(vecC);
      expect(simOrthogonal.isOk).toBe(true);
      expect(simOrthogonal.unwrap()).toBeCloseTo(0.0, 5);
    });

    it('fails cosine similarity when dimension mismatch occurs', () => {
      const vecA = FeatureVector.create([1, 1, 1, 1, 1, 1, 1, 1]).unwrap();
      const vecB = FeatureVector.create([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).unwrap();

      const result = vecA.cosineSimilarity(vecB);
      expect(result.isErr).toBe(true);
      if (result.isErr) {
        expect(result.error.message).toContain('Dimension mismatch');
      }
    });
  });

  describe('VisualSearchImage Value Object & Security', () => {
    it('accepts valid JPEG, PNG, WEBP images under size limit', () => {
      for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
        const res = VisualSearchImage.create({
          filename: 'valid-gold-ring.jpg',
          mimeType: mime,
          sizeBytes: 1024 * 100, // 100 KB
          dataBase64: 'abc==',
        });
        expect(res.isOk).toBe(true);
      }
    });

    it('rejects unsupported mime types like SVG, GIF, PDF', () => {
      const res = VisualSearchImage.create({
        filename: 'malicious.svg',
        mimeType: 'image/svg+xml',
        sizeBytes: 1024,
        dataBase64: '<svg>',
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(InvalidImageFileTypeError);
      }
    });

    it('detects and blocks path traversal attempts in filename', () => {
      const traversalFilenames = [
        '../../etc/passwd',
        '..\\windows\\system32',
        '/var/www/uploads/pic.png',
        'sub/folder.jpg',
        'foo\0bar.png',
      ];

      for (const name of traversalFilenames) {
        const res = VisualSearchImage.create({
          filename: name,
          mimeType: 'image/jpeg',
          sizeBytes: 2048,
          dataBase64: 'data',
        });
        expect(res.isErr).toBe(true);
        if (res.isErr) {
          expect(res.error).toBeInstanceOf(PathTraversalError);
        }
      }
    });

    it('rejects oversized images (> 5MB)', () => {
      const res = VisualSearchImage.create({
        filename: 'huge-ring.png',
        mimeType: 'image/png',
        sizeBytes: 6 * 1024 * 1024,
        dataBase64: 'huge',
      });
      expect(res.isErr).toBe(true);
      if (res.isErr) {
        expect(res.error).toBeInstanceOf(OversizedImageError);
      }
    });
  });
});
