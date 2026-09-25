import { describe, it, expect } from 'vitest';
import {
  BodyPartAnchoring,
  TryOnSession,
  createEntityId,
  type TryOnSessionId,
  type TenantId,
  type ProductId,
  type Studio3DAssetId,
  InvalidAnchoringScaleError,
  TryOnSessionExpiredError,
} from '@v-gold/core';

describe('Stage 14 Virtual Try-On Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-tryon-test');
  const productId = createEntityId<ProductId>('prod-ring-1');
  const asset3dId = createEntityId<Studio3DAssetId>('asset-3d-1');
  const sessionId = createEntityId<TryOnSessionId>('session-tryon-1');

  describe('BodyPartAnchoring Value Object', () => {
    it('creates valid biometric anchoring for ring finger sizing', () => {
      const anchoring = BodyPartAnchoring.create({
        bodyPart: 'RING_FINGER',
        scaleFactor: 1.0,
        anchorOffsetX: 0.0,
        anchorOffsetY: 0.0,
        anchorOffsetZ: 0.0,
        biometricFingerSizeMm: 16.5, // Standard US size 6
      });

      expect(anchoring.isOk).toBe(true);
      if (anchoring.isOk) {
        expect(anchoring.value.bodyPart).toBe('RING_FINGER');
        expect(anchoring.value.biometricFingerSizeMm).toBe(16.5);
      }
    });

    it('rejects unrealistic biometric scale or finger size', () => {
      const badScale = BodyPartAnchoring.create({
        bodyPart: 'RING_FINGER',
        scaleFactor: 3.5, // out of bounds (> 2.5)
        anchorOffsetX: 0,
        anchorOffsetY: 0,
        anchorOffsetZ: 0,
      });

      expect(badScale.isErr).toBe(true);
      if (badScale.isErr) {
        expect(badScale.error).toBeInstanceOf(InvalidAnchoringScaleError);
      }

      const badFinger = BodyPartAnchoring.create({
        bodyPart: 'RING_FINGER',
        scaleFactor: 1.0,
        anchorOffsetX: 0,
        anchorOffsetY: 0,
        anchorOffsetZ: 0,
        biometricFingerSizeMm: 45, // unrealistic human finger (> 30mm)
      });
      expect(badFinger.isErr).toBe(true);
    });
  });

  describe('TryOnSession Entity & Lifecycle', () => {
    const validAnchoring = BodyPartAnchoring.create({
      bodyPart: 'RING_FINGER',
      scaleFactor: 1.0,
      anchorOffsetX: 0,
      anchorOffsetY: 0,
      anchorOffsetZ: 0,
    }).unwrap();

    it('creates an active session with temporary expiration window', () => {
      const session = TryOnSession.create(sessionId, {
        tenantId,
        productId,
        asset3dId,
        anchoring: validAnchoring,
        signedAssetUrl: 'https://assets.vgold.test/3d/ring.glb?token=xyz',
        durationSeconds: 300,
      });

      expect(session.status).toBe('ACTIVE');
      expect(session.isExpired()).toBe(false);
      expect(session.verifyActive().isOk).toBe(true);
    });

    it('enforces expiration when past lifespan', () => {
      const session = TryOnSession.create(sessionId, {
        tenantId,
        productId,
        asset3dId,
        anchoring: validAnchoring,
        signedAssetUrl: 'https://assets.vgold.test/3d/ring.glb?token=xyz',
        durationSeconds: 10,
      });

      const futureDate = new Date(Date.now() + 60 * 1000); // 60s later
      expect(session.isExpired(futureDate)).toBe(true);

      const verifyRes = session.verifyActive(futureDate);
      expect(verifyRes.isErr).toBe(true);
      if (verifyRes.isErr) {
        expect(verifyRes.error).toBeInstanceOf(TryOnSessionExpiredError);
        expect(session.status).toBe('EXPIRED');
      }
    });
  });
});
