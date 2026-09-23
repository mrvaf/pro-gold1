import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sellerProfilesTable, sellerListingsTable } from '@v-gold/database';

describe('Marketplace Database Schema & Migration Invariants', () => {
  it('validates sellerProfilesTable schema definition', () => {
    expect(sellerProfilesTable.id).toBeDefined();
    expect(sellerProfilesTable.tenantId).toBeDefined();
    expect(sellerProfilesTable.storeId).toBeDefined();
    expect(sellerProfilesTable.displayName).toBeDefined();
    expect(sellerProfilesTable.slug).toBeDefined();
    expect(sellerProfilesTable.bio).toBeDefined();
    expect(sellerProfilesTable.logoUrl).toBeDefined();
    expect(sellerProfilesTable.bannerUrl).toBeDefined();
    expect(sellerProfilesTable.isPubliclyVisible).toBeDefined();
    expect(sellerProfilesTable.status).toBeDefined();
    expect(sellerProfilesTable.businessRegistrationNumber).toBeDefined();
    expect(sellerProfilesTable.taxId).toBeDefined();
    expect(sellerProfilesTable.contactEmail).toBeDefined();
    expect(sellerProfilesTable.contactPhone).toBeDefined();
    expect(sellerProfilesTable.metadataJson).toBeDefined();
    expect(sellerProfilesTable.createdAt).toBeDefined();
    expect(sellerProfilesTable.updatedAt).toBeDefined();
    expect(sellerProfilesTable.createdByActorType).toBeDefined();
    expect(sellerProfilesTable.createdByActorId).toBeDefined();
  });

  it('validates sellerListingsTable schema definition', () => {
    expect(sellerListingsTable.id).toBeDefined();
    expect(sellerListingsTable.tenantId).toBeDefined();
    expect(sellerListingsTable.sellerProfileId).toBeDefined();
    expect(sellerListingsTable.productId).toBeDefined();
    expect(sellerListingsTable.productVariantId).toBeDefined();
    expect(sellerListingsTable.title).toBeDefined();
    expect(sellerListingsTable.slug).toBeDefined();
    expect(sellerListingsTable.description).toBeDefined();
    expect(sellerListingsTable.status).toBeDefined();
    expect(sellerListingsTable.visibility).toBeDefined();
    expect(sellerListingsTable.tagsJson).toBeDefined();
    expect(sellerListingsTable.createdAt).toBeDefined();
    expect(sellerListingsTable.updatedAt).toBeDefined();
    expect(sellerListingsTable.createdByActorType).toBeDefined();
    expect(sellerListingsTable.createdByActorId).toBeDefined();
  });

  it('verifies sequential migration 0009_seller_marketplace_foundation.sql integrity', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../packages/database/src/migrations/0009_seller_marketplace_foundation.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Table creations
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "seller_profiles"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "seller_listings"');

    // Composite unique constraints for multi-tenant safe referencing
    expect(sql).toContain('CONSTRAINT "seller_profiles_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")');
    expect(sql).toContain('CONSTRAINT "seller_profiles_slug_uniq" UNIQUE ("slug")');
    expect(sql).toContain('CONSTRAINT "seller_listings_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")');
    expect(sql).toContain('CONSTRAINT "seller_listings_seller_variant_uniq" UNIQUE ("seller_profile_id", "product_variant_id")');

    // Composite foreign keys enforcing tenant boundaries
    expect(sql).toContain('FOREIGN KEY ("store_id", "tenant_id")');
    expect(sql).toContain('REFERENCES "stores"("id", "tenant_id")');
    expect(sql).toContain('FOREIGN KEY ("seller_profile_id", "tenant_id")');
    expect(sql).toContain('REFERENCES "seller_profiles"("id", "tenant_id")');

    // Indexes
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "seller_profiles_tenant_status_idx"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "seller_listings_tenant_status_idx"');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "seller_listings_seller_status_idx"');
  });

  it('verifies sequential migration 0010_seller_marketplace_integrity.sql hardening', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../packages/database/src/migrations/0010_seller_marketplace_integrity.sql'
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Composite unique constraints on parent catalog entities
    expect(sql).toContain('ALTER TABLE "products" ADD CONSTRAINT "products_id_tenant_id_uniq" UNIQUE ("id", "tenant_id")');
    expect(sql).toContain('ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_id_product_tenant_uniq" UNIQUE ("id", "product_id", "tenant_id")');

    // Composite foreign keys enforcing multi-tenant catalog ownership
    expect(sql).toContain('FOREIGN KEY ("product_id", "tenant_id")');
    expect(sql).toContain('REFERENCES "products"("id", "tenant_id")');

    expect(sql).toContain('FOREIGN KEY ("product_variant_id", "product_id", "tenant_id")');
    expect(sql).toContain('REFERENCES "product_variants"("id", "product_id", "tenant_id")');

    // Partial unique index for non-archived listings
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "seller_listings_seller_variant_non_archived_uniq"');
    expect(sql).toContain('WHERE "status" != \'ARCHIVED\'');
  });
});
