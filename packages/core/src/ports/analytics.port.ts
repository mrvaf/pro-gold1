import type { TenantId } from '../domain/tenant/tenant.js';
import type { SellerPerformanceDashboard } from '../domain/analytics/analytics-aggregator.js';

export interface AnalyticsRepositoryPort {
  getSellerPerformanceDashboard(params: {
    tenantId: TenantId;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }): Promise<SellerPerformanceDashboard>;
}
