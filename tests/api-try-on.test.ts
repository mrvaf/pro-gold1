import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createSessionRoute } from '../apps/web/app/api/v1/try-on/sessions/route';
import { GET as getSessionRoute } from '../apps/web/app/api/v1/try-on/sessions/[id]/route';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  Product,
  Studio3DAsset,
  BoundingBox3D,
  PbrMaterialMap,
  createEntityId,
  type TenantId,
  type ProductId,
  type Studio3DAssetId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { getTryOnContainer } from '../apps/web/lib/try-on/try-on-container.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';
import { getStudio3DContainer } from '../apps/web/lib/studio-3d/studio-3d-container.js';

describe('Stage 14 Virtual Try-On API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_api_tryon_test');
  const productId = createEntityId<ProductId>('prod_ring_tryon_test');
  const asset3dId = createEntityId<Studio3DAssetId>('asset_3d_tryon_test');

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalog = getCatalogContainer();
    const studio3d = getStudio3DContainer();
    const tryon = getTryOnContainer();

    // 1. Setup tenant, user, membership, session
    const tenant = Tenant.create({
      id: tenantId,
      name: 'API Try-On Test Tenant',
      slug: 'api-tryon-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      email: Email.create('tryon-user@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'API Try-On User',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'd4'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Setup product
    const product = Product.create({
      id: productId,
      tenantId,
      name: 'Try-On Solitaire Ring',
      productType: 'RING',
    }).unwrap();
    await catalog.productRepo.save(product);

    // 3. Setup 3D Asset in both studio3d and tryon repos
    const asset = Studio3DAsset.create(asset3dId, {
      tenantId,
      productId,
      format: 'GLB',
      mimeType: 'model/gltf-binary',
      fileSizeBytes: 1024 * 1024 * 3,
      storageKey: 'models/rings/tryon_ring.glb',
      boundingBox: BoundingBox3D.create({
        widthMeters: 0.02,
        heightMeters: 0.02,
        depthMeters: 0.005,
      }).unwrap(),
      material: PbrMaterialMap.create({
        metalnessFactor: 1.0,
        roughnessFactor: 0.1,
        baseColorHex: '#FFD700',
      }),
    }).unwrap();
    await studio3d.assetRepo.save(asset);
    await tryon.assetRepo.save(asset);
  });

  it('creates virtual try-on session with signed temporary URL and retrieves it', async () => {
    const createReq = new NextRequest('http://localhost:3000/api/v1/try-on/sessions', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        asset3dId,
        bodyPart: 'RING_FINGER',
        scaleFactor: 1.05,
        biometricFingerSizeMm: 17.0,
        durationSeconds: 900,
      }),
    });

    const createRes = await createSessionRoute(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.session.id).toBeDefined();
    expect(createData.session.signedAssetUrl).toContain('models/rings/tryon_ring.glb');

    const createdSessionId = createData.session.id;

    // Get active session
    const getReq = new NextRequest(`http://localhost:3000/api/v1/try-on/sessions/${createdSessionId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const getRes = await getSessionRoute(getReq, { params: Promise.resolve({ id: createdSessionId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.session.status).toBe('ACTIVE');
    expect(getData.session.anchoring.biometricFingerSizeMm).toBe(17.0);
  });

  it('rejects invalid biometric dimensions with 422 or 400', async () => {
    const createReq = new NextRequest('http://localhost:3000/api/v1/try-on/sessions', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        asset3dId,
        bodyPart: 'RING_FINGER',
        biometricFingerSizeMm: 55.0, // invalid: too large
      }),
    });

    const createRes = await createSessionRoute(createReq);
    expect(createRes.status).toBeGreaterThanOrEqual(400);
  });
});
