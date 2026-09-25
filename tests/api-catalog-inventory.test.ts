import { describe, expect, it, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  Tenant,
  Store,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  createEntityId,
  type TenantId,
  type StoreId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { POST as createProductApi, GET as listProductsApi } from '../apps/web/app/api/v1/catalog/products/route.js';
import { GET as getProductByIdApi } from '../apps/web/app/api/v1/catalog/products/[id]/route.js';
import { POST as createVariantApi, GET as listVariantsApi } from '../apps/web/app/api/v1/catalog/variants/route.js';
import { POST as createLocationApi, GET as listLocationsApi } from '../apps/web/app/api/v1/inventory/locations/route.js';
import { POST as intakeItemApi, GET as listItemsApi } from '../apps/web/app/api/v1/inventory/items/route.js';
import { POST as transitionItemApi } from '../apps/web/app/api/v1/inventory/items/[id]/transition/route.js';
import { GET as listMovementsApi } from '../apps/web/app/api/v1/inventory/movements/route.js';

describe('Catalog & Inventory Web API Endpoints', () => {
  const tenantId = 'tenant_api_web_test';
  const otherTenant = 'tenant_intruder';
  let sessionCookie: string;
  let intruderCookie: string;

  beforeAll(async () => {
    const authService = getDefaultAuthService();
    const catalogContainer = getCatalogContainer();

    const seedTenant = async (
      tenantKey: string,
      tenantName: string,
      tenantSlug: string,
      storeName: string,
      storeCode: string,
      ownerEmail: string,
      ownerName: string,
      tokenSeed: string
    ) => {
      const tId = createEntityId<TenantId>(tenantKey);
      const tenant = Tenant.create({ id: tId, name: tenantName, slug: tenantSlug }).unwrap();
      await authService.tenantRepository.save(tenant);

      const sId = createEntityId<StoreId>(`store_${tenantKey}`);
      const store = Store.create({ id: sId, tenantId: tId, name: storeName, code: storeCode }).unwrap();
      await catalogContainer.storeRepo.save(tId, store);

      const owner = User.create({
        email: Email.create(ownerEmail).unwrap(),
        passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
        displayName: ownerName,
      }).unwrap();
      await authService.userRepository.save(owner);

      const membership = TenantMembership.create({ tenantId: tId, userId: owner.id, role: 'OWNER' }).unwrap();
      await authService.membershipRepository.save(membership);

      const session = Session.create({ id: tokenSeed.repeat(32), userId: owner.id }).unwrap();
      await authService.sessionRepository.save(session);
      return `${SESSION_COOKIE_NAME}=${session.id}`;
    };

    sessionCookie = await seedTenant(
      tenantId,
      'API Web Test Tenant',
      'api-web-test',
      'API Web Test Store',
      'APIWEB01',
      'owner@api-web-test.vgold',
      'API Web Owner',
      'b1'
    );
    intruderCookie = await seedTenant(
      otherTenant,
      'Intruder Tenant',
      'tenant-intruder',
      'Intruder Store',
      'INTRUDER01',
      'owner@intruder.vgold',
      'Intruder Owner',
      'c1'
    );
  });

  describe('Catalog Products API', () => {
    it('creates and retrieves a product via API', async () => {
      // 1. POST create product
      const createReq = new NextRequest('http://localhost:3000/api/v1/catalog/products', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Tehran Heritage Ring',
          description: 'Handcrafted traditional ring',
          productType: 'RING',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const createRes = await createProductApi(createReq);
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      expect(createJson.success).toBe(true);
      expect(createJson.data.id).toBeDefined();
      expect(createJson.data.name).toBe('Tehran Heritage Ring');
      expect(createJson.data.status).toBe('DRAFT');

      const productId = createJson.data.id;

      // 2. GET product by ID
      const getReq = new NextRequest(`http://localhost:3000/api/v1/catalog/products/${productId}`, {
        headers: { Cookie: sessionCookie },
      });
      const getRes = await getProductByIdApi(getReq, { params: Promise.resolve({ id: productId }) });
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.data.id).toBe(productId);

      // 3. GET product by ID with other tenant session -> 403 Forbidden
      const idorReq = new NextRequest(`http://localhost:3000/api/v1/catalog/products/${productId}`, {
        headers: { Cookie: intruderCookie },
      });
      const idorRes = await getProductByIdApi(idorReq, { params: Promise.resolve({ id: productId }) });
      expect(idorRes.status).toBe(403);
    });

    it('lists products scoped to tenant', async () => {
      const listReq = new NextRequest('http://localhost:3000/api/v1/catalog/products', {
        headers: { Cookie: sessionCookie },
      });
      const listRes = await listProductsApi(listReq);
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.success).toBe(true);
      expect(Array.isArray(listJson.data)).toBe(true);
      expect(listJson.data.length).toBeGreaterThan(0);
    });
  });

  describe('Catalog Variants API', () => {
    it('creates product variant and validates duplicate SKU prevention', async () => {
      // Create parent product first
      const prodReq = new NextRequest('http://localhost:3000/api/v1/catalog/products', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Diamond Band',
          productType: 'RING',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });
      const prodRes = await createProductApi(prodReq);
      const prodJson = await prodRes.json();
      const productId = prodJson.data.id;

      // Create Variant
      const variantReq = new NextRequest('http://localhost:3000/api/v1/catalog/variants', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          sku: 'DIA-BAND-18K-54',
          name: 'Diamond Band 18K Size 54',
          jewelryType: 'RING',
          goldPurity: { karat: '18' },
          goldWeightGrams: '6.0',
          grossWeightGrams: '6.2', // 6.0g gold + 0.2g diamond (1 ct)
          gemstones: [
            {
              gemstoneType: 'DIAMOND',
              caratWeight: '1.0',
              count: 1,
              clarity: 'VS1',
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const varRes = await createVariantApi(variantReq);
      expect(varRes.status).toBe(201);
      const varJson = await varRes.json();
      expect(varJson.success).toBe(true);
      expect(varJson.data.sku).toBe('DIA-BAND-18K-54');

      // Attempting duplicate SKU within same tenant returns 409 Conflict
      const dupReq = new NextRequest('http://localhost:3000/api/v1/catalog/variants', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          sku: 'DIA-BAND-18K-54', // Duplicate SKU
          name: 'Duplicate SKU Variant',
          jewelryType: 'RING',
          goldPurity: { karat: '18' },
          goldWeightGrams: '6.0',
          grossWeightGrams: '6.0',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const dupRes = await createVariantApi(dupReq);
      expect(dupRes.status).toBe(409);
      const dupJson = await dupRes.json();
      expect(dupJson.success).toBe(false);
      expect(dupJson.error.code).toBe('CONFLICT');
    });
  });

  describe('Inventory Locations, Items & Movements API', () => {
    let locationId: string;
    let variantId: string;

    it('creates inventory location and prevents duplicate codes within tenant', async () => {
      const locReq = new NextRequest('http://localhost:3000/api/v1/inventory/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Main Safe Box',
          code: 'SAFE_BOX_01',
          type: 'VAULT',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const locRes = await createLocationApi(locReq);
      expect(locRes.status).toBe(201);
      const locJson = await locRes.json();
      expect(locJson.success).toBe(true);
      expect(locJson.data.code).toBe('SAFE_BOX_01');
      locationId = locJson.data.id;

      // Duplicate code in same tenant returns 409
      const dupReq = new NextRequest('http://localhost:3000/api/v1/inventory/locations', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Another Safe Box',
          code: 'SAFE_BOX_01',
          type: 'VAULT',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const dupRes = await createLocationApi(dupReq);
      expect(dupRes.status).toBe(409);
    });

    it('intakes discrete inventory item, transitions status to RESERVED, and verifies movement log', async () => {
      // First get an existing variant
      const varListReq = new NextRequest('http://localhost:3000/api/v1/catalog/variants', {
        headers: { Cookie: sessionCookie },
      });
      const varListRes = await listVariantsApi(varListReq);
      const varListJson = await varListRes.json();
      variantId = varListJson.data[0].id;
      const sku = varListJson.data[0].sku;

      // 1. POST intake item
      const intakeReq = new NextRequest('http://localhost:3000/api/v1/inventory/items', {
        method: 'POST',
        body: JSON.stringify({
          productVariantId: variantId,
          sku,
          locationId,
          serialNumber: 'SN-API-TEST-001',
          grossWeightGrams: '6.200000',
          goldWeightGrams: '6.000000',
          purityFineness: '750',
          notes: 'Intake for API test',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const intakeRes = await intakeItemApi(intakeReq);
      expect(intakeRes.status).toBe(201);
      const intakeJson = await intakeRes.json();
      expect(intakeJson.success).toBe(true);
      expect(intakeJson.data.item.status).toBe('AVAILABLE');
      expect(intakeJson.data.movement.movementType).toBe('INTAKE');

      const itemId = intakeJson.data.item.id;

      // 2. Transition status: AVAILABLE -> RESERVED
      const transReq = new NextRequest(`http://localhost:3000/api/v1/inventory/items/${itemId}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          targetStatus: 'RESERVED',
          reference: 'CUSTOMER-HOLD-101',
        }),
        headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
      });

      const transRes = await transitionItemApi(transReq, { params: Promise.resolve({ id: itemId }) });
      expect(transRes.status).toBe(200);
      const transJson = await transRes.json();
      expect(transJson.success).toBe(true);
      expect(transJson.data.item.status).toBe('RESERVED');
      expect(transJson.data.movement.movementType).toBe('RESERVATION');

      // 3. Query movements audit trail
      const moveReq = new NextRequest(`http://localhost:3000/api/v1/inventory/movements?itemId=${itemId}`, {
        headers: { Cookie: sessionCookie },
      });
      const moveRes = await listMovementsApi(moveReq);
      expect(moveRes.status).toBe(200);
      const moveJson = await moveRes.json();
      expect(moveJson.success).toBe(true);
      expect(moveJson.data.length).toBe(2); // INTAKE + RESERVATION
      expect(moveJson.data.map((m: any) => m.movementType)).toContain('INTAKE');
      expect(moveJson.data.map((m: any) => m.movementType)).toContain('RESERVATION');
    });
  });
});
