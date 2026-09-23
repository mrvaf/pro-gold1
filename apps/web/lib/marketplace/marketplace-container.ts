import {
  InMemorySellerProfileRepository,
  InMemorySellerListingRepository,
} from '@v-gold/database';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import { SellerMarketplaceService } from './seller-marketplace.service';

class MarketplaceContainer {
  readonly sellerRepo = new InMemorySellerProfileRepository();
  readonly listingRepo = new InMemorySellerListingRepository();
  readonly marketplaceService: SellerMarketplaceService;

  constructor() {
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
