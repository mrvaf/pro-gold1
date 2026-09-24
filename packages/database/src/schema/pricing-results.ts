import { pgTable, varchar, numeric, timestamp, integer, text, index } from 'drizzle-orm/pg-core';

export const pricingResultsTable = pgTable(
  'pricing_results',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 }),
    storeId: varchar('store_id', { length: 64 }),
    finalAmount: numeric('final_amount', { precision: 24, scale: 4 }).notNull(),
    currency: varchar('currency', { length: 8 }).notNull(),
    ruleId: varchar('rule_id', { length: 64 }).notNull(),
    ruleName: varchar('rule_name', { length: 128 }).notNull(),
    ruleVersion: varchar('rule_version', { length: 32 }).notNull(),
    marketObservationId: varchar('market_observation_id', { length: 64 }).notNull(),
    instrumentSymbol: varchar('instrument_symbol', { length: 64 }).notNull(),
    marketPrice: numeric('market_price', { precision: 24, scale: 8 }).notNull(),
    marketUnit: varchar('market_unit', { length: 32 }).notNull(),
    marketCurrency: varchar('market_currency', { length: 8 }).notNull(),
    marketObservedAt: timestamp('market_observed_at', { withTimezone: true }).notNull(),
    freshnessStatus: varchar('freshness_status', { length: 16 }).notNull(),
    isStaleMarketData: varchar('is_stale_market_data', { length: 8 }).notNull().default('false'),
    weightGrams: numeric('weight_grams', { precision: 16, scale: 6 }).notNull(),
    purityFineness: numeric('purity_fineness', { precision: 6, scale: 4 }).notNull(),
    breakdownJson: text('breakdown_json').notNull(),
    inputsJson: text('inputs_json').notNull(),
    ruleReferenceJson: text('rule_reference_json'),
    roundingMode: varchar('rounding_mode', { length: 32 }).notNull(),
    roundingScale: integer('rounding_scale').notNull(),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pricing_results_tenant_calc_idx').on(
      table.tenantId,
      table.calculatedAt
    ),
    index('pricing_results_obs_idx').on(table.marketObservationId),
  ]
);

export type PricingResultRecord = typeof pricingResultsTable.$inferSelect;
export type InsertPricingResultRecord = typeof pricingResultsTable.$inferInsert;
