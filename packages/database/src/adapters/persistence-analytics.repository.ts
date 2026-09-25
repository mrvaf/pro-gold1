import type {
  AnalyticsRepositoryPort,
  SellerPerformanceDashboard,
  TenantId,
  OrderRepositoryPort,
  InventoryItemRepositoryPort,
} from '@v-gold/core';
import { AnalyticsAggregator } from '@v-gold/core';

export class PersistenceAnalyticsRepository implements AnalyticsRepositoryPort {
  constructor(
    private readonly orderRepo: OrderRepositoryPort,
    private readonly inventoryRepo: InventoryItemRepositoryPort
  ) {}

  async getSellerPerformanceDashboard(params: {
    tenantId: TenantId;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }): Promise<SellerPerformanceDashboard> {
    const [orders, inventoryItems] = await Promise.all([
      this.orderRepo.listByTenant(params.tenantId),
      this.inventoryRepo.listByTenant(params.tenantId),
    ]);

    return AnalyticsAggregator.aggregate({
      tenantId: params.tenantId,
      orders,
      inventoryItems,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    });
  }
}
