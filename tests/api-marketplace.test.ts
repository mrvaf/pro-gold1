import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createSellerApi, GET as listSellersApi } from '../apps/web/app/api/v1/sellers/route.js';
import { GET as getSellerByIdApi, PATCH as updateSellerApi } from '../apps/web/app/api/v1/sellers/[id]/route.js';
import { POST as createListingApi, GET as listSellerListingsApi } from '../apps/web/app/api/v1/sellers/[id]/listings/route.js';
import { GET as getListingByIdApi, PATCH as updateListingApi } from '../apps/web/app/api/v1/listings/[id]/route.js';
import { GET as getPublicSellerApi } from '../apps/web/app/api/v1/marketplace/sellers/[slug]/route.js';
import { GET as listPublicListingsApi } from '../apps/web/app/api/v1/marketplace/listings/route.js';
import { POST as createProductApi } from '../apps/web/app/api/v1/catalog/products/route.js';
import { POST as createVariantApi } from '../apps/web/app/api/v1/catalog/variants/route.js';

describe('Seller Marketplace Web API Endpoints', () => {
  const tenantId = 'tenant_marketplace_api_test';
  const otherTenant = 'tenant_intruder_beta';

  let sellerId: string;
  let sellerSlug = 'damas-persian-gold';
  let productId: string;
  let variantId: string;
  let listingId: string;

  describe('Seller Profile Management API', () => {
    it('creates a new seller profile via POST /api/v1/sellers', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/sellers', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          displayName: 'Damas Persian Gold Atelier',
          slug: sellerSlug,
          bio: 'Handcrafted traditional Iranian jewelry and gold bullion.',
          businessRegistrationNumber: 'REG-1398-XYZ',
          taxId: 'TAX-998877',
          contactEmail: 'artisan@damasgold.ir',
          initialStatus: 'DRAFT',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await createSellerApi(createReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.displayName).toBe('Damas Persian Gold Atelier');
      expect(json.data.slug).toBe(sellerSlug);
      expect(json.data.status).toBe('DRAFT');

      sellerId = json.data.id;
    });

    it('rejects duplicate slug with 409 Conflict', async () => {
      const dupReq = new NextRequest('http://localhost:3000/api/v1/sellers', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: otherTenant,
          displayName: 'Damas Copycat',
          slug: sellerSlug, // Already taken
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await createSellerApi(dupReq);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });

    it('retrieves seller profile via GET /api/v1/sellers/:id and enforces tenant isolation', async () => {
      // 1. Legitimate tenant read
      const getReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}?tenantId=${tenantId}`);
      const res = await getSellerByIdApi(getReq, { params: Promise.resolve({ id: sellerId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(sellerId);

      // 2. Cross-tenant read -> 403 Forbidden
      const idorReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}?tenantId=${otherTenant}`);
      const idorRes = await getSellerByIdApi(idorReq, { params: Promise.resolve({ id: sellerId }) });
      expect(idorRes.status).toBe(403);
    });

    it('lists seller profiles scoped to tenant', async () => {
      const listReq = new NextRequest(`http://localhost:3000/api/v1/sellers?tenantId=${tenantId}`);
      const res = await listSellersApi(listReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.some((s: any) => s.id === sellerId)).toBe(true);
    });

    it('updates seller profile and transitions status: DRAFT -> ACTIVE via PATCH /api/v1/sellers/:id', async () => {
      const patchReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tenantId,
          bio: 'Updated biography for verified active artisan.',
          targetStatus: 'ACTIVE',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await updateSellerApi(patchReq, { params: Promise.resolve({ id: sellerId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('ACTIVE');
      expect(json.data.bio).toContain('Updated biography');
    });
  });

  describe('Seller Listing Management API', () => {
    it('seeds catalog product and variant, then creates seller listing', async () => {
      // 1. Create Product
      const prodReq = new NextRequest('http://localhost:3000/api/v1/catalog/products', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          name: 'Emerald Solitaire Ring Model',
          productType: 'RING',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const prodRes = await createProductApi(prodReq);
      const prodJson = await prodRes.json();
      productId = prodJson.data.id;

      // 2. Create Variant
      const varReq = new NextRequest('http://localhost:3000/api/v1/catalog/variants', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          tenantId,
          sku: 'EMR-RING-18K-52',
          name: 'Emerald Ring 18K Size 52',
          jewelryType: 'RING',
          goldPurity: { karat: '18' },
          goldWeightGrams: '7.5',
          grossWeightGrams: '7.9', // 7.5g gold + 0.4g emerald (2 ct)
          gemstones: [
            {
              gemstoneType: 'EMERALD',
              caratWeight: '2.0',
              count: 1,
            },
          ],
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const varRes = await createVariantApi(varReq);
      const varJson = await varRes.json();
      variantId = varJson.data.id;

      // 3. Create Listing for Seller
      const listReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}/listings`, {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          productId,
          productVariantId: variantId,
          title: 'Artisan Emerald Ring in 18K Yellow Gold',
          description: 'Finely crafted emerald solitaire ring by Damas Atelier.',
          initialStatus: 'ACTIVE',
          visibility: 'PUBLIC',
          tags: ['emerald', 'solitaire', '18k-gold'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await createListingApi(listReq, { params: Promise.resolve({ id: sellerId }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.title).toContain('Artisan Emerald Ring');
      expect(json.data.status).toBe('ACTIVE');

      listingId = json.data.id;
    });

    it('lists listings for seller via GET /api/v1/sellers/:id/listings', async () => {
      const listReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}/listings?tenantId=${tenantId}`);
      const res = await listSellerListingsApi(listReq, { params: Promise.resolve({ id: sellerId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].id).toBe(listingId);
    });

    it('retrieves listing by ID via GET /api/v1/listings/:id with tenant isolation', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/v1/listings/${listingId}?tenantId=${tenantId}`);
      const res = await getListingByIdApi(getReq, { params: Promise.resolve({ id: listingId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(listingId);

      // Cross-tenant access -> 403
      const idorReq = new NextRequest(`http://localhost:3000/api/v1/listings/${listingId}?tenantId=${otherTenant}`);
      const idorRes = await getListingByIdApi(idorReq, { params: Promise.resolve({ id: listingId }) });
      expect(idorRes.status).toBe(403);
    });

    it('pauses and resumes listing via PATCH /api/v1/listings/:id', async () => {
      // 1. Pause
      const pauseReq = new NextRequest(`http://localhost:3000/api/v1/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tenantId,
          targetStatus: 'PAUSED',
          statusReason: 'Artisan holiday',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const pauseRes = await updateListingApi(pauseReq, { params: Promise.resolve({ id: listingId }) });
      expect(pauseRes.status).toBe(200);
      const pauseJson = await pauseRes.json();
      expect(pauseJson.data.status).toBe('PAUSED');

      // 2. Resume
      const resumeReq = new NextRequest(`http://localhost:3000/api/v1/listings/${listingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tenantId,
          targetStatus: 'ACTIVE',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const resumeRes = await updateListingApi(resumeReq, { params: Promise.resolve({ id: listingId }) });
      expect(resumeRes.status).toBe(200);
      const resumeJson = await resumeRes.json();
      expect(resumeJson.data.status).toBe('ACTIVE');
    });
  });

  describe('Public Marketplace Discovery API', () => {
    it('discovers public seller profile by slug without leaking internal tenant IDs or tax numbers', async () => {
      const pubReq = new NextRequest(`http://localhost:3000/api/v1/marketplace/sellers/${sellerSlug}`);
      const res = await getPublicSellerApi(pubReq, { params: Promise.resolve({ slug: sellerSlug }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.slug).toBe(sellerSlug);
      expect(json.data.displayName).toBe('Damas Persian Gold Atelier');

      // Crucial Sanitization Check: No internal tenantId or tax numbers
      expect(json.data.tenantId).toBeUndefined();
      expect(json.data.taxId).toBeUndefined();
      expect(json.data.businessRegistrationNumber).toBeUndefined();
      expect(json.data.contactEmail).toBeUndefined();
    });

    it('discovers public listings feed filtered by tag or seller', async () => {
      const feedReq = new NextRequest('http://localhost:3000/api/v1/marketplace/listings?tag=emerald');
      const res = await listPublicListingsApi(feedReq);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data[0].tags).toContain('emerald');

      // Public listing DTO sanitization check: no tenantId
      expect(json.data[0].tenantId).toBeUndefined();
    });

    it('immediately suppresses listings from public discovery and returns 404 when seller is suspended', async () => {
      // 1. Suspend the seller via API
      const suspendReq = new NextRequest(`http://localhost:3000/api/v1/sellers/${sellerId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          tenantId,
          targetStatus: 'SUSPENDED',
          statusReason: 'Administrative audit',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const suspendRes = await updateSellerApi(suspendReq, { params: Promise.resolve({ id: sellerId }) });
      expect(suspendRes.status).toBe(200);

      // 2. GET /api/v1/marketplace/sellers/:slug must now return 404
      const pubSellerReq = new NextRequest(`http://localhost:3000/api/v1/marketplace/sellers/${sellerSlug}`);
      const pubSellerRes = await getPublicSellerApi(pubSellerReq, { params: Promise.resolve({ slug: sellerSlug }) });
      expect(pubSellerRes.status).toBe(404);

      // 3. GET /api/v1/marketplace/listings must now exclude this seller's active listing
      const feedReq = new NextRequest(`http://localhost:3000/api/v1/marketplace/listings?sellerProfileId=${sellerId}`);
      const feedRes = await listPublicListingsApi(feedReq);
      expect(feedRes.status).toBe(200);
      const feedJson = await feedRes.json();
      expect(feedJson.success).toBe(true);
      expect(feedJson.data.length).toBe(0); // Suspended seller's listing is suppressed!
    });
  });
});
