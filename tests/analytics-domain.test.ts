import { describe, it, expect } from 'vitest';
import {
  AnalyticsAggregator,
  Order,
  OrderLine,
  Money,
  InventoryItem,
  createEntityId,
  type OrderId,
  type TenantId,
  type UserId,
  type InventoryItemId,
  type ProductVariantId,
  type InventoryLocationId,
  type StoreId,
} from '@v-gold/core';
import { Weight } from '@v-gold/core';

describe('Stage 21 — Analytics & Business Intelligence Domain Logic', () => {
  it('accurately aggregates gross revenue, taxes, average order value and inventory turnover', () => {
    const tenantId = createEntityId<TenantId>('tenant_analytics_1');
    const userId = createEntityId<UserId>('usr_1');

    // Create 2 paid orders
    const line1UnitPrice = Money.create('1000', 'USD').unwrap();
    const order1 = Order.create(createEntityId<OrderId>('ord_1'), {
      tenantId,
      userId,
      currency: 'USD',
      lines: [
        new OrderLine({
          orderLineId: 'line_1',
          productId: 'prod_1',
          variantId: 'var_1',
          sku: 'SKU-RING-01',
          title: '18K Yellow Gold Ring',
          unitPrice: line1UnitPrice,
          quantity: 1,
          subtotal: line1UnitPrice,
        }),
      ],
      taxAmount: Money.create('90.00', 'USD').unwrap(),
    });
    order1.markAsPaid({
      provider: 'MOCK_GATEWAY',
      transactionId: 'tx_1',
      paidAmount: order1.totalAmount,
      paidAt: new Date(),
    });

    const line2UnitPrice = Money.create('2000', 'USD').unwrap();
    const order2 = Order.create(createEntityId<OrderId>('ord_2'), {
      tenantId,
      userId,
      currency: 'USD',
      lines: [
        new OrderLine({
          orderLineId: 'line_2',
          productId: 'prod_2',
          variantId: 'var_2',
          sku: 'SKU-BANGLE-01',
          title: '18K Yellow Gold Bangle',
          unitPrice: line2UnitPrice,
          quantity: 1,
          subtotal: line2UnitPrice,
        }),
      ],
      taxAmount: Money.create('180.00', 'USD').unwrap(),
    });
    order2.markAsPaid({
      provider: 'MOCK_GATEWAY',
      transactionId: 'tx_2',
      paidAmount: order2.totalAmount,
      paidAt: new Date(),
    });

    // Mock inventory items: 1 sold, 1 available
    const item1 = {
      status: 'SOLD',
      grossWeight: Weight.fromGrams('10').unwrap(),
    } as any;

    const item2 = {
      status: 'AVAILABLE',
      grossWeight: Weight.fromGrams('15').unwrap(),
    } as any;

    const dashboard = AnalyticsAggregator.aggregate({
      tenantId,
      orders: [order1, order2],
      inventoryItems: [item1, item2],
    });

    // Verify Revenue Metrics
    expect(dashboard.revenue.totalOrders).toBe(2);
    expect(dashboard.revenue.paidOrdersCount).toBe(2);
    expect(dashboard.revenue.totalGrossRevenue['USD']).toBe('3270.00'); // (1000 + 90) + (2000 + 180) = 3270
    expect(dashboard.revenue.totalTaxCollected['USD']).toBe('270.00'); // 90 + 180 = 270
    expect(dashboard.revenue.averageOrderValue['USD']).toBe('1635.00'); // 3270 / 2 = 1635

    // Verify Inventory Turnover Metrics
    expect(dashboard.inventory.totalItems).toBe(2);
    expect(dashboard.inventory.soldItems).toBe(1);
    expect(dashboard.inventory.availableItems).toBe(1);
    expect(dashboard.inventory.turnoverRate).toBe(0.5); // 1 sold / 2 total = 0.5
    expect(dashboard.inventory.totalGoldWeightGrams).toBe(25); // 10g + 15g = 25g
  });
});
