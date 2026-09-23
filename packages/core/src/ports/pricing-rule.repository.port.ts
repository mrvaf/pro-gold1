import type { PricingRule, PricingRuleId } from '../domain/pricing/pricing-rule.js';
import type { TenantId } from '../domain/tenant/tenant.js';

export interface PricingRuleRepositoryPort {
  save(rule: PricingRule): Promise<void>;
  findById(id: PricingRuleId, tenantId?: TenantId): Promise<PricingRule | null>;
  findEffective(params: {
    atDate: Date;
    tenantId?: TenantId | undefined;
    ruleId?: PricingRuleId | undefined;
  }): Promise<PricingRule | null>;
  listByTenant(tenantId?: TenantId): Promise<PricingRule[]>;
  count(): Promise<number>;
}
