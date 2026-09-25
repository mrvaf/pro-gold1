import { eq, and, gt } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type OrderRepositoryPort,
  type CartRepositoryPort,
  type StockReservationRepositoryPort,
  Order,
  Cart,
  StockReservation,
  OrderLine,
  CartItem,
  Money,
  createEntityId,
  type OrderId,
  type CartId,
  type StockReservationId,
  type TenantId,
  type UserId,
  type OrderStatus,
  type PaymentDetails,
} from '@v-gold/core';
import { cartsTable, ordersTable, stockReservationsTable } from '../schema/commerce.js';

export class DrizzleCartRepository implements CartRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  private mapToDomain(row: typeof cartsTable.$inferSelect): Cart {
    const rawItems = (row.items as any[]) || [];
    const items = rawItems.map(
      (i) =>
        new CartItem({
          productId: i.productId,
          variantId: i.variantId,
          sku: i.sku,
          title: i.title,
          quantity: Number(i.quantity),
          unitPrice: Money.create(i.unitPrice.amount, i.unitPrice.currency).unwrap(),
        })
    );

    return new Cart(createEntityId<CartId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      userId: row.userId ? createEntityId<UserId>(row.userId) : undefined,
      currency: row.currency as any,
      items,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(cart: Cart): Promise<void> {
    await this.db
      .insert(cartsTable)
      .values({
        id: cart.id,
        tenantId: cart.tenantId,
        userId: cart.userId ?? null,
        currency: cart.currency,
        items: cart.items.map((i) => i.toJSON()),
        createdAt: (cart as any)._props.createdAt,
        updatedAt: (cart as any)._props.updatedAt,
      })
      .onConflictDoUpdate({
        target: cartsTable.id,
        set: {
          userId: cart.userId ?? null,
          currency: cart.currency,
          items: cart.items.map((i) => i.toJSON()),
          updatedAt: (cart as any)._props.updatedAt,
        },
      });
  }

  async findById(id: CartId, tenantId: TenantId): Promise<Cart | null> {
    const rows = await this.db
      .select()
      .from(cartsTable)
      .where(and(eq(cartsTable.id, id), eq(cartsTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByUser(userId: UserId, tenantId: TenantId): Promise<Cart | null> {
    const rows = await this.db
      .select()
      .from(cartsTable)
      .where(and(eq(cartsTable.userId, userId), eq(cartsTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async delete(id: CartId, tenantId: TenantId): Promise<boolean> {
    const result = await this.db
      .delete(cartsTable)
      .where(and(eq(cartsTable.id, id), eq(cartsTable.tenantId, tenantId)));

    return (result.rowCount ?? 0) > 0;
  }
}

export class DrizzleOrderRepository implements OrderRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  private mapToDomain(row: typeof ordersTable.$inferSelect): Order {
    const rawLines = (row.lines as any[]) || [];
    const lines = rawLines.map(
      (l) =>
        new OrderLine({
          orderLineId: l.orderLineId,
          productId: l.productId,
          variantId: l.variantId,
          sku: l.sku,
          title: l.title,
          quantity: Number(l.quantity),
          unitPrice: Money.create(l.unitPrice.amount, l.unitPrice.currency).unwrap(),
          subtotal: Money.create(l.subtotal.amount, l.subtotal.currency).unwrap(),
        })
    );

    const subtotalRaw = row.subtotal as any;
    const taxRaw = row.taxAmount as any;
    const totalRaw = row.totalAmount as any;

    let paymentDetails: PaymentDetails | undefined;
    if (row.paymentDetails) {
      const p = row.paymentDetails as any;
      paymentDetails = {
        provider: p.provider,
        transactionId: p.transactionId,
        paidAmount: Money.create(p.paidAmount.amount, p.paidAmount.currency).unwrap(),
        paidAt: new Date(p.paidAt),
      };
    }

    return new Order(createEntityId<OrderId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      userId: createEntityId<UserId>(row.userId),
      status: row.status as OrderStatus,
      lines,
      currency: row.currency as any,
      subtotal: Money.create(subtotalRaw.amount, subtotalRaw.currency).unwrap(),
      taxAmount: Money.create(taxRaw.amount, taxRaw.currency).unwrap(),
      totalAmount: Money.create(totalRaw.amount, totalRaw.currency).unwrap(),
      idempotencyKey: row.idempotencyKey ?? undefined,
      paymentDetails,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async save(order: Order): Promise<void> {
    await this.db
      .insert(ordersTable)
      .values({
        id: order.id,
        tenantId: order.tenantId,
        userId: order.userId,
        status: order.status,
        lines: order.lines.map((l) => l.toJSON()),
        currency: order.currency,
        subtotal: {
          amount: order.subtotal.amount.toString(),
          currency: order.subtotal.currency,
        },
        taxAmount: {
          amount: order.taxAmount.amount.toString(),
          currency: order.taxAmount.currency,
        },
        totalAmount: {
          amount: order.totalAmount.amount.toString(),
          currency: order.totalAmount.currency,
        },
        idempotencyKey: order.idempotencyKey ?? null,
        paymentDetails: order.paymentDetails
          ? {
              provider: order.paymentDetails.provider,
              transactionId: order.paymentDetails.transactionId,
              paidAmount: {
                amount: order.paymentDetails.paidAmount.amount.toString(),
                currency: order.paymentDetails.paidAmount.currency,
              },
              paidAt: order.paymentDetails.paidAt.toISOString(),
            }
          : null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })
      .onConflictDoUpdate({
        target: ordersTable.id,
        set: {
          status: order.status,
          lines: order.lines.map((l) => l.toJSON()),
          subtotal: {
            amount: order.subtotal.amount.toString(),
            currency: order.subtotal.currency,
          },
          taxAmount: {
            amount: order.taxAmount.amount.toString(),
            currency: order.taxAmount.currency,
          },
          totalAmount: {
            amount: order.totalAmount.amount.toString(),
            currency: order.totalAmount.currency,
          },
          paymentDetails: order.paymentDetails
            ? {
                provider: order.paymentDetails.provider,
                transactionId: order.paymentDetails.transactionId,
                paidAmount: {
                  amount: order.paymentDetails.paidAmount.amount.toString(),
                  currency: order.paymentDetails.paidAmount.currency,
                },
                paidAt: order.paymentDetails.paidAt.toISOString(),
              }
            : null,
          updatedAt: order.updatedAt,
        },
      });
  }

  async findById(id: OrderId, tenantId: TenantId): Promise<Order | null> {
    const rows = await this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.id, id), eq(ordersTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async findByIdempotencyKey(key: string, tenantId: TenantId): Promise<Order | null> {
    const rows = await this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.idempotencyKey, key), eq(ordersTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async listByUser(userId: UserId, tenantId: TenantId): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(ordersTable)
      .where(and(eq(ordersTable.userId, userId), eq(ordersTable.tenantId, tenantId)));

    return rows.map((r) => this.mapToDomain(r));
  }

  async listByTenant(tenantId: TenantId): Promise<Order[]> {
    const rows = await this.db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.tenantId, tenantId));

    return rows.map((r) => this.mapToDomain(r));
  }
}

export class DrizzleStockReservationRepository implements StockReservationRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  private mapToDomain(row: typeof stockReservationsTable.$inferSelect): StockReservation {
    return new StockReservation(createEntityId<StockReservationId>(row.id), {
      tenantId: createEntityId<TenantId>(row.tenantId),
      orderId: row.orderId ?? undefined,
      sku: row.sku,
      quantity: row.quantity,
      expiresAt: row.expiresAt,
      isCommitted: row.isCommitted,
      createdAt: row.createdAt,
    });
  }

  async save(res: StockReservation): Promise<void> {
    await this.db
      .insert(stockReservationsTable)
      .values({
        id: res.id,
        tenantId: res.tenantId,
        orderId: res.orderId ?? null,
        sku: res.sku,
        quantity: res.quantity,
        expiresAt: res.expiresAt,
        isCommitted: res.isCommitted,
        createdAt: (res as any)._props.createdAt,
      })
      .onConflictDoUpdate({
        target: stockReservationsTable.id,
        set: {
          orderId: res.orderId ?? null,
          isCommitted: res.isCommitted,
        },
      });
  }

  async findById(id: StockReservationId, tenantId: TenantId): Promise<StockReservation | null> {
    const rows = await this.db
      .select()
      .from(stockReservationsTable)
      .where(and(eq(stockReservationsTable.id, id), eq(stockReservationsTable.tenantId, tenantId)))
      .limit(1);

    if (!rows.length || !rows[0]) return null;
    return this.mapToDomain(rows[0]);
  }

  async findBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]> {
    const rows = await this.db
      .select()
      .from(stockReservationsTable)
      .where(and(eq(stockReservationsTable.sku, sku), eq(stockReservationsTable.tenantId, tenantId)));

    return rows.map((r) => this.mapToDomain(r));
  }

  async findActiveBySku(sku: string, tenantId: TenantId): Promise<StockReservation[]> {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(stockReservationsTable)
      .where(
        and(
          eq(stockReservationsTable.sku, sku),
          eq(stockReservationsTable.tenantId, tenantId),
          eq(stockReservationsTable.isCommitted, false),
          gt(stockReservationsTable.expiresAt, now)
        )
      );

    return rows.map((r) => this.mapToDomain(r));
  }

  async commitByOrder(orderId: string, tenantId: TenantId): Promise<void> {
    await this.db
      .update(stockReservationsTable)
      .set({ isCommitted: true })
      .where(and(eq(stockReservationsTable.orderId, orderId), eq(stockReservationsTable.tenantId, tenantId)));
  }

  async releaseExpired(tenantId: TenantId): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(stockReservationsTable)
      .where(
        and(
          eq(stockReservationsTable.tenantId, tenantId),
          eq(stockReservationsTable.isCommitted, false),
          eq(stockReservationsTable.expiresAt, now)
        )
      );

    return result.rowCount ?? 0;
  }
}
