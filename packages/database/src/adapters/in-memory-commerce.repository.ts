import {
  type OrderRepositoryPort,
  type CartRepositoryPort,
  type StockReservationRepositoryPort,
  Order,
  Cart,
  StockReservation,
  createEntityId,
  type OrderId,
  type CartId,
  type StockReservationId,
  type TenantId,
  type UserId,
} from '@v-gold/core';

export class InMemoryOrderRepository implements OrderRepositoryPort {
  private readonly items = new Map<string, Order>();

  private key(id: string, tenantId: string): string {
    return `${tenantId}:${id}`;
  }

  async save(order: Order): Promise<void> {
    this.items.set(this.key(order.id, order.tenantId), order);
  }

  async findById(id: OrderId, tenantId: TenantId): Promise<Order | null> {
    return this.items.get(this.key(id, tenantId)) ?? null;
  }

  async findByIdempotencyKey(key: string, tenantId: TenantId): Promise<Order | null> {
    for (const order of this.items.values()) {
      if (order.tenantId === tenantId && order.idempotencyKey === key) {
        return order;
      }
    }
    return null;
  }

  async listByUser(userId: UserId, tenantId: TenantId): Promise<Order[]> {
    const results: Order[] = [];
    for (const order of this.items.values()) {
      if (order.tenantId === tenantId && order.userId === userId) {
        results.push(order);
      }
    }
    return results;
  }

  async listByTenant(tenantId: TenantId): Promise<Order[]> {
    const results: Order[] = [];
    for (const order of this.items.values()) {
      if (order.tenantId === tenantId) {
        results.push(order);
      }
    }
    return results;
  }
}

export class InMemoryCartRepository implements CartRepositoryPort {
  private readonly items = new Map<string, Cart>();

  private key(id: string, tenantId: string): string {
    return `${tenantId}:${id}`;
  }

  async save(cart: Cart): Promise<void> {
    this.items.set(this.key(cart.id, cart.tenantId), cart);
  }

  async findById(id: CartId, tenantId: TenantId): Promise<Cart | null> {
    return this.items.get(this.key(id, tenantId)) ?? null;
  }

  async findByUser(userId: UserId, tenantId: TenantId): Promise<Cart | null> {
    for (const cart of this.items.values()) {
      if (cart.tenantId === tenantId && cart.userId === userId) {
        return cart;
      }
    }
    return null;
  }

  async delete(id: CartId, tenantId: TenantId): Promise<boolean> {
    return this.items.delete(this.key(id, tenantId));
  }
}

export class InMemoryStockReservationRepository implements StockReservationRepositoryPort {
  private readonly items = new Map<string, StockReservation>();

  private key(id: string, tenantId: string): string {
    return `${tenantId}:${id}`;
  }

  async save(res: StockReservation): Promise<void> {
    this.items.set(this.key(res.id, res.tenantId), res);
  }

  async findById(id: StockReservationId, tenantId: TenantId): Promise<StockReservation | null> {
    return this.items.get(this.key(id, tenantId)) ?? null;
  }

  async findBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]> {
    const list: StockReservation[] = [];
    for (const r of this.items.values()) {
      if (r.tenantId === tenantId && r.sku === sku) {
        list.push(r);
      }
    }
    return list;
  }

  async findActiveBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]> {
    const list: StockReservation[] = [];
    for (const r of this.items.values()) {
      if (r.tenantId === tenantId && r.sku === sku && !r.isExpired()) {
        list.push(r);
      }
    }
    return list;
  }

  async commitByOrder(orderId: string, tenantId: TenantId): Promise<void> {
    for (const r of this.items.values()) {
      if (r.tenantId === tenantId && r.orderId === orderId) {
        r.commit();
      }
    }
  }

  async releaseExpired(tenantId: TenantId): Promise<number> {
    let released = 0;
    for (const [key, r] of this.items.entries()) {
      if (r.tenantId === tenantId && r.isExpired()) {
        this.items.delete(key);
        released++;
      }
    }
    return released;
  }
}
