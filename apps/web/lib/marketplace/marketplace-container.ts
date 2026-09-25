import type {
  SellerListingRepositoryPort,
  SellerProfileRepositoryPort,
} from '@v-gold/core';
import { createPersistence, type Persistence } from '@v-gold/database';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import { SellerMarketplaceService } from './seller-marketplace.service';

class MarketplaceContainer {
  readonly sellerRepo: SellerProfileRepositoryPort;
  readonly listingRepo: SellerListingRepositoryPort;
  readonly marketplaceService: SellerMarketplaceService;

  constructor(persistence: Persistence = createPersistence()) {
    this.sellerRepo = persistence.sellerProfileRepository;
    this.listingRepo = persistence.sellerListingRepository;
    const catalogContainer = getCatalogContainer();
    this.marketplaceService = new SellerMarketplaceService(
      this.sellerRepo,
      this.listingRepo,
      catalogContainer.storeRepo,
      catalogContainer.productRepo,
      catalogContainer.variantRepo
    );
  }
}

let marketplaceContainerInstance: MarketplaceContainer | null = null;

export function getMarketplaceContainer(): MarketplaceContainer {
  if (!marketplaceContainerInstance) {
    marketplaceContainerInstance = new MarketplaceContainer();
  }
  return marketplaceContainerInstance;
}
