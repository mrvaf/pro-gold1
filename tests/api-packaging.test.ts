import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createPackagingRoute, GET as listPackagingRoute } from '../apps/web/app/api/v1/packaging/route';
import { GET as getPackagingRoute } from '../apps/web/app/api/v1/packaging/[id]/route';
import { POST as previewPackagingRoute } from '../apps/web/app/api/v1/packaging/[id]/preview/route';
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
  type UserId,
  type ProductId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';

describe('Stage 16 AI Packaging & Box Studio API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_pkg_api_test');
  const userId = createEntityId<UserId>('user_pkg_api_test');
  const productId = createEntityId<ProductId>('prod_pkg_1');

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Setup tenant & user
    const tenant = Tenant.create({
      id: tenantId,
      name: 'Packaging Test Tenant',
      slug: 'packaging-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      id: userId,
      email: Email.create('packaging-owner@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Packaging Studio Lead',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'a7'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Setup product
    const catalog = getCatalogContainer();
    const product = Product.create({
      id: productId,
      tenantId,
      name: 'Regal Royal Sapphire Ring',
      productType: 'RING',
    }).unwrap();
    await catalog.productRepo.save(product);
  });

  it('creates packaging specification, queries it, and generates AI preview', async () => {
    // 1. Create packaging spec
    const createReq = new NextRequest('http://localhost:3000/api/v1/packaging', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Royal Sapphire Presentation Box',
        productId,
        dimensions: {
          widthMm: 85,
          lengthMm: 85,
          heightMm: 50,
        },
        material: 'LEATHER',
        tier: 'BESPOKE_LUXURY',
        primaryColorHex: '#081c3b',
        accentColorHex: '#e5c158',
        hasCustomDieline: true,
        hasFoilEmbossing: true,
        dieline: {
          fluteOrBoardThicknessMm: 2.5,
          creasingMatrixMm: 0.9,
          insertCushionType: 'RING_CLIP',
        },
        currency: 'USD',
      }),
    });

    const createRes = await createPackagingRoute(createReq);
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    expect(createData.success).toBe(true);
    expect(createData.packaging.id).toBeDefined();
    expect(createData.packaging.name).toBe('Royal Sapphire Presentation Box');
    expect(createData.packaging.material).toBe('LEATHER');
    expect(createData.packaging.productionCost.amount).toBeDefined();

    const specId = createData.packaging.id;

    // 2. Get packaging spec by ID
    const getReq = new NextRequest(`http://localhost:3000/api/v1/packaging/${specId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const getRes = await getPackagingRoute(getReq, { params: Promise.resolve({ id: specId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.packaging.id).toBe(specId);

    // 3. List specifications
    const listReq = new NextRequest(`http://localhost:3000/api/v1/packaging?productId=${productId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const listRes = await listPackagingRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.packagingSpecifications.length).toBe(1);
    expect(listData.packagingSpecifications[0].id).toBe(specId);

    // 4. Generate AI preview
    const prevReq = new NextRequest(`http://localhost:3000/api/v1/packaging/${specId}/preview`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
      },
    });

    const prevRes = await previewPackagingRoute(prevReq, { params: Promise.resolve({ id: specId }) });
    expect(prevRes.status).toBe(200);
    const prevData = await prevRes.json();
    expect(prevData.success).toBe(true);
    expect(prevData.packaging.aiPreviewImageUrl).toContain('preview-leather-');
  });
});
