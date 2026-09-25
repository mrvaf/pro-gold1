import type {
  CustomManufacturingRfq,
  RfqId,
  RfqRepositoryPort,
  TenantId,
  UserId,
} from '@v-gold/core';

export class InMemoryRfqRepository implements RfqRepositoryPort {
  private readonly rfqs = new Map<string, CustomManufacturingRfq>();

  async save(rfq: CustomManufacturingRfq): Promise<void> {
    this.rfqs.set(rfq.id, rfq);
  }

  async findById(id: RfqId, tenantId?: TenantId): Promise<CustomManufacturingRfq | null> {
    const rfq = this.rfqs.get(id);
    if (!rfq) return null;
    if (tenantId && rfq.tenantId !== tenantId) return null;
    return rfq;
  }

  async listByParticipant(userId: UserId, tenantId: TenantId): Promise<CustomManufacturingRfq[]> {
    return Array.from(this.rfqs.values()).filter(
      (r) =>
        r.tenantId === tenantId &&
        (r.customerId === userId ||
          r.sellerId === userId ||
          r.assignedGoldsmithId === userId ||
          r.proposals.some((p) => p.goldsmithId === userId))
    );
  }

  async delete(id: RfqId, tenantId?: TenantId): Promise<void> {
    const rfq = this.rfqs.get(id);
    if (rfq) {
      if (tenantId && rfq.tenantId !== tenantId) return;
      this.rfqs.delete(id);
    }
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.rfqs.size;
    return Array.from(this.rfqs.values()).filter((r) => r.tenantId === tenantId).length;
  }

  clear(): void {
    this.rfqs.clear();
  }
}
