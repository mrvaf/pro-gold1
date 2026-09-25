import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createEntityId,
  Product,
  User,
  Email,
  PasswordHash,
  type ProductId,
  type TenantId,
} from '@v-gold/core';
import {
  createPersistence,
  isPostgresConfigured,
  runMigrations,
  withTenantContext,
  DrizzleProductRepository,
  DrizzleUserRepository,
  TenantScopedProductRepository,
  type DatabaseConfig,
} from '@v-gold/database';

/**
 * Stage 8.3 — Real PostgreSQL infrastructure verification (ADR-0047/0048/0049).
 *
 * Boots a REAL PostgreSQL cluster (embedded binaries), applies every sequential
 * migration against it, exercises the `pg` + Drizzle connection, and proves the
 * Row-Level Security matrix as the restricted `vgold_app` role.
 */

const TENANT_SCOPED_TABLES = [
  'stores',
  'tenant_memberships',
  'pricing_rules',
  'pricing_results',
  'products',
  'product_variants',
  'inventory_locations',
  'inventory_items',
  'inventory_movements',
  'seller_profiles',
  'seller_listings',
  'seller_workspaces',
  'design_sessions',
  'design_concepts',
  'product_feature_embeddings',
  'studio_3d_assets',
  'try_on_sessions',
] as const;

const PG_PORT = 54320 + (process.pid % 900);

let embedded: EmbeddedPostgres;
let adminPool: Pool;
let appPool: Pool;
let appDb: PgDatabase<any, any, any>;

const adminConfig: DatabaseConfig = {
  host: '127.0.0.1',
  port: PG_PORT,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres',
};

const appConfig: DatabaseConfig = {
  host: '127.0.0.1',
  port: PG_PORT,
  user: 'vgold_app',
  password: 'vgold_app',
  database: 'postgres',
};

const appEnv = {
  DATABASE_ENABLED: 'true',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: `${PG_PORT}`,
  DATABASE_USER: 'vgold_app',
  DATABASE_PASSWORD: 'vgold_app',
  DATABASE_NAME: 'postgres',
} as const;

type ResultLike = { rows: Array<Record<string, unknown>> };

beforeAll(async () => {
  embedded = new EmbeddedPostgres({
    databaseDir: join(tmpdir(), `vgold-pg-test-${process.pid}`),
    user: 'postgres',
    password: 'postgres',
    port: PG_PORT,
    persistent: false,
  });
  await embedded.initialise();
  await embedded.start();

  adminPool = new Pool({ ...adminConfig });
  await adminPool.query("CREATE ROLE vgold_app LOGIN PASSWORD 'vgold_app'");
  await adminPool.query('GRANT USAGE ON SCHEMA public TO vgold_app');
  await adminPool.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO vgold_app'
  );
  await adminPool.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vgold_app'
  );

  const result = await runMigrations(adminPool);
  expect(result.applied.length).toBe(24);

  appPool = new Pool({ ...appConfig });
  appDb = drizzle(appPool);

  // Fixture rows (seeded un-scoped as the owner — policy's deliberate global branch).
  await adminPool.query("INSERT INTO tenants (id, name, slug) VALUES ('tenant_a', 'Alpha', 'alpha')");
  await adminPool.query("INSERT INTO tenants (id, name, slug) VALUES ('tenant_b', 'Beta', 'beta')");
}, 180_000);

afterAll(async () => {
  await appPool?.end();
  await adminPool?.end();
  await embedded?.stop();
});

describe('Stage 8.3 — migrations (ADR-0048)', () => {
  it('applies all 12 sequential migrations and records them in schema_migrations', async () => {
    const { rows } = await adminPool.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename'
    );
    expect(rows.map((row) => row.filename)).toEqual([
      '0001_core_foundation.sql',
      '0002_iam_foundation.sql',
      '0003_market_data_foundation.sql',
      '0004_financial_precision_currency_semantics.sql',
      '0005_authoritative_pricing_engine.sql',
      '0006_pricing_rule_audit_metadata.sql',
      '0007_catalog_inventory_foundation.sql',
      '0008_catalog_inventory_integrity.sql',
      '0009_seller_marketplace_foundation.sql',
      '0010_seller_marketplace_integrity.sql',
      '0011_seller_os_foundation.sql',
      '0012_row_level_security.sql',
      '0013_ai_conversational_designer.sql',
      '0014_ai_concept_generation.sql',
      '0015_visual_search_foundation.sql',
      '0016_studio_3d_foundation.sql',
      '0017_virtual_try_on_foundation.sql',
      '0018_custom_rfq_foundation.sql',
      '0019_ai_packaging_foundation.sql',
      '0020_commerce_foundation.sql',
      '0021_ai_content_studio_foundation.sql',
      '0022_social_commerce_foundation.sql',
      '0023_trust_safety_foundation.sql',
      '0024_performance_optimization.sql',
    ]);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const result = await runMigrations(adminPool);
    expect(result.applied).toEqual([]);
    expect(result.alreadyApplied.length).toBe(24);
  });

  it('enables + forces RLS with one tenant-isolation policy on every tenant-scoped table', async () => {
    const { rows } = await adminPool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
      policies: string;
    }>(
      `SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
              (SELECT count(*)::text FROM pg_policies p
                WHERE p.schemaname = 'public' AND p.tablename = c.relname
                  AND p.policyname = c.relname || '_tenant_isolation') AS policies
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1)
       ORDER BY c.relname`,
      [[...TENANT_SCOPED_TABLES]]
    );
    expect(rows.length).toBe(17);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
      expect(row.policies).toBe('1');
    }
  });
});

describe('Stage 8.3 — real connection & repositories (ADR-0047)', () => {
  it('round-trips a user through the pg driver + Drizzle (global table)', async () => {
    const users = new DrizzleUserRepository(appDb);
    const email = Email.create('pg-user@vgold.test').unwrap();
    const user = User.create({
      email,
      displayName: 'PG Round Trip',
      passwordHash: PasswordHash.create('$2b$10$abcdefghijklmnopqrstuvwxyz123456').unwrap(),
    }).unwrap();
    await users.save(user);
    const found = await users.findByEmail(email);
    expect(found?.id).toBe(user.id);
    expect(found?.displayName).toBe('PG Round Trip');
  });

  it('round-trips a product and keeps listByTenant tenant-scoped', async () => {
    const products = new DrizzleProductRepository(appDb);
    const tenantA = createEntityId<TenantId>('tenant_a');
    const product = Product.create({
      tenantId: tenantA,
      name: 'PG Product A',
      productType: 'RING',
    }).unwrap();
    await products.save(product);

    const found = await products.findById(product.id, tenantA);
    expect(found?.name).toBe('PG Product A');

    const listed = await products.listByTenant(tenantA);
    expect(listed.some((entry) => entry.id === product.id)).toBe(true);
  });

  it('keeps the cross-tenant existence probe (un-scoped findById) contract', async () => {
    const products = new DrizzleProductRepository(appDb);
    const tenantB = createEntityId<TenantId>('tenant_b');
    const productB = Product.create({
      tenantId: tenantB,
      name: 'PG Product B',
      productType: 'NECKLACE',
    }).unwrap();
    await products.save(productB);

    const scopedMiss = await products.findById(productB.id, createEntityId<TenantId>('tenant_a'));
    expect(scopedMiss).toBeNull();

    const probeHit = await products.findById(productB.id);
    expect(probeHit?.id).toBe(productB.id);
  });

  it('createPersistence: in-memory by default, postgres on DATABASE_ENABLED=true', async () => {
    expect(isPostgresConfigured({})).toBe(false);
    expect(createPersistence({}).mode).toBe('in-memory');

    expect(isPostgresConfigured({ ...appEnv })).toBe(true);

    const persistence = createPersistence({ ...appEnv });
    expect(persistence.mode).toBe('postgres');
    const total = await persistence.productRepository.count();
    expect(total).toBeGreaterThanOrEqual(0);
    await persistence.close();
  });
});

describe('Stage 8.3 — Row-Level Security matrix as vgold_app (ADR-0049)', () => {
  type Row = { id: string; tenant_id: string };

  const selectAs = async (tenantId: string | undefined, text: string): Promise<Row[]> => {
    const run = async (db: PgDatabase<any>): Promise<Row[]> => {
      const result = (await db.execute(sql.raw(text))) as unknown as ResultLike;
      return result.rows as unknown as Row[];
    };
    return tenantId === undefined ? run(appDb) : withTenantContext(appDb, tenantId, run);
  };

  beforeAll(async () => {
    await adminPool.query(
      "INSERT INTO products (id, tenant_id, name, product_type) VALUES ('prod_rls_a1', 'tenant_a', 'RLS prod_rls_a1', 'RING')"
    );
    await adminPool.query(
      "INSERT INTO products (id, tenant_id, name, product_type) VALUES ('prod_rls_b1', 'tenant_b', 'RLS prod_rls_b1', 'RING')"
    );
  });

  it('context-bound SELECT sees only its own tenant rows — even without a WHERE clause', async () => {
    const idsA = (await selectAs('tenant_a', 'SELECT id, tenant_id FROM products')).map((row) => row.id);
    const idsB = (await selectAs('tenant_b', 'SELECT id, tenant_id FROM products')).map((row) => row.id);

    expect(idsA).toContain('prod_rls_a1');
    expect(idsA).not.toContain('prod_rls_b1');
    expect(idsB).toContain('prod_rls_b1');
    expect(idsB).not.toContain('prod_rls_a1');
  });

  it('WITH CHECK refuses writes carrying a foreign tenant_id', async () => {
    await expect(
      withTenantContext(appDb, 'tenant_a', (tx) =>
        tx.execute(
          sql.raw(
            "INSERT INTO products (id, tenant_id, name, product_type) VALUES ('prod_rls_spoof', 'tenant_b', 'Spoofed', 'RING')"
          )
        )
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it('UPDATE/DELETE under a tenant context cannot touch another tenant rows', async () => {
    await selectAs('tenant_a', "UPDATE products SET name = 'hacked' WHERE id = 'prod_rls_b1'");
    await selectAs('tenant_a', "DELETE FROM products WHERE id = 'prod_rls_b1'");

    const { rows } = await adminPool.query<{ name: string }>(
      "SELECT name FROM products WHERE id = 'prod_rls_b1'"
    );
    expect(rows[0]?.name).toBe('RLS prod_rls_b1');
  });

  it('un-scoped reads serve the deliberate global/probe/public branch', async () => {
    const ids = (await selectAs(undefined, 'SELECT id, tenant_id FROM products')).map((row) => row.id);
    expect(ids).toContain('prod_rls_a1');
    expect(ids).toContain('prod_rls_b1');
  });

  it('writes under a context land in the context tenant and are visible to it', async () => {
    await selectAs(
      'tenant_a',
      "INSERT INTO products (id, tenant_id, name, product_type) VALUES ('prod_rls_a2', 'tenant_a', 'Owned', 'RING')"
    );
    const rowsA = await selectAs('tenant_a', "SELECT id FROM products WHERE id = 'prod_rls_a2'");
    expect(rowsA.length).toBe(1);
  });

  it('TenantScopedProductRepository binds repository calls to their tenant context', async () => {
    const raw = new DrizzleProductRepository(appDb);
    const scoped = new TenantScopedProductRepository(raw, appDb);

    const listedA = await scoped.listByTenant(createEntityId<TenantId>('tenant_a'));
    expect(listedA.some((entry) => entry.id === 'prod_rls_a1')).toBe(true);
    expect(listedA.some((entry) => entry.id === 'prod_rls_b1')).toBe(false);

    const probe = await scoped.findById(createEntityId<ProductId>('prod_rls_b1'));
    expect(probe?.id).toBe('prod_rls_b1');

    const scopedMiss = await scoped.findById(
      createEntityId<ProductId>('prod_rls_b1'),
      createEntityId<TenantId>('tenant_a')
    );
    expect(scopedMiss).toBeNull();
  });
});
