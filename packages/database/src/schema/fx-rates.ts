import { pgTable, varchar, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const fxRatesTable = pgTable(
  'fx_rates',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    baseCurrency: varchar('base_currency', { length: 8 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 8 }).notNull(),
    // Precision 32, scale 16 guarantees up to 16 decimal places to prevent precision loss on micro-currency inverse rates (e.g., IRR/USD)
    rate: numeric('rate', { precision: 32, scale: 16 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    source: varchar('source', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('fx_rates_pair_observed_idx').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.observedAt
    ),
    uniqueIndex('fx_rates_idempotency_idx').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.observedAt,
      table.source
    ),
  ]
);

export type FxRateRecord = typeof fxRatesTable.$inferSelect;
export type InsertFxRateRecord = typeof fxRatesTable.$inferInsert;
