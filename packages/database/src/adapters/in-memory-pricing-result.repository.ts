import type {
  PricingResultRepositoryPort,
  PricingResult,
  PricingResultId,
  TenantId,
} from '@v-gold/core';

export class InMemoryPricingResultRepository implements PricingResultRepositoryPort {
  private readonly results = new Map<string, PricingResult>();

  async save(result: PricingResult): Promise<void> {
    this.results.set(result.id, result);
  }

  async findById(id: PricingResultId, tenantId?: TenantId): Promise<PricingResult | null> {
    const result = this.results.get(id);
    if (!result) return null;

    if (tenantId !== undefined && result.tenantId !== tenantId) {
      return null;
    }

    return result;
  }

  async findByTenant(tenantId: TenantId, limit: number = 50): Promise<PricingResult[]> {
    return Array.from(this.results.values())
      .filter((r) => r.tenantId === tenantId)
      .sort((a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime())
      .slice(0, limit);
  }

  async count(): Promise<number> {
    return this.results.size;
  }

  clear(): void {
    this.results.clear();
  }
}
