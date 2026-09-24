import type {
  PricingRuleRepositoryPort,
  PricingRule,
  PricingRuleId,
  TenantId,
} from '@v-gold/core';

export class InMemoryPricingRuleRepository implements PricingRuleRepositoryPort {
  private readonly rules = new Map<string, PricingRule>();

  async save(rule: PricingRule): Promise<void> {
    this.rules.set(rule.id, rule);
  }

  async findById(id: PricingRuleId, tenantId?: TenantId): Promise<PricingRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;

    if (tenantId !== undefined) {
      if (rule.tenantId !== undefined && rule.tenantId !== tenantId) {
        return null;
      }
    }

    return rule;
  }

  async findEffective(params: {
    atDate: Date;
    tenantId?: TenantId | undefined;
    ruleId?: PricingRuleId | undefined;
    includeReferenceSamples?: boolean | undefined;
  }): Promise<PricingRule | null> {
    const all = Array.from(this.rules.values());

    const matching = all.filter((r) => {
      if (!r.isEffectiveAt(params.atDate)) return false;
      if (params.ruleId && r.id !== params.ruleId) return false;

      // Filter out reference sample rules from silent default selection
      if (!params.ruleId && !params.includeReferenceSamples && r.isReferenceSample) {
        return false;
      }

      if (params.tenantId) {
        return r.tenantId === params.tenantId || r.tenantId === undefined;
      } else {
        return r.tenantId === undefined;
      }
    });

    if (matching.length === 0) return null;

    // Prefer tenant-specific over system, then newest effectiveFrom
    matching.sort((a, b) => {
      if (a.tenantId && !b.tenantId) return -1;
      if (!a.tenantId && b.tenantId) return 1;
      return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
    });

    return matching[0] ?? null;
  }

  async listByTenant(
    tenantId?: TenantId,
    includeReferenceSamples: boolean = false
  ): Promise<PricingRule[]> {
    return Array.from(this.rules.values()).filter((r) => {
      if (!includeReferenceSamples && r.isReferenceSample) return false;
      if (tenantId) {
        return r.tenantId === tenantId || r.tenantId === undefined;
      }
      return r.tenantId === undefined;
    });
  }

  async count(): Promise<number> {
    return this.rules.size;
  }

  clear(): void {
    this.rules.clear();
  }
}
