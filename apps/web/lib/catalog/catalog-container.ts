import {
  InMemoryProductRepository,
  InMemoryProductVariantRepository,
  InMemoryStoreRepository,
} from '@v-gold/database';
import { CatalogService } from './catalog-service';

class CatalogContainer {
  readonly productRepo = new InMemoryProductRepository();
  readonly variantRepo = new InMemoryProductVariantRepository();
  readonly storeRepo = new InMemoryStoreRepository();
  readonly catalogService: CatalogService;

  constructor() {
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
