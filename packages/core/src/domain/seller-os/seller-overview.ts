export interface SellerOverviewInventorySummary {
  totalItems: number;
  availableItems: number;
  reservedItems: number;
  inTransitItems: number;
  damagedItems: number;
  lostItems: number;
  soldItems: number;
}

export interface SellerOverviewListingSummary {
  totalListings: number;
  activeListings: number;
  pausedListings: number;
  draftListings: number;
  archivedListings: number;
}

export interface SellerOverviewStaffSummary {
  totalMembers: number;
  activeMembers: number;
  operatorsCount: number;
}

export interface SellerOverviewDto {
  workspaceId: string;
  tenantId: string;
  sellerProfile: {
    id: string;
    displayName: string;
    slug: string;
    status: string;
  };
  store: {
    id: string;
    name: string;
    code: string;
    status: string;
  } | null;
  inventorySummary: SellerOverviewInventorySummary;
  listingSummary: SellerOverviewListingSummary;
  staffSummary: SellerOverviewStaffSummary;
}
