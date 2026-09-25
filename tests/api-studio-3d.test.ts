import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerAssetRoute } from '../apps/web/app/api/v1/studio-3d/assets/route';
import { GET as getAssetRoute } from '../apps/web/app/api/v1/studio-3d/assets/[id]/route';
import {
  Tenant,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  Product,
  createEntityId,
  type TenantId,
  type ProductId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { getStudio3DContainer } from '../apps/web/lib/studio-3d/studio-3d-container.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';

describe('Stage 13 3D Jewelry Studio API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_api_3d_test');
  const productId = createEntityId<ProductId>('prod_ring_3d_test');

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalog = getCatalogContainer();

    // 1. Setup tenant, user, membership, session
    const tenant = Tenant.create({
      id: tenantId,
      name: 'API 3D Test Tenant',
      slug: 'api-3d-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      email: Email.create('studio3d-owner@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'API 3D Studio Owner',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'c3'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Setup product
    const product = Product.create({
      id: productId,
      tenantId,
      name: '3D Gold Solitaire Ring',
      productType: 'RING',
    }).unwrap();
    await catalog.productRepo.save(product);
  });

  it('registers a 3D asset metadata and retrieves signed preview URL via API', async () => {
    // 1. Register 3D asset
    const registerReq = new NextRequest('http://localhost:3000/api/v1/studio-3d/assets', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        format: 'GLB',
        mimeType: 'model/gltf-binary',
        fileSizeBytes: 2048000,
        storageKey: 'models/rings/solitaire.glb',
        boundingBox: {
          widthMeters: 0.021,
          heightMeters: 0.024,
          depthMeters: 0.008,
        },
        material: {
          metalnessFactor: 1.0,
          roughnessFactor: 0.15,
          baseColorHex: '#FFD700',
        },
        lodLevels: 3,
      }),
    });

    const registerRes = await registerAssetRoute(registerReq);
    expect(registerRes.status).toBe(201);
    const registerData = await registerRes.json();
    expect(registerData.success).toBe(true);
    expect(registerData.asset.id).toBeDefined();

    const createdAssetId = registerData.asset.id;

    // 2. Retrieve preview with signed URL
    const getReq = new NextRequest(`http://localhost:3000/api/v1/studio-3d/assets/${createdAssetId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const getRes = await getAssetRoute(getReq, { params: Promise.resolve({ id: createdAssetId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.preview.downloadUrl).toContain('https://assets.vgold.test/3d/models/rings/solitaire.glb?token=');
    expect(getData.preview.asset.material.baseColorHex).toBe('#FFD700');
  });

  it('rejects unsupported 3D mime types with 415 HTTP status', async () => {
    const registerReq = new NextRequest('http://localhost:3000/api/v1/studio-3d/assets', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        format: 'GLB',
        mimeType: 'application/octet-stream',
        fileSizeBytes: 1000,
        storageKey: 'bad.bin',
        boundingBox: { widthMeters: 0.02, heightMeters: 0.02, depthMeters: 0.02 },
        material: { metalnessFactor: 1, roughnessFactor: 0.2, baseColorHex: '#FFF' },
      }),
    });

    const res = await registerAssetRoute(registerReq);
    expect(res.status).toBe(415);
  });
});
