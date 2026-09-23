import type {
  InventoryMovementRepositoryPort,
  InventoryMovementListFilter,
  InventoryMovement,
  InventoryMovementId,
  InventoryItemId,
  TenantId,
} from '@v-gold/core';

export class InMemoryInventoryMovementRepository implements InventoryMovementRepositoryPort {
  private readonly movements: InventoryMovement[] = [];

  async record(movement: InventoryMovement): Promise<void> {
    this.movements.push(movement);
  }

  async findById(id: InventoryMovementId, tenantId?: TenantId): Promise<InventoryMovement | null> {
    const mov = this.movements.find((m) => m.id === id);
    if (!mov) return null;

    if (tenantId !== undefined && mov.tenantId !== tenantId) {
      return null;
    }

    return mov;
  }

  async listByItemId(itemId: InventoryItemId, tenantId: TenantId): Promise<InventoryMovement[]> {
    return this.movements
      .filter((m) => m.inventoryItemId === itemId && m.tenantId === tenantId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async listByTenant(
    tenantId: TenantId,
    filter?: InventoryMovementListFilter
  ): Promise<InventoryMovement[]> {
    let result = this.movements
      .filter((m) => m.tenantId === tenantId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    if (filter?.offset !== undefined) {
      result = result.slice(filter.offset);
    }

    if (filter?.limit !== undefined) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  async count(tenantId?: TenantId): Promise<number> {
    if (!tenantId) return this.movements.length;
    return this.movements.filter((m) => m.tenantId === tenantId).length;
  }

  clear(): void {
    this.movements.length = 0;
  }
}
