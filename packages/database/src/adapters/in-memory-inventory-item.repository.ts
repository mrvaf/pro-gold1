import type {
  InventoryItemRepositoryPort,
  InventoryItemListFilter,
  InventoryItem,
  InventoryItemId,
  InventoryLocationId,
  ProductVariantId,
  TenantId,
} from '@v-gold/core';

export class InMemoryInventoryItemRepository implements InventoryItemRepositoryPort {
  private readonly items = new Map<string, InventoryItem>();

  async save(item: InventoryItem): Promise<void> {
    this.items.set(item.id, item);
  }

  async findById(id: InventoryItemId, tenantId?: TenantId): Promise<InventoryItem | null> {
    const item = this.items.get(id);
    if (!item) return null;

    if (tenantId !== undefined && item.tenantId !== tenantId) {
      return null;
    }

    return item;
  }

  async findBySerialNumber(serial: string, tenantId: TenantId): Promise<InventoryItem | null> {
    const trimmed = serial.trim();
    for (const item of this.items.values()) {
      if (item.tenantId === tenantId && item.serialNumber === trimmed) {
        return item;
      }
    }
    return null;
  }

  async listByVariantId(
    variantId: ProductVariantId,
    tenantId: TenantId
  ): Promise<InventoryItem[]> {
    return Array.from(this.items.values()).filter(
      (item) => item.productVariantId === variantId && item.tenantId === tenantId
    );
  }

  async listByLocation(
    locationId: InventoryLocationId,
    tenantId: TenantId
  ): Promise<InventoryItem[]> {
    return Array.from(this.items.values()).filter(
      (item) => item.locationId === locationId && item.tenantId === tenantId
    );
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryItemListFilter
  ): Promise<InventoryItem[]> {
    let result = Array.from(this.items.values()).filter((item) => item.tenantId === tenantId);

    if (filter?.status) {
      result = result.filter((item) => item.status === filter.status);
    }

    result.sort((a, b) => b.audit.createdAt.getTime() - a.audit.createdAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.items.size;
    return Array.from(this.items.values()).filter((item) => item.tenantId === tenantId).length;
  }

  clear(): void {
    this.items.clear();
  }
}
