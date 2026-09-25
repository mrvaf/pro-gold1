import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createContentRoute, GET as listContentRoute } from '../apps/web/app/api/v1/content-studio/route';
import { GET as getContentRoute } from '../apps/web/app/api/v1/content-studio/[id]/route';
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

describe('Stage 18 AI Content Studio API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_content_api_test');
  const userId = createEntityId<UserId>('user_content_api_test');
  const productId = createEntityId<ProductId>('prod_cnt_1');

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Setup tenant & user
    const tenant = Tenant.create({
      id: tenantId,
      name: 'Content Studio Tenant',
      slug: 'content-studio-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      id: userId,
      email: Email.create('copywriter@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Lead Jewelry Copywriter',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'b9'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Setup product
    const catalog = getCatalogContainer();
    const product = Product.create({
      id: productId,
      tenantId,
      name: 'Imperial Emerald Necklace 18K',
      productType: 'NECKLACE',
    }).unwrap();
    await catalog.productRepo.save(product);
  });

  it('rejects hallucinated content generation and approves grounded content', async () => {
    // 1. Reject ungrounded copy (claim says 24k when spec is 18k)
    const badReq = new NextRequest('http://localhost:3000/api/v1/content-studio', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        contentType: 'PRODUCT_DESCRIPTION',
        language: 'en-US',
        headline: 'Imperial Pure Gold Necklace',
        body: 'Crafted with fine 24K gold with unmatched sparkle.',
        groundingAttributes: {
          title: 'Imperial Emerald Necklace',
          metalType: 'GOLD',
          targetKarat: 18,
          gemstone: 'Emerald',
        },
      }),
    });

    const badRes = await createContentRoute(badReq);
    expect(badRes.status).toBe(422);

    // 2. Approve grounded copy
    const goodReq = new NextRequest('http://localhost:3000/api/v1/content-studio', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        contentType: 'PRODUCT_DESCRIPTION',
        language: 'en-US',
        headline: 'Imperial 18K Gold Emerald Necklace',
        body: 'Crafted with solid 18K Gold (750 fineness) set with a magnificent natural Emerald.',
        tags: ['necklace', 'emerald', '18k-gold'],
        groundingAttributes: {
          title: 'Imperial Emerald Necklace',
          metalType: 'GOLD',
          targetKarat: 18,
          gemstone: 'Emerald',
        },
      }),
    });

    const goodRes = await createContentRoute(goodReq);
    expect(goodRes.status).toBe(201);
    const goodData = await goodRes.json();
    expect(goodData.success).toBe(true);
    expect(goodData.contentAsset.id).toBeDefined();

    const assetId = goodData.contentAsset.id;

    // 3. Get asset by ID
    const getReq = new NextRequest(`http://localhost:3000/api/v1/content-studio/${assetId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const getRes = await getContentRoute(getReq, { params: Promise.resolve({ id: assetId }) });
    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.contentAsset.headline).toBe('Imperial 18K Gold Emerald Necklace');

    // 4. List by product
    const listReq = new NextRequest(`http://localhost:3000/api/v1/content-studio?productId=${productId}`, {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const listRes = await listContentRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.contentAssets.length).toBe(1);
  });
});
