import { InMemorySellerWorkspaceRepository } from '@v-gold/database';
import { getDefaultAuthService } from '@/lib/auth/auth.service';
import { getCatalogContainer } from '@/lib/catalog/catalog-container';
import { getInventoryContainer } from '@/lib/inventory/inventory-container';
import { getMarketplaceContainer } from '@/lib/marketplace/marketplace-container';
import { SellerOsService } from './seller-os.service';

export class SellerOsContainer {
  readonly workspaceRepo = new InMemorySellerWorkspaceRepository();
  readonly sellerOsService: SellerOsService;

  constructor() {
    const authService = getDefaultAuthService();
    const catalogContainer = getCatalogContainer();
    const inventoryContainer = getInventoryContainer();
    const marketplaceContainer = getMarketplaceContainer();

    this.sellerOsService = new SellerOsService(
      this.workspaceRepo,
      marketplaceContainer.sellerRepo,
      authService.tenantRepository,
      catalogContainer.storeRepo,
      authService.membershipRepository,
      authService.userRepository,
      inventoryContainer.itemRepo,
      inventoryContainer.locationRepo,
      inventoryContainer.uow,
      marketplaceContainer.listingRepo,
      inventoryContainer.inventoryService,
      marketplaceContainer.marketplaceService
    );
  }
}

let sellerOsContainerInstance: SellerOsContainer | null = null;

export function getSellerOsContainer(): SellerOsContainer {
  if (!sellerOsContainerInstance) {
    sellerOsContainerInstance = new SellerOsContainer();
  }
  return sellerOsContainerInstance;
}
