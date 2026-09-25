import type {
  FxRateRepositoryPort,
  InventoryItemRepositoryPort,
  InventoryLocationRepositoryPort,
  InventoryMovementRepositoryPort,
  InventoryUnitOfWorkPort,
  MarketDataSourceRepositoryPort,
  MarketInstrumentRepositoryPort,
  MarketObservationRepositoryPort,
  PricingResultRepositoryPort,
  PricingRuleRepositoryPort,
  ProductRepositoryPort,
  ProductVariantRepositoryPort,
  SellerListingRepositoryPort,
  SellerProfileRepositoryPort,
  SellerWorkspaceRepositoryPort,
  SessionRepositoryPort,
  StoreRepositoryPort,
  TenantMembershipRepositoryPort,
  TenantRepositoryPort,
  UserRepositoryPort,
  DesignSessionRepositoryPort,
  DesignConceptRepositoryPort,
  VectorSearchIndexPort,
  Studio3DAssetRepositoryPort,
  Studio3DStoragePort,
} from '@v-gold/core';
import { createDatabaseConfigFromEnv } from './config.js';
import { InMemoryDesignSessionRepository } from './adapters/in-memory-design-session.repository.js';
import { InMemoryDesignConceptRepository } from './adapters/in-memory-design-concept.repository.js';
import { InMemoryVectorIndexRepository } from './adapters/in-memory-vector-index.repository.js';
import { InMemoryStudio3DAssetRepository } from './adapters/in-memory-studio-3d-asset.repository.js';
import { MockStudio3DStorageAdapter } from './adapters/mock-studio-3d-storage.adapter.js';
import { DrizzleDesignSessionRepository } from './repositories/drizzle-design-session.repository.js';
import { DrizzleDesignConceptRepository } from './repositories/drizzle-design-concept.repository.js';
import { DrizzleProductFeatureEmbeddingRepository } from './repositories/drizzle-product-feature-embedding.repository.js';
import { DrizzleStudio3DAssetRepository } from './repositories/drizzle-studio-3d-asset.repository.js';
import { InMemoryFxRateRepository } from './adapters/in-memory-fx-rate.repository.js';
import { InMemoryInventoryItemRepository } from './adapters/in-memory-inventory-item.repository.js';
import { InMemoryInventoryLocationRepository } from './adapters/in-memory-inventory-location.repository.js';
import { InMemoryInventoryMovementRepository } from './adapters/in-memory-inventory-movement.repository.js';
import { InMemoryInventoryUnitOfWork } from './adapters/in-memory-inventory-unit-of-work.js';
import { InMemoryMarketDataSourceRepository } from './adapters/in-memory-market-data-source.repository.js';
import { InMemoryMarketInstrumentRepository } from './adapters/in-memory-market-instrument.repository.js';
import { InMemoryMarketObservationRepository } from './adapters/in-memory-market-observation.repository.js';
import { InMemoryPricingResultRepository } from './adapters/in-memory-pricing-result.repository.js';
import { InMemoryPricingRuleRepository } from './adapters/in-memory-pricing-rule.repository.js';
import { InMemoryProductRepository } from './adapters/in-memory-product.repository.js';
import { InMemoryProductVariantRepository } from './adapters/in-memory-product-variant.repository.js';
import { InMemorySellerListingRepository } from './adapters/in-memory-seller-listing.repository.js';
import { InMemorySellerProfileRepository } from './adapters/in-memory-seller-profile.repository.js';
import { InMemorySellerWorkspaceRepository } from './adapters/in-memory-seller-workspace.repository.js';
import { InMemorySessionRepository } from './adapters/in-memory-session.repository.js';
import { InMemoryStoreRepository } from './adapters/in-memory-store.repository.js';
import { InMemoryTenantMembershipRepository } from './adapters/in-memory-tenant-membership.repository.js';
import { InMemoryTenantRepository } from './adapters/in-memory-tenant.repository.js';
import { InMemoryUserRepository } from './adapters/in-memory-user.repository.js';
import { DrizzleFxRateRepository } from './repositories/drizzle-fx-rate.repository.js';
import { DrizzleInventoryItemRepository } from './repositories/drizzle-inventory-item.repository.js';
import { DrizzleInventoryLocationRepository } from './repositories/drizzle-inventory-location.repository.js';
import { DrizzleInventoryMovementRepository } from './repositories/drizzle-inventory-movement.repository.js';
import { DrizzleInventoryUnitOfWork } from './repositories/drizzle-inventory-unit-of-work.js';
import { DrizzleMarketDataSourceRepository } from './repositories/drizzle-market-data-source.repository.js';
import { DrizzleMarketInstrumentRepository } from './repositories/drizzle-market-instrument.repository.js';
import { DrizzleMarketObservationRepository } from './repositories/drizzle-market-observation.repository.js';
import { DrizzlePricingResultRepository } from './repositories/drizzle-pricing-result.repository.js';
import { DrizzlePricingRuleRepository } from './repositories/drizzle-pricing-rule.repository.js';
import { DrizzleProductRepository } from './repositories/drizzle-product.repository.js';
import { DrizzleProductVariantRepository } from './repositories/drizzle-product-variant.repository.js';
import { DrizzleSellerListingRepository } from './repositories/drizzle-seller-listing.repository.js';
import { DrizzleSellerProfileRepository } from './repositories/drizzle-seller-profile.repository.js';
import { DrizzleSellerWorkspaceRepository } from './repositories/drizzle-seller-workspace.repository.js';
import { DrizzleSessionRepository } from './repositories/drizzle-session.repository.js';
import { DrizzleStoreRepository } from './repositories/drizzle-store.repository.js';
import { DrizzleTenantMembershipRepository } from './repositories/drizzle-tenant-membership.repository.js';
import { DrizzleTenantRepository } from './repositories/drizzle-tenant.repository.js';
import { DrizzleUserRepository } from './repositories/drizzle-user.repository.js';
import { createPgConnection, type PgConnection } from './pg/connection.js';
import {
  TenantScopedInventoryItemRepository,
  TenantScopedInventoryLocationRepository,
  TenantScopedInventoryMovementRepository,
  TenantScopedInventoryUnitOfWork,
  TenantScopedPricingResultRepository,
  TenantScopedPricingRuleRepository,
  TenantScopedProductRepository,
  TenantScopedProductVariantRepository,
  TenantScopedSellerListingRepository,
  TenantScopedSellerProfileRepository,
  TenantScopedSellerWorkspaceRepository,
  TenantScopedStoreRepository,
  TenantScopedTenantMembershipRepository,
  TenantScopedDesignSessionRepository,
  TenantScopedDesignConceptRepository,
  TenantScopedVectorSearchIndexRepository,
  TenantScopedStudio3DAssetRepository,
} from './pg/tenant-scoped.js';

/**
 * Stage 8.3 — ADR-0047: the persistence composition root.
 *
 * PostgreSQL mode is explicit opt-in (`DATABASE_ENABLED=true`); the connection
 * uses the existing `DATABASE_*` configuration (`createDatabaseConfigFromEnv`).
 * Default mode stays in-memory — byte-for-byte the behavior every existing test
 * pins. In PostgreSQL mode the 12 tenant-scoped repositories (and the inventory
 * unit of work) are wrapped in tenant-context decorators so every call runs
 * under the RLS policy context of its own tenant.
 */
export type PersistenceMode = 'in-memory' | 'postgres';

export interface Persistence {
  readonly mode: PersistenceMode;
  readonly tenantRepository: TenantRepositoryPort;
  readonly storeRepository: StoreRepositoryPort;
  readonly userRepository: UserRepositoryPort;
  readonly tenantMembershipRepository: TenantMembershipRepositoryPort;
  readonly sessionRepository: SessionRepositoryPort;
  readonly marketDataSourceRepository: MarketDataSourceRepositoryPort;
  readonly marketInstrumentRepository: MarketInstrumentRepositoryPort;
  readonly marketObservationRepository: MarketObservationRepositoryPort;
  readonly fxRateRepository: FxRateRepositoryPort;
  readonly pricingRuleRepository: PricingRuleRepositoryPort;
  readonly pricingResultRepository: PricingResultRepositoryPort;
  readonly productRepository: ProductRepositoryPort;
  readonly productVariantRepository: ProductVariantRepositoryPort;
  readonly inventoryLocationRepository: InventoryLocationRepositoryPort;
  readonly inventoryItemRepository: InventoryItemRepositoryPort;
  readonly inventoryMovementRepository: InventoryMovementRepositoryPort;
  readonly inventoryUnitOfWork: InventoryUnitOfWorkPort;
  readonly sellerProfileRepository: SellerProfileRepositoryPort;
  readonly sellerListingRepository: SellerListingRepositoryPort;
  readonly sellerWorkspaceRepository: SellerWorkspaceRepositoryPort;
  readonly designSessionRepository: DesignSessionRepositoryPort;
  readonly designConceptRepository: DesignConceptRepositoryPort;
  readonly vectorSearchIndexRepository: VectorSearchIndexPort;
  readonly studio3dAssetRepository: Studio3DAssetRepositoryPort;
  readonly studio3dStorage: Studio3DStoragePort;
  close(): Promise<void>;
}

export const isPostgresConfigured = (
  env: Record<string, string | undefined> = process.env
): boolean => env['DATABASE_ENABLED'] === 'true';

const createInMemoryPersistence = (): Persistence => {
  const itemRepo = new InMemoryInventoryItemRepository();
  const movementRepo = new InMemoryInventoryMovementRepository();
  return {
    mode: 'in-memory',
    tenantRepository: new InMemoryTenantRepository(),
    storeRepository: new InMemoryStoreRepository(),
    userRepository: new InMemoryUserRepository(),
    tenantMembershipRepository: new InMemoryTenantMembershipRepository(),
    sessionRepository: new InMemorySessionRepository(),
    marketDataSourceRepository: new InMemoryMarketDataSourceRepository(),
    marketInstrumentRepository: new InMemoryMarketInstrumentRepository(),
    marketObservationRepository: new InMemoryMarketObservationRepository(),
    fxRateRepository: new InMemoryFxRateRepository(),
    pricingRuleRepository: new InMemoryPricingRuleRepository(),
    pricingResultRepository: new InMemoryPricingResultRepository(),
    productRepository: new InMemoryProductRepository(),
    productVariantRepository: new InMemoryProductVariantRepository(),
    inventoryLocationRepository: new InMemoryInventoryLocationRepository(),
    inventoryItemRepository: itemRepo,
    inventoryMovementRepository: movementRepo,
    inventoryUnitOfWork: new InMemoryInventoryUnitOfWork(itemRepo, movementRepo),
    sellerProfileRepository: new InMemorySellerProfileRepository(),
    sellerListingRepository: new InMemorySellerListingRepository(),
    sellerWorkspaceRepository: new InMemorySellerWorkspaceRepository(),
    designSessionRepository: new InMemoryDesignSessionRepository(),
    designConceptRepository: new InMemoryDesignConceptRepository(),
    vectorSearchIndexRepository: new InMemoryVectorIndexRepository(),
    studio3dAssetRepository: new InMemoryStudio3DAssetRepository(),
    studio3dStorage: new MockStudio3DStorageAdapter(),
    close: async (): Promise<void> => {
      // in-memory: nothing to release
    },
  };
};

let sharedPgConnection: PgConnection | null = null;

const createDrizzlePersistence = (connection: PgConnection): Persistence => {
  const db = connection.db;
  const itemRepo = new TenantScopedInventoryItemRepository(new DrizzleInventoryItemRepository(db), db);
  const movementRepo = new TenantScopedInventoryMovementRepository(
    new DrizzleInventoryMovementRepository(db),
    db
  );
  return {
    mode: 'postgres',
    tenantRepository: new DrizzleTenantRepository(db),
    storeRepository: new TenantScopedStoreRepository(new DrizzleStoreRepository(db), db),
    userRepository: new DrizzleUserRepository(db),
    tenantMembershipRepository: new TenantScopedTenantMembershipRepository(
      new DrizzleTenantMembershipRepository(db),
      db
    ),
    sessionRepository: new DrizzleSessionRepository(db),
    marketDataSourceRepository: new DrizzleMarketDataSourceRepository(db),
    marketInstrumentRepository: new DrizzleMarketInstrumentRepository(db),
    marketObservationRepository: new DrizzleMarketObservationRepository(db),
    fxRateRepository: new DrizzleFxRateRepository(db),
    pricingRuleRepository: new TenantScopedPricingRuleRepository(new DrizzlePricingRuleRepository(db), db),
    pricingResultRepository: new TenantScopedPricingResultRepository(
      new DrizzlePricingResultRepository(db),
      db
    ),
    productRepository: new TenantScopedProductRepository(new DrizzleProductRepository(db), db),
    productVariantRepository: new TenantScopedProductVariantRepository(
      new DrizzleProductVariantRepository(db),
      db
    ),
    inventoryLocationRepository: new TenantScopedInventoryLocationRepository(
      new DrizzleInventoryLocationRepository(db),
      db
    ),
    inventoryItemRepository: itemRepo,
    inventoryMovementRepository: movementRepo,
    inventoryUnitOfWork: new TenantScopedInventoryUnitOfWork(new DrizzleInventoryUnitOfWork(db), db),
    sellerProfileRepository: new TenantScopedSellerProfileRepository(
      new DrizzleSellerProfileRepository(db),
      db
    ),
    sellerListingRepository: new TenantScopedSellerListingRepository(
      new DrizzleSellerListingRepository(db),
      db
    ),
    sellerWorkspaceRepository: new TenantScopedSellerWorkspaceRepository(
      new DrizzleSellerWorkspaceRepository(db),
      db
    ),
    designSessionRepository: new TenantScopedDesignSessionRepository(
      new DrizzleDesignSessionRepository(db),
      db
    ),
    designConceptRepository: new TenantScopedDesignConceptRepository(
      new DrizzleDesignConceptRepository(db),
      db
    ),
    vectorSearchIndexRepository: new TenantScopedVectorSearchIndexRepository(
      new DrizzleProductFeatureEmbeddingRepository(db),
      db
    ),
    studio3dAssetRepository: new TenantScopedStudio3DAssetRepository(
      new DrizzleStudio3DAssetRepository(db),
      db
    ),
    studio3dStorage: new MockStudio3DStorageAdapter(),
    close: async (): Promise<void> => {
      sharedPgConnection = null;
      await connection.close();
    },
  };
};

export function createPersistence(
  env: Record<string, string | undefined> = process.env
): Persistence {
  if (!isPostgresConfigured(env)) {
    return createInMemoryPersistence();
  }
  if (!sharedPgConnection) {
    sharedPgConnection = createPgConnection(createDatabaseConfigFromEnv(env));
  }
  return createDrizzlePersistence(sharedPgConnection);
}
