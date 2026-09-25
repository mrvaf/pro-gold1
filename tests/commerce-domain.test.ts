import { describe, it, expect } from 'vitest';
import {
  Cart,
  CartItem,
  Order,
  OrderLine,
  StockReservation,
  Money,
  createEntityId,
  type CartId,
  type OrderId,
  type StockReservationId,
  type TenantId,
  type UserId,
  InvalidOrderStateTransitionError,
} from '@v-gold/core';

describe('Stage 17 Commerce, Orders & Payments Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-commerce-unit');
  const userId = createEntityId<UserId>('user-commerce-1');

  it('manages cart items, lines calculation, and total summation', () => {
    const cartId = createEntityId<CartId>('cart-1');
    const cart = Cart.create(cartId, tenantId, 'USD', userId);

    expect(cart.items.length).toBe(0);
    expect(cart.total.amount.toNumber()).toBe(0);

    // Add first item
    cart.addItem(
      new CartItem({
        productId: 'prod-1',
        variantId: 'var-1',
        sku: 'RNG-18K-001',
        title: 'Classic Solitaire Ring',
        quantity: 2,
        unitPrice: Money.create('450.00', 'USD').unwrap(),
      })
    );

    expect(cart.items.length).toBe(1);
    expect(cart.items[0]!.lineTotal.amount.toNumber()).toBe(900);
    expect(cart.total.amount.toNumber()).toBe(900);

    // Add item with same variant -> increments quantity
    cart.addItem(
      new CartItem({
        productId: 'prod-1',
        variantId: 'var-1',
        sku: 'RNG-18K-001',
        title: 'Classic Solitaire Ring',
        quantity: 1,
        unitPrice: Money.create('450.00', 'USD').unwrap(),
      })
    );

    expect(cart.items.length).toBe(1);
    expect(cart.items[0]!.quantity).toBe(3);
    expect(cart.total.amount.toNumber()).toBe(1350);
  });

  it('manages stock reservations and TTL expiration', () => {
    const resId = createEntityId<StockReservationId>('res-1');
    const reservation = StockReservation.create(resId, tenantId, 'RNG-18K-001', 2, 15, 'ord-1');

    expect(reservation.sku).toBe('RNG-18K-001');
    expect(reservation.quantity).toBe(2);
    expect(reservation.isCommitted).toBe(false);
    expect(reservation.isExpired()).toBe(false);

    reservation.commit();
    expect(reservation.isCommitted).toBe(true);
    expect(reservation.isExpired()).toBe(false);
  });

  it('enforces order state machine: PENDING_PAYMENT -> PAID -> PROCESSING -> SHIPPED -> DELIVERED', () => {
    const orderId = createEntityId<OrderId>('ord-1');
    const line = new OrderLine({
      orderLineId: 'l1',
      productId: 'prod-1',
      variantId: 'var-1',
      sku: 'RNG-18K-001',
      title: 'Classic Solitaire Ring',
      quantity: 1,
      unitPrice: Money.create('1000.00', 'USD').unwrap(),
      subtotal: Money.create('1000.00', 'USD').unwrap(),
    });

    const order = Order.create(orderId, {
      tenantId,
      userId,
      lines: [line],
      currency: 'USD',
      taxAmount: Money.create('90.00', 'USD').unwrap(),
    });

    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.subtotal.amount.toNumber()).toBe(1000);
    expect(order.taxAmount.amount.toNumber()).toBe(90);
    expect(order.totalAmount.amount.toNumber()).toBe(1090);

    // Cannot jump straight to SHIPPED without paying
    const badTransition = order.markAsShipped();
    expect(badTransition.isErr).toBe(true);
    if (badTransition.isErr) {
      expect(badTransition.error).toBeInstanceOf(InvalidOrderStateTransitionError);
    }

    // Pay order
    const payRes = order.markAsPaid({
      provider: 'STRIPE',
      transactionId: 'ch_test_123',
      paidAmount: order.totalAmount,
      paidAt: new Date(),
    });
    expect(payRes.isOk).toBe(true);
    expect(order.status).toBe('PAID');

    // Processing -> Shipped -> Delivered
    expect(order.markAsProcessing().isOk).toBe(true);
    expect(order.status).toBe('PROCESSING');

    expect(order.markAsShipped().isOk).toBe(true);
    expect(order.status).toBe('SHIPPED');

    expect(order.markAsDelivered().isOk).toBe(true);
    expect(order.status).toBe('DELIVERED');
  });
});
