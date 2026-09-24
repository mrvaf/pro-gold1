import { pgTable, varchar, boolean, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const marketDataSourcesTable = pgTable(
  'market_data_sources',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    name: varchar('name', { length: 128 }).notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    description: varchar('description', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('market_data_sources_code_idx').on(table.code),
  ]
);

export type MarketDataSourceRecord = typeof marketDataSourcesTable.$inferSelect;
export type InsertMarketDataSourceRecord = typeof marketDataSourcesTable.$inferInsert;
