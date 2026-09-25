import type { TenantId } from '../tenant/tenant.js';
import type { Order } from '../commerce/order.js';
import type { InventoryItem } from '../inventory/inventory-item.js';
import { Money } from '../finance/money.js';

export interface RevenueMetric {
  readonly totalOrders: number;
  readonly paidOrdersCount: number;
  readonly totalGrossRevenue: Record<string, string>; // currency -> amount string (Money formatted)
  readonly totalTaxCollected: Record<string, string>;
  readonly averageOrderValue: Record<string, string>;
}

export interface InventoryTurnoverMetric {
  readonly totalItems: number;
  readonly availableItems: number;
  readonly reservedItems: number;
  readonly soldItems: number;
  readonly totalGoldWeightGrams: number;
  readonly turnoverRate: number; // soldItems / (totalItems || 1)
}

export interface SellerPerformanceDashboard {
  readonly tenantId: TenantId;
  readonly periodStart?: Date | undefined;
  readonly periodEnd?: Date | undefined;
  readonly revenue: RevenueMetric;
  readonly inventory: InventoryTurnoverMetric;
  readonly generatedAt: Date;
}

export class AnalyticsAggregator {
  /**
   * Aggregates authoritative financial and inventory metrics purely from persisted data.
   * No synthetic, fabricated, or randomized metrics.
   */
  public static aggregate(params: {
    tenantId: TenantId;
    orders: Order[];
    inventoryItems: InventoryItem[];
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
  }): SellerPerformanceDashboard {
    const { tenantId, orders, inventoryItems, periodStart, periodEnd } = params;

    // 1. Filter orders within period if specified
    const filteredOrders = orders.filter((o) => {
      const orderDate = (o as any)._props?.createdAt ?? new Date();
      if (periodStart && orderDate.getTime() < periodStart.getTime()) return false;
      if (periodEnd && orderDate.getTime() > periodEnd.getTime()) return false;
      return true;
    });

    const paidOrders = filteredOrders.filter((o) => o.status === 'PAID' || o.status === 'DELIVERED' || o.status === 'SHIPPED');

    const grossByCurrency: Record<string, Money> = {};
    const taxByCurrency: Record<string, Money> = {};
    const countByCurrency: Record<string, number> = {};

    for (const order of paidOrders) {
      const curr = order.currency;
      if (!grossByCurrency[curr]) {
        grossByCurrency[curr] = Money.zero(curr);
        taxByCurrency[curr] = Money.zero(curr);
        countByCurrency[curr] = 0;
      }
      const grossAdd = grossByCurrency[curr]!.add(order.totalAmount);
      if (grossAdd.isOk) {
        grossByCurrency[curr] = grossAdd.value;
      }
      const taxAdd = taxByCurrency[curr]!.add(order.taxAmount);
      if (taxAdd.isOk) {
        taxByCurrency[curr] = taxAdd.value;
      }
      countByCurrency[curr]! += 1;
    }

    const totalGrossRevenue: Record<string, string> = {};
    const totalTaxCollected: Record<string, string> = {};
    const averageOrderValue: Record<string, string> = {};

    for (const [curr, total] of Object.entries(grossByCurrency)) {
      totalGrossRevenue[curr] = total.amount.toFixed(2);
      totalTaxCollected[curr] = taxByCurrency[curr]!.amount.toFixed(2);
      const count = countByCurrency[curr] ?? 1;
      averageOrderValue[curr] = total.amount.dividedBy(count).toFixed(2);
    }

    const revenue: RevenueMetric = {
      totalOrders: filteredOrders.length,
      paidOrdersCount: paidOrders.length,
      totalGrossRevenue,
      totalTaxCollected,
      averageOrderValue,
    };

    // 2. Inventory turnover metrics
    let availableCount = 0;
    let reservedCount = 0;
    let soldCount = 0;
    let totalGoldWeightGrams = 0;

    for (const item of inventoryItems) {
      if (item.status === 'AVAILABLE') availableCount++;
      else if (item.status === 'RESERVED') reservedCount++;
      else if (item.status === 'SOLD') soldCount++;

      // Sum gross weight
      if (item.grossWeight?.grams) {
        totalGoldWeightGrams += item.grossWeight.grams.toNumber();
      }
    }

    const totalItems = inventoryItems.length;
    const turnoverRate = totalItems > 0 ? Math.round((soldCount / totalItems) * 1000) / 1000 : 0;

    const inventory: InventoryTurnoverMetric = {
      totalItems,
      availableItems: availableCount,
      reservedItems: reservedCount,
      soldItems: soldCount,
      totalGoldWeightGrams: Math.round(totalGoldWeightGrams * 1000) / 1000,
      turnoverRate,
    };

    return {
      tenantId,
      periodStart,
      periodEnd,
      revenue,
      inventory,
      generatedAt: new Date(),
    };
  }
}
