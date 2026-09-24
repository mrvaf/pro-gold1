import type { PricingResult, PricingResultId } from '../domain/pricing/pricing-result.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface PricingResultRepositoryPort {
  save(result: PricingResult): Promise<void>;
  findById(id: PricingResultId, tenantId?: TenantId): Promise<PricingResult | null>;
  findByTenant(tenantId: TenantId, limit?: number): Promise<PricingResult[]>;
  count(): Promise<number>;
}
