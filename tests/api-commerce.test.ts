import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as addToCartRoute, GET as getCartRoute } from '../apps/web/app/api/v1/commerce/cart/route';
import { POST as checkoutRoute, GET as listOrdersRoute } from '../apps/web/app/api/v1/commerce/orders/route';
import { POST as payOrderRoute } from '../apps/web/app/api/v1/commerce/orders/[id]/pay/route';
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

describe('Stage 17 Commerce, Orders & Payments API Integration Tests', () => {
  let sessionCookie: string;
  const tenantId = createEntityId<TenantId>('tenant_commerce_api_test');
  const userId = createEntityId<UserId>('user_commerce_api_test');
  const productId = createEntityId<ProductId>('prod_comm_1');

  beforeAll(async () => {
    const authService = getDefaultAuthService();

    // 1. Setup tenant & user
    const tenant = Tenant.create({
      id: tenantId,
      name: 'Commerce Test Tenant',
      slug: 'commerce-test',
    }).unwrap();
    await authService.tenantRepository.save(tenant);

    const user = User.create({
      id: userId,
      email: Email.create('shopper@vgold.test').unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: 'Royal Shopper',
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({
      tenantId,
      userId: user.id,
      role: 'OWNER',
    }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: 'c8'.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);
    sessionCookie = `${SESSION_COOKIE_NAME}=${session.id}`;

    // 2. Setup product
    const catalog = getCatalogContainer();
    const product = Product.create({
      id: productId,
      tenantId,
      name: 'Diamond Band 18K',
      productType: 'RING',
    }).unwrap();
    await catalog.productRepo.save(product);
  });

  it('executes cart operations, atomic checkout with idempotency, and payment processing', async () => {
    // 1. Add item to cart
    const addReq = new NextRequest('http://localhost:3000/api/v1/commerce/cart', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        variantId: 'var_diamond_1',
        sku: 'RNG-DIA-01',
        title: '18K White Gold Diamond Band',
        quantity: 2,
        unitPrice: '1200.00',
        currency: 'USD',
      }),
    });

    const addRes = await addToCartRoute(addReq);
    expect(addRes.status).toBe(200);
    const addData = await addRes.json();
    expect(addData.success).toBe(true);
    expect(addData.cart.items.length).toBe(1);
    expect(Number(addData.cart.total.amount)).toBe(2400);

    // 2. Get cart
    const getCartReq = new NextRequest('http://localhost:3000/api/v1/commerce/cart', {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const getCartRes = await getCartRoute(getCartReq);
    expect(getCartRes.status).toBe(200);
    const getCartData = await getCartRes.json();
    expect(getCartData.cart.items.length).toBe(1);

    // 3. Checkout cart with idempotency key
    const idempotencyKey = 'idem_checkout_test_123';
    const checkoutReq = new NextRequest('http://localhost:3000/api/v1/commerce/orders', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey,
      }),
    });

    const checkoutRes = await checkoutRoute(checkoutReq);
    expect(checkoutRes.status).toBe(201);
    const checkoutData = await checkoutRes.json();
    expect(checkoutData.success).toBe(true);
    expect(checkoutData.order.id).toBeDefined();
    expect(checkoutData.order.status).toBe('PENDING_PAYMENT');
    expect(checkoutData.order.lines.length).toBe(1);
    expect(Number(checkoutData.order.totalAmount.amount)).toBe(2400);

    const orderId = checkoutData.order.id;

    // 3b. Verify idempotency replay returns identical order
    const replayReq = new NextRequest('http://localhost:3000/api/v1/commerce/orders', {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey,
      }),
    });
    const replayRes = await checkoutRoute(replayReq);
    const replayData = await replayRes.json();
    expect(replayData.order.id).toBe(orderId);

    // 4. Pay order
    const payReq = new NextRequest(`http://localhost:3000/api/v1/commerce/orders/${orderId}/pay`, {
      method: 'POST',
      headers: {
        cookie: sessionCookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'STRIPE',
        paymentReferenceToken: 'tok_visa_success',
      }),
    });

    const payRes = await payOrderRoute(payReq, { params: Promise.resolve({ id: orderId }) });
    expect(payRes.status).toBe(200);
    const payData = await payRes.json();
    expect(payData.success).toBe(true);
    expect(payData.order.status).toBe('PAID');
    expect(payData.order.paymentDetails.provider).toBe('STRIPE');

    // 5. List user orders
    const listReq = new NextRequest('http://localhost:3000/api/v1/commerce/orders', {
      method: 'GET',
      headers: {
        cookie: sessionCookie,
      },
    });

    const listRes = await listOrdersRoute(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.orders.length).toBe(1);
    expect(listData.orders[0].id).toBe(orderId);
  });
});
