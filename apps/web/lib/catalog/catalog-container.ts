import type {
  ProductRepositoryPort,
  ProductVariantRepositoryPort,
  StoreRepositoryPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { CatalogService } from './catalog-service';

class CatalogContainer {
  readonly productRepo: ProductRepositoryPort;
  readonly variantRepo: ProductVariantRepositoryPort;
  readonly storeRepo: StoreRepositoryPort;
  readonly catalogService: CatalogService;

  constructor(persistence: Persistence = createPersistence()) {
    this.productRepo = persistence.productRepository;
    this.variantRepo = persistence.productVariantRepository;
    this.storeRepo = persistence.storeRepository;
    this.catalogService = new CatalogService(this.productRepo, this.variantRepo, this.storeRepo);
  }
}

let catalogContainerInstance: CatalogContainer | null = null;

export function getCatalogContainer(): CatalogContainer {
  if (!catalogContainerInstance) {
    catalogContainerInstance = new CatalogContainer();
  }
  return catalogContainerInstance;
}
