import { Order, type OrderId } from '../domain/commerce/order.js';
import { Cart, type CartId } from '../domain/commerce/cart.js';
import { StockReservation, type StockReservationId } from '../domain/commerce/stock-reservation.js';
import { type TenantId } from '../domain/tenant/tenant.js';
import { type UserId } from '../domain/iam/user.js';

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;
  findById(id: OrderId, tenantId: TenantId): Promise<Order | null>;
  findByIdempotencyKey(key: string, tenantId: TenantId): Promise<Order | null>;
  listByUser(userId: UserId, tenantId: TenantId): Promise<Order[]>;
  listByTenant(tenantId: TenantId): Promise<Order[]>;
}

export interface CartRepositoryPort {
  save(cart: Cart): Promise<void>;
  findById(id: CartId, tenantId: TenantId): Promise<Cart | null>;
  findByUser(userId: UserId, tenantId: TenantId): Promise<Cart | null>;
  delete(id: CartId, tenantId: TenantId): Promise<boolean>;
}

export interface StockReservationRepositoryPort {
  save(reservation: StockReservation): Promise<void>;
  findById(id: StockReservationId, tenantId: TenantId): Promise<StockReservation | null>;
  findBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]>;
  findActiveBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]>;
  commitByOrder(orderId: string, tenantId: TenantId): Promise<void>;
  releaseExpired(tenantId: TenantId): Promise<number>;
}
