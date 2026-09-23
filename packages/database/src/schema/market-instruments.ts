import { pgTable, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const marketInstrumentsTable = pgTable(
  'market_instruments',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    symbol: varchar('symbol', { length: 32 }).notNull(),
    baseAsset: varchar('base_asset', { length: 16 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 8 }).notNull(),
    unit: varchar('unit', { length: 32 }).notNull(),
    displayName: varchar('display_name', { length: 128 }).notNull(),
    assetType: varchar('asset_type', { length: 32 }).notNull().default('PRECIOUS_METAL'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('market_instruments_symbol_idx').on(table.symbol),
  ]
);

export type MarketInstrumentRecord = typeof marketInstrumentsTable.$inferSelect;
export type InsertMarketInstrumentRecord = typeof marketInstrumentsTable.$inferInsert;
