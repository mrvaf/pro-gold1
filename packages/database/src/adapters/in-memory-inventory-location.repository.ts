import type {
  InventoryLocationRepositoryPort,
  InventoryLocationListFilter,
  InventoryLocation,
  InventoryLocationId,
  TenantId,
} from '@v-gold/core';

export class InMemoryInventoryLocationRepository implements InventoryLocationRepositoryPort {
  private readonly locations = new Map<string, InventoryLocation>();

  async save(location: InventoryLocation): Promise<void> {
    this.locations.set(location.id, location);
  }

  async findById(id: InventoryLocationId, tenantId?: TenantId): Promise<InventoryLocation | null> {
    const loc = this.locations.get(id);
    if (!loc) return null;

    if (tenantId !== undefined && loc.tenantId !== tenantId) {
      return null;
    }

    return loc;
  }

  async findByCode(code: string, tenantId: TenantId): Promise<InventoryLocation | null> {
    const trimmed = code.trim().toUpperCase();
    for (const loc of this.locations.values()) {
      if (loc.tenantId === tenantId && loc.code === trimmed) {
        return loc;
      }
    }
    return null;
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryLocationListFilter
  ): Promise<InventoryLocation[]> {
    let result = Array.from(this.locations.values()).filter((l) => l.tenantId === tenantId);

    if (filter?.storeId) {
      result = result.filter((l) => l.storeId === filter.storeId);
    }

    if (filter?.status) {
      result = result.filter((l) => l.status === filter.status);
    }

    return result;
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.locations.size;
    return Array.from(this.locations.values()).filter((l) => l.tenantId === tenantId).length;
  }

  clear(): void {
    this.locations.clear();
  }
}
