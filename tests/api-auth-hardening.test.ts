import { describe, expect, it, beforeAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  Tenant,
  Store,
  User,
  Email,
  PasswordHash,
  TenantMembership,
  Session,
  MarketObservation,
  MarketPrice,
  createEntityId,
  type TenantId,
  type StoreId,
} from '@v-gold/core';
import { getDefaultAuthService } from '../apps/web/lib/auth/auth.service.js';
import { getCatalogContainer } from '../apps/web/lib/catalog/catalog-container.js';
import { getInventoryContainer } from '../apps/web/lib/inventory/inventory-container.js';
import { getMarketplaceContainer } from '../apps/web/lib/marketplace/marketplace-container.js';
import { getPricingContainer } from '../apps/web/lib/pricing/pricing-container.js';
import { getMarketDataContainer } from '../apps/web/lib/market-data/market-data-container.js';
import { SESSION_COOKIE_NAME } from '../apps/web/lib/auth/session-cookie.js';
import { GET as listProductsApi, POST as createProductApi } from '../apps/web/app/api/v1/catalog/products/route.js';
import { GET as getProductApi } from '../apps/web/app/api/v1/catalog/products/[id]/route.js';
import { GET as listVariantsApi, POST as createVariantApi } from '../apps/web/app/api/v1/catalog/variants/route.js';
import { GET as listItemsApi, POST as intakeItemApi } from '../apps/web/app/api/v1/inventory/items/route.js';
import { POST as transitionItemApi } from '../apps/web/app/api/v1/inventory/items/[id]/transition/route.js';
import { GET as listLocationsApi, POST as createLocationApi } from '../apps/web/app/api/v1/inventory/locations/route.js';
import { GET as listMovementsApi } from '../apps/web/app/api/v1/inventory/movements/route.js';
import { GET as getListingApi, PATCH as patchListingApi } from '../apps/web/app/api/v1/listings/[id]/route.js';
import { POST as pricingCalculateApi } from '../apps/web/app/api/v1/pricing/calculate/route.js';
import { GET as listSellersApi, POST as createSellerApi } from '../apps/web/app/api/v1/sellers/route.js';
import { GET as getSellerApi, PATCH as patchSellerApi } from '../apps/web/app/api/v1/sellers/[id]/route.js';
import { GET as listSellerListingsApi, POST as createListingApi } from '../apps/web/app/api/v1/sellers/[id]/listings/route.js';

/**
 * Stage 8.1 negative security matrix: every protected route method × 7 scenarios.
 *
 * Scenario expectations (see ADR-0041 / ADR-0042):
 *  1. no session cookie            -> 401 UNAUTHORIZED
 *  2. invalid or expired session   -> 401 UNAUTHORIZED
 *  3. suspended user / revoked membership -> 401 / 403
 *  4. insufficient permission      -> 403 FORBIDDEN
 *  5. other tenant's resource      -> 403/404 (strict where the request names a
 *     tenant-A resource; scoped-empty form for tenant-scoped list filters)
 *  6. tenantId/actorId in input    -> 400 VALIDATION_ERROR
 *  7. forced 500                   -> INTERNAL_ERROR without internal message
 *
 * Vacuous cells, documented per the stage plan (mapping pinned by
 * tests/marketplace-domain.test.ts:283-284 — must not change):
 *  - Scenario 4 is VACUOUS for the four marketplace READ methods
 *    (GET /sellers, GET /sellers/[id], GET /sellers/[id]/listings,
 *    GET /listings/[id]): MEMBER already holds marketplace.seller.read and
 *    marketplace.listing.read, so a 403 cannot be produced for them. Those
 *    cells assert the pinned mapping (MEMBER read succeeds on own tenant).
 *  - Scenario 5 is VACUOUS (strict 403/404 form) for pure tenant-scoped list
 *    GETs with no tenant-A resource reference (GET /catalog/products,
 *    GET /inventory/items, GET /inventory/locations) and for
 *    POST /pricing/calculate (all inputs are global market/rule inputs).
 *    Those cells assert tenant scoping instead.
 *  - Scenario 5 for list GETs with a foreign resource filter
 *    (variants?productId, movements?itemId, sellers?storeId) asserts the
 *    scoped-empty-or-deny contract (200 + empty list, or 403/404).
 */

const SECRET_MARKER = 'INTERNAL_SECRET_SHOULD_NOT_LEAK_9f2a';

const tenantA = 'tenant_hardening_a';
const tenantB = 'tenant_hardening_b';

let ownerCookie: string;
let intruderCookie: string;
let memberCookie: string;
let suspendedCookie: string;
let revokedCookie: string;
let expiredCookie: string;
const invalidCookie = `${SESSION_COOKIE_NAME}=${'f0'.repeat(32)}`;

let productId: string;
let variantId: string;
let locationId: string;
let itemId: string;
let sellerId: string;
let listingId: string;
let storeAId: string;
let storeBId: string;

function reqWith(
  url: string,
  opts: { method?: string; cookie?: string | null; body?: unknown; headers?: Record<string, string> } = {}
): NextRequest {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.cookie) {
    headers['Cookie'] = opts.cookie;
  }
  return new NextRequest(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

interface MatrixMethod {
  key: string;
  method: 'GET' | 'POST' | 'PATCH';
  /** URL builder given tenant-A resource ids */
  url: (ids: Record<string, string>) => string;
  call: (req: NextRequest) => Promise<Response>;
  /** JSON body builder (writes). */
  body?: (ids: Record<string, string>) => Record<string, unknown>;
  /** Where identity fields are injected for scenario 6. */
  identityMode: 'query' | 'body';
  /** Service method spied for the forced-500 scenario. */
  spy: () => { service: Record<string, unknown>; name: string };
  /**
   * Cross-tenant (scenario 5) request: 'strict' = must 403/404;
   * 'scoped-empty' = 200 + empty list OR 403/404; 'vacuous' = scoping only.
   */
  crossTenant: 'strict' | 'scoped-empty' | 'vacuous';
  /** Extra cross-tenant request tweaks (e.g. foreign filter params / body refs). */
  crossTenantUrl?: (ids: Record<string, string>) => string;
  crossTenantBody?: (ids: Record<string, string>) => Record<string, unknown>;
  /** Scenario 4 (insufficient permission) is vacuous for pinned read perms. */
  insufficientVacuous?: boolean;
}

const ids = () => ({
  productId,
  variantId,
  locationId,
  itemId,
  sellerId,
  listingId,
  storeAId,
  storeBId,
});

const validBody = (m: MatrixMethod) => (m.body ? m.body(ids()) : undefined);

const MATRIX: MatrixMethod[] = [
  {
    key: 'GET /catalog/products',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/catalog/products',
    call: (req) => listProductsApi(req),
    identityMode: 'query',
    spy: () => ({ service: getCatalogContainer().catalogService as any, name: 'listProducts' }),
    crossTenant: 'vacuous',
  },
  {
    key: 'POST /catalog/products',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/catalog/products',
    call: (req) => createProductApi(req),
    body: () => ({ name: 'Hardening Probe Product', productType: 'RING' }),
    identityMode: 'body',
    spy: () => ({ service: getCatalogContainer().catalogService as any, name: 'createProduct' }),
    crossTenant: 'strict',
    crossTenantBody: (i) => ({ name: 'Hardening Probe Product', productType: 'RING', storeId: i.storeAId }),
  },
  {
    key: 'GET /catalog/products/[id]',
    method: 'GET',
    url: (i) => `http://localhost:3000/api/v1/catalog/products/${i.productId}`,
    call: (req) => getProductApi(req, { params: Promise.resolve({ id: productId }) }),
    identityMode: 'query',
    spy: () => ({ service: getCatalogContainer().catalogService as any, name: 'getProduct' }),
    crossTenant: 'strict',
  },
  {
    key: 'GET /catalog/variants',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/catalog/variants',
    call: (req) => listVariantsApi(req),
    identityMode: 'query',
    spy: () => ({ service: getCatalogContainer().catalogService as any, name: 'listVariants' }),
    crossTenant: 'scoped-empty',
    crossTenantUrl: (i) => `http://localhost:3000/api/v1/catalog/variants?productId=${i.productId}`,
  },
  {
    key: 'POST /catalog/variants',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/catalog/variants',
    call: (req) => createVariantApi(req),
    body: (i) => ({
      productId: i.productId,
      sku: 'HARD-PROBE-SKU-01',
      name: 'Hardening Probe Variant',
      jewelryType: 'RING',
      goldPurity: { karat: '18' },
      goldWeightGrams: '5.0',
      grossWeightGrams: '5.1',
    }),
    identityMode: 'body',
    spy: () => ({ service: getCatalogContainer().catalogService as any, name: 'createVariant' }),
    crossTenant: 'strict',
  },
  {
    key: 'GET /inventory/items',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/inventory/items',
    call: (req) => listItemsApi(req),
    identityMode: 'query',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'listItems' }),
    crossTenant: 'vacuous',
  },
  {
    key: 'POST /inventory/items',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/inventory/items',
    call: (req) => intakeItemApi(req),
    body: (i) => ({
      productVariantId: i.variantId,
      locationId: i.locationId,
      serialNumber: 'SN-HARD-PROBE',
      grossWeightGrams: '6.2',
      goldWeightGrams: '6.0',
      purityFineness: '750',
    }),
    identityMode: 'body',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'intakeItem' }),
    crossTenant: 'strict',
    crossTenantBody: (i) => ({
      productVariantId: i.variantId,
      locationId: i.locationId,
      grossWeightGrams: '6.2',
      goldWeightGrams: '6.0',
      purityFineness: '750',
    }),
  },
  {
    key: 'POST /inventory/items/[id]/transition',
    method: 'POST',
    url: (i) => `http://localhost:3000/api/v1/inventory/items/${i.itemId}/transition`,
    call: (req) => transitionItemApi(req, { params: Promise.resolve({ id: itemId }) }),
    body: () => ({ targetStatus: 'RESERVED', reference: 'HARD-PROBE' }),
    identityMode: 'body',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'transitionStatus' }),
    crossTenant: 'strict',
  },
  {
    key: 'GET /inventory/locations',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/inventory/locations',
    call: (req) => listLocationsApi(req),
    identityMode: 'query',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'listLocations' }),
    crossTenant: 'vacuous',
  },
  {
    key: 'POST /inventory/locations',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/inventory/locations',
    call: (req) => createLocationApi(req),
    body: () => ({ name: 'Hardening Probe Vault', code: 'HARD-VAULT-01', type: 'VAULT' }),
    identityMode: 'body',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'createLocation' }),
    crossTenant: 'strict',
    crossTenantBody: (i) => ({
      name: 'Hardening Probe Vault',
      code: 'HARD-VAULT-01',
      type: 'VAULT',
      storeId: i.storeAId,
    }),
  },
  {
    key: 'GET /inventory/movements',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/inventory/movements',
    call: (req) => listMovementsApi(req),
    identityMode: 'query',
    spy: () => ({ service: getInventoryContainer().inventoryService as any, name: 'listMovementsByTenant' }),
    crossTenant: 'scoped-empty',
    crossTenantUrl: (i) => `http://localhost:3000/api/v1/inventory/movements?itemId=${i.itemId}`,
  },
  {
    key: 'GET /listings/[id]',
    method: 'GET',
    url: (i) => `http://localhost:3000/api/v1/listings/${i.listingId}`,
    call: (req) => getListingApi(req, { params: Promise.resolve({ id: listingId }) }),
    identityMode: 'query',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'getListing' }),
    crossTenant: 'strict',
  },
  {
    key: 'PATCH /listings/[id]',
    method: 'PATCH',
    url: (i) => `http://localhost:3000/api/v1/listings/${i.listingId}`,
    call: (req) => patchListingApi(req, { params: Promise.resolve({ id: listingId }) }),
    body: () => ({ title: 'Hardening Probe Title' }),
    identityMode: 'body',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'updateListing' }),
    crossTenant: 'strict',
  },
  {
    key: 'POST /pricing/calculate',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/pricing/calculate',
    call: (req) => pricingCalculateApi(req),
    body: () => ({
      weight: { grams: '10.0' },
      purity: { karat: '18' },
      targetCurrency: 'USD',
      instrumentSymbol: 'XAU/USD',
      ruleId: 'rule_iran_bazaar_18k_v1',
    }),
    identityMode: 'body',
    spy: () => ({ service: getPricingContainer().pricingService as any, name: 'calculateQuote' }),
    crossTenant: 'vacuous',
  },
  {
    key: 'GET /sellers',
    method: 'GET',
    url: () => 'http://localhost:3000/api/v1/sellers',
    call: (req) => listSellersApi(req),
    identityMode: 'query',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'listSellerProfiles' }),
    crossTenant: 'scoped-empty',
    crossTenantUrl: (i) => `http://localhost:3000/api/v1/sellers?storeId=${i.storeAId}`,
  },
  {
    key: 'POST /sellers',
    method: 'POST',
    url: () => 'http://localhost:3000/api/v1/sellers',
    call: (req) => createSellerApi(req),
    body: () => ({ displayName: 'Hardening Probe Seller', slug: 'hardening-probe-seller' }),
    identityMode: 'body',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'createSellerProfile' }),
    crossTenant: 'strict',
    crossTenantBody: (i) => ({
      displayName: 'Hardening Probe Seller',
      slug: 'hardening-probe-seller',
      storeId: i.storeAId,
    }),
  },
  {
    key: 'GET /sellers/[id]',
    method: 'GET',
    url: (i) => `http://localhost:3000/api/v1/sellers/${i.sellerId}`,
    call: (req) => getSellerApi(req, { params: Promise.resolve({ id: sellerId }) }),
    identityMode: 'query',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'getSellerProfile' }),
    crossTenant: 'strict',
    insufficientVacuous: true,
  },
  {
    key: 'PATCH /sellers/[id]',
    method: 'PATCH',
    url: (i) => `http://localhost:3000/api/v1/sellers/${i.sellerId}`,
    call: (req) => patchSellerApi(req, { params: Promise.resolve({ id: sellerId }) }),
    body: () => ({ bio: 'Hardening probe biography' }),
    identityMode: 'body',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'updateSellerProfile' }),
    crossTenant: 'strict',
  },
  {
    key: 'GET /sellers/[id]/listings',
    method: 'GET',
    url: (i) => `http://localhost:3000/api/v1/sellers/${i.sellerId}/listings`,
    call: (req) => listSellerListingsApi(req, { params: Promise.resolve({ id: sellerId }) }),
    identityMode: 'query',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'listListingsBySeller' }),
    crossTenant: 'strict',
    insufficientVacuous: true,
  },
  {
    key: 'POST /sellers/[id]/listings',
    method: 'POST',
    url: (i) => `http://localhost:3000/api/v1/sellers/${i.sellerId}/listings`,
    call: (req) => createListingApi(req, { params: Promise.resolve({ id: sellerId }) }),
    body: (i) => ({
      productId: i.productId,
      productVariantId: i.variantId,
      title: 'Hardening Probe Listing',
      initialStatus: 'DRAFT',
    }),
    identityMode: 'body',
    spy: () => ({ service: getMarketplaceContainer().marketplaceService as any, name: 'createListing' }),
    crossTenant: 'strict',
  },
];

// GET /listings/[id] and GET /sellers/[id] are pinned reads for MEMBER too.
const INSUFFICIENT_VACUOUS = new Set([
  'GET /sellers',
  'GET /listings/[id]',
  'GET /sellers/[id]',
  'GET /sellers/[id]/listings',
]);

beforeAll(async () => {
  const authService = getDefaultAuthService();
  const catalogContainer = getCatalogContainer();
  const inventoryContainer = getInventoryContainer();
  const marketplaceContainer = getMarketplaceContainer();
  const marketData = getMarketDataContainer();

  const seedTenantUser = async (
    tenantKey: string,
    tenantName: string,
    tenantSlug: string,
    storeKey: string,
    storeName: string,
    storeCode: string,
    userEmail: string,
    userName: string,
    role: 'OWNER' | 'MEMBER',
    tokenSeed: string
  ) => {
    const tId = createEntityId<TenantId>(tenantKey);
    const tenant = Tenant.create({ id: tId, name: tenantName, slug: tenantSlug }).unwrap();
    await authService.tenantRepository.save(tenant);

    const sId = createEntityId<StoreId>(storeKey);
    const store = Store.create({ id: sId, tenantId: tId, name: storeName, code: storeCode }).unwrap();
    await catalogContainer.storeRepo.save(tId, store);

    const user = User.create({
      email: Email.create(userEmail).unwrap(),
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
      displayName: userName,
    }).unwrap();
    await authService.userRepository.save(user);

    const membership = TenantMembership.create({ tenantId: tId, userId: user.id, role }).unwrap();
    await authService.membershipRepository.save(membership);

    const session = Session.create({ id: tokenSeed.repeat(32), userId: user.id }).unwrap();
    await authService.sessionRepository.save(session);

    return { tId, sId, user, membership, cookie: `${SESSION_COOKIE_NAME}=${session.id}` };
  };

  const a = await seedTenantUser(
    tenantA,
    'Hardening Tenant A',
    'hardening-a',
    'store_hardening_a',
    'Hardening Store A',
    'HARDA01',
    'owner@hardening-a.vgold',
    'Hardening A Owner',
    'OWNER',
    'a2'
  );
  ownerCookie = a.cookie;

  const b = await seedTenantUser(
    tenantB,
    'Hardening Tenant B',
    'hardening-b',
    'store_hardening_b',
    'Hardening Store B',
    'HARDB01',
    'owner@hardening-b.vgold',
    'Hardening B Owner',
    'OWNER',
    'b2'
  );
  intruderCookie = b.cookie;
  storeBId = b.sId;
  storeAId = a.sId;

  // MEMBER in tenant A (insufficient for catalog/inventory/pricing/manage perms)
  const member = await seedTenantUser(
    tenantA,
    'Hardening Tenant A',
    'hardening-a',
    'store_hardening_a',
    'Hardening Store A',
    'HARDA01',
    'member@hardening-a.vgold',
    'Hardening A Member',
    'MEMBER',
    'c2'
  );
  memberCookie = member.cookie;

  // Suspended user in tenant A -> 401
  const suspended = await seedTenantUser(
    tenantA,
    'Hardening Tenant A',
    'hardening-a',
    'store_hardening_a',
    'Hardening Store A',
    'HARDA01',
    'suspended@hardening-a.vgold',
    'Hardening A Suspended',
    'OWNER',
    'd2'
  );
  suspended.user.suspend();
  await authService.userRepository.save(suspended.user);
  suspendedCookie = suspended.cookie;

  // Revoked membership in tenant A -> 403
  const revoked = await seedTenantUser(
    tenantA,
    'Hardening Tenant A',
    'hardening-a',
    'store_hardening_a',
    'Hardening Store A',
    'HARDA01',
    'revoked@hardening-a.vgold',
    'Hardening A Revoked',
    'OWNER',
    'e2'
  );
  revoked.membership.revoke();
  await authService.membershipRepository.save(revoked.membership);
  revokedCookie = revoked.cookie;

  // Expired session -> 401
  const expiredSession = Session.create({ id: 'f2'.repeat(32), userId: a.user.id, ttlMs: -1000 }).unwrap();
  await authService.sessionRepository.save(expiredSession);
  expiredCookie = `${SESSION_COOKIE_NAME}=${expiredSession.id}`;

  // Tenant-A owned resources for cross-tenant cells
  const product = await catalogContainer.catalogService.createProduct({
    tenantId: a.tId,
    name: 'Hardening Anchor Product',
    productType: 'RING',
    actorId: a.user.id,
  });
  if (product.isErr) throw new Error('seed product failed');
  productId = product.value.id;

  const variant = await catalogContainer.catalogService.createVariant({
    productId,
    tenantId: a.tId,
    sku: 'HARD-ANCHOR-SKU',
    name: 'Hardening Anchor Variant',
    jewelryType: 'RING',
    goldPurity: { karat: '18' },
    goldWeightGrams: '6.0',
    grossWeightGrams: '6.2',
    actorId: a.user.id,
  });
  if (variant.isErr) throw new Error('seed variant failed');
  variantId = variant.value.id;

  const location = await inventoryContainer.inventoryService.createLocation({
    tenantId: a.tId,
    name: 'Hardening Anchor Vault',
    code: 'HARD-ANCHOR-LOC',
    type: 'VAULT',
    actorId: a.user.id,
  });
  if (location.isErr) throw new Error('seed location failed');
  locationId = location.value.id;

  const item = await inventoryContainer.inventoryService.intakeItem({
    tenantId: a.tId,
    productVariantId: variantId,
    locationId,
    serialNumber: 'SN-HARD-ANCHOR',
    grossWeightGrams: '6.2',
    goldWeightGrams: '6.0',
    purityFineness: '750',
    actorId: a.user.id,
  });
  if (item.isErr) throw new Error('seed item failed');
  itemId = item.value.item.id;

  const seller = await marketplaceContainer.marketplaceService.createSellerProfile({
    tenantId: a.tId,
    displayName: 'Hardening Anchor Seller',
    slug: 'hardening-anchor-seller',
    initialStatus: 'ACTIVE',
    actorId: a.user.id,
  });
  if (seller.isErr) throw new Error('seed seller failed');
  sellerId = seller.value.id;

  const listing = await marketplaceContainer.marketplaceService.createListing({
    tenantId: a.tId,
    sellerProfileId: sellerId,
    productId,
    productVariantId: variantId,
    title: 'Hardening Anchor Listing',
    initialStatus: 'ACTIVE',
    actorId: a.user.id,
  });
  if (listing.isErr) throw new Error('seed listing failed');
  listingId = listing.value.id;

  // Fresh market observation so scenario-5 pricing probe can reach the service.
  const inst = await marketData.instrumentRepo.findBySymbol('XAU/USD');
  if (inst) {
    const obs = MarketObservation.create({
      id: createEntityId<any>(`obs_hardening_${Date.now()}`),
      instrumentId: inst.id,
      sourceId: createEntityId<any>('src_unavailable'),
      price: MarketPrice.create({ amount: '2650.00', currency: inst.quoteCurrency, unit: inst.unit }).unwrap(),
      quality: 'REAL_TIME',
      observedAt: new Date(),
    }).unwrap();
    await marketData.observationRepo.save(obs);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Stage 8.1 negative security matrix (20 methods × 7 scenarios)', () => {
  for (const m of MATRIX) {
    describe(m.key, () => {
      it('1) without session cookie -> 401 UNAUTHORIZED', async () => {
        const res = await m.call(
          reqWith(m.url(ids()), { method: m.method, body: validBody(m) })
        );
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error.code).toBe('UNAUTHORIZED');
      });

      it('2) invalid or expired session -> 401 UNAUTHORIZED', async () => {
        const invalidRes = await m.call(
          reqWith(m.url(ids()), { method: m.method, cookie: invalidCookie, body: validBody(m) })
        );
        expect(invalidRes.status).toBe(401);

        const expiredRes = await m.call(
          reqWith(m.url(ids()), { method: m.method, cookie: expiredCookie, body: validBody(m) })
        );
        expect(expiredRes.status).toBe(401);
      });

      it('3) suspended user -> 401; revoked membership -> 403', async () => {
        const susRes = await m.call(
          reqWith(m.url(ids()), { method: m.method, cookie: suspendedCookie, body: validBody(m) })
        );
        expect(susRes.status).toBe(401);

        const revRes = await m.call(
          reqWith(m.url(ids()), { method: m.method, cookie: revokedCookie, body: validBody(m) })
        );
        expect(revRes.status).toBe(403);
        const json = await revRes.json();
        expect(json.error.code).toBe('FORBIDDEN');
      });

      if (INSUFFICIENT_VACUOUS.has(m.key)) {
        it('4) insufficient permission -> VACUOUS (MEMBER holds pinned read perm; documents mapping)', async () => {
          const res = await m.call(
            reqWith(m.url(ids()), { method: m.method, cookie: memberCookie, body: validBody(m) })
          );
          // Pinned mapping (tests/marketplace-domain.test.ts:283-284): MEMBER has
          // marketplace.seller.read / marketplace.listing.read -> own-tenant read succeeds.
          expect([200, 404]).toContain(res.status);
          if (res.status === 200) {
            const json = await res.json();
            expect(json.success).toBe(true);
          }
        });
      } else {
        it('4) insufficient permission (MEMBER) -> 403 FORBIDDEN', async () => {
          const res = await m.call(
            reqWith(m.url(ids()), { method: m.method, cookie: memberCookie, body: validBody(m) })
          );
          expect(res.status).toBe(403);
          const json = await res.json();
          expect(json.success).toBe(false);
          expect(json.error.code).toBe('FORBIDDEN');
        });
      }

      if (m.crossTenant === 'strict') {
        it("5) other tenant's resource -> 403/404 (no cross-tenant access)", async () => {
          const res = await m.call(
            reqWith(m.crossTenantUrl ? m.crossTenantUrl(ids()) : m.url(ids()), {
              method: m.method,
              cookie: intruderCookie,
              body: m.crossTenantBody ? m.crossTenantBody(ids()) : validBody(m),
            })
          );
          expect([403, 404]).toContain(res.status);
        });
      } else if (m.crossTenant === 'scoped-empty') {
        it("5) other tenant's resource filter -> scoped-empty or 403/404", async () => {
          const res = await m.call(
            reqWith(m.crossTenantUrl!(ids()), { method: m.method, cookie: intruderCookie })
          );
          if (res.status === 200) {
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.data).toHaveLength(0);
          } else {
            expect([403, 404]).toContain(res.status);
          }
        });
      } else {
        it("5) other tenant's resource -> VACUOUS (no tenant-A reference in request; asserts tenant scoping)", async () => {
          const res = await m.call(
            reqWith(m.url(ids()), { method: m.method, cookie: intruderCookie, body: validBody(m) })
          );
          if (m.method === 'GET') {
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            for (const row of json.data as Array<Record<string, unknown>>) {
              expect(row.tenantId).toBe(tenantB);
            }
          } else {
            // POST /pricing/calculate with global inputs: allowed; must not fail on identity.
            expect([200, 422, 503]).toContain(res.status);
          }
        });
      }

      it('6) tenantId/actorId in input -> 400 VALIDATION_ERROR', async () => {
        if (m.identityMode === 'query') {
          const qRes = await m.call(
            reqWith(`${m.url(ids())}?tenantId=${tenantB}&actorId=user_spoof`, {
              method: m.method,
              cookie: ownerCookie,
            })
          );
          expect(qRes.status).toBe(400);
          const qJson = await qRes.json();
          expect(qJson.error.code).toBe('VALIDATION_ERROR');

          const hRes = await m.call(
            reqWith(m.url(ids()), {
              method: m.method,
              cookie: ownerCookie,
              headers: { 'x-tenant-id': tenantB, 'x-actor-id': 'user_spoof' },
            })
          );
          expect(hRes.status).toBe(400);
        } else {
          const body = { ...(validBody(m) ?? {}), tenantId: tenantB, actorId: 'user_spoof' };
          const bRes = await m.call(
            reqWith(m.url(ids()), { method: m.method, cookie: ownerCookie, body })
          );
          expect(bRes.status).toBe(400);
          const bJson = await bRes.json();
          expect(bJson.error.code).toBe('VALIDATION_ERROR');

          const hRes = await m.call(
            reqWith(m.url(ids()), {
              method: m.method,
              cookie: ownerCookie,
              body: validBody(m),
              headers: { 'x-tenant-id': tenantB, 'x-actor-id': 'user_spoof' },
            })
          );
          expect(hRes.status).toBe(400);
        }
      });

      it('7) forced 500 -> generic INTERNAL_ERROR without internal message', async () => {
        const target = m.spy();
        vi.spyOn(target.service as any, target.name as any).mockRejectedValueOnce(
          new Error(`${SECRET_MARKER}: database exploded at /internal/path`)
        );

        const res = await m.call(
          reqWith(m.url(ids()), { method: m.method, cookie: ownerCookie, body: validBody(m) })
        );
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('INTERNAL_ERROR');
        const raw = JSON.stringify(json);
        expect(raw).not.toContain(SECRET_MARKER);
        expect(raw).not.toContain('database exploded');
        expect(raw).not.toContain('/internal/path');
      });
    });
  }
});
