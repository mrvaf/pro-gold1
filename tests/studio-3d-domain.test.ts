import { describe, it, expect } from 'vitest';
import {
  Studio3DAsset,
  BoundingBox3D,
  PbrMaterialMap,
  createEntityId,
  type Studio3DAssetId,
  type TenantId,
  type ProductId,
  Invalid3DAssetTypeError,
  Oversized3DAssetError,
  Invalid3DScaleError,
} from '@v-gold/core';

describe('Stage 13 3D Jewelry Studio Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-3d-test');
  const productId = createEntityId<ProductId>('prod-ring-1');
  const assetId = createEntityId<Studio3DAssetId>('asset-3d-1');

  describe('BoundingBox3D Value Object', () => {
    it('creates a valid bounding box within allowable jewelry dimensions (1mm to 1m)', () => {
      const bbox = BoundingBox3D.create({
        widthMeters: 0.02,  // 20 mm
        heightMeters: 0.025, // 25 mm
        depthMeters: 0.005,  // 5 mm
      });

      expect(bbox.isOk).toBe(true);
      if (bbox.isOk) {
        expect(bbox.value.widthMeters).toBe(0.02);
      }
    });

    it('rejects bounding box scale when too small (< 1mm) or too large (> 1m)', () => {
      const tooSmall = BoundingBox3D.create({
        widthMeters: 0.0001,
        heightMeters: 0.02,
        depthMeters: 0.02,
      });
      expect(tooSmall.isErr).toBe(true);
      if (tooSmall.isErr) {
        expect(tooSmall.error).toBeInstanceOf(Invalid3DScaleError);
      }

      const tooLarge = BoundingBox3D.create({
        widthMeters: 1.5,
        heightMeters: 0.02,
        depthMeters: 0.02,
      });
      expect(tooLarge.isErr).toBe(true);
    });
  });

  describe('PbrMaterialMap Value Object', () => {
    it('clamps metalness and roughness factors between 0 and 1', () => {
      const material = PbrMaterialMap.create({
        metalnessFactor: 1.5,
        roughnessFactor: -0.2,
        baseColorHex: '#FFD700',
      });

      expect(material.metalnessFactor).toBe(1.0);
      expect(material.roughnessFactor).toBe(0.0);
      expect(material.baseColorHex).toBe('#FFD700');
    });
  });

  describe('Studio3DAsset Entity & Validation', () => {
    const validBbox = BoundingBox3D.create({
      widthMeters: 0.02,
      heightMeters: 0.02,
      depthMeters: 0.02,
    }).unwrap();

    const validMaterial = PbrMaterialMap.create({
      metalnessFactor: 1.0,
      roughnessFactor: 0.1,
      baseColorHex: '#FFD700',
    });

    it('instantiates Studio3DAsset with GLB and valid size', () => {
      const assetRes = Studio3DAsset.create(assetId, {
        tenantId,
        productId,
        format: 'GLB',
        mimeType: 'model/gltf-binary',
        fileSizeBytes: 1024 * 1024 * 5, // 5 MB
        storageKey: 'tenants/tenant-3d-test/assets/ring.glb',
        boundingBox: validBbox,
        material: validMaterial,
        lodLevels: 2,
      });

      expect(assetRes.isOk).toBe(true);
      if (assetRes.isOk) {
        expect(assetRes.value.id).toBe(assetId);
        expect(assetRes.value.mimeType).toBe('model/gltf-binary');
      }
    });

    it('rejects unsupported 3D mime types (e.g. FBX, OBJ, STL)', () => {
      const assetRes = Studio3DAsset.create(assetId, {
        tenantId,
        productId,
        format: 'GLB',
        mimeType: 'model/obj',
        fileSizeBytes: 1024 * 100,
        storageKey: 'key',
        boundingBox: validBbox,
        material: validMaterial,
      });

      expect(assetRes.isErr).toBe(true);
      if (assetRes.isErr) {
        expect(assetRes.error).toBeInstanceOf(Invalid3DAssetTypeError);
      }
    });

    it('rejects oversized 3D assets (> 50 MB)', () => {
      const assetRes = Studio3DAsset.create(assetId, {
        tenantId,
        productId,
        format: 'GLB',
        mimeType: 'model/gltf-binary',
        fileSizeBytes: 60 * 1024 * 1024, // 60 MB
        storageKey: 'key',
        boundingBox: validBbox,
        material: validMaterial,
      });

      expect(assetRes.isErr).toBe(true);
      if (assetRes.isErr) {
        expect(assetRes.error).toBeInstanceOf(Oversized3DAssetError);
      }
    });
  });
});
