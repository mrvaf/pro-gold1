import {
  type AnalyticsRepositoryPort,
  type SellerPerformanceDashboard,
  type TenantId,
} from '@v-gold/core';

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepositoryPort) {}

  async getPerformanceDashboard(params: {
    tenantId: string;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }): Promise<SellerPerformanceDashboard> {
    return this.repo.getSellerPerformanceDashboard({
      tenantId: params.tenantId as TenantId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    });
  }
}
