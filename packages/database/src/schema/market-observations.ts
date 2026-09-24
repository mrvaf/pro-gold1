import { pgTable, varchar, numeric, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { marketInstrumentsTable } from './market-instruments.js';
import { marketDataSourcesTable } from './market-data-sources.js';

export const marketObservationsTable = pgTable(
  'market_observations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    instrumentId: varchar('instrument_id', { length: 64 })
      .notNull()
      .references(() => marketInstrumentsTable.id, { onDelete: 'restrict' }),
    sourceId: varchar('source_id', { length: 64 })
      .notNull()
      .references(() => marketDataSourcesTable.id, { onDelete: 'restrict' }),
    amount: numeric('amount', { precision: 24, scale: 8 }).notNull(),
    bid: numeric('bid', { precision: 24, scale: 8 }),
    ask: numeric('ask', { precision: 24, scale: 8 }),
    currency: varchar('currency', { length: 8 }).notNull(),
    unit: varchar('unit', { length: 32 }).notNull(),
    quality: varchar('quality', { length: 32 }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    externalId: varchar('external_id', { length: 128 }),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('market_observations_instrument_observed_idx').on(table.instrumentId, table.observedAt),
    index('market_observations_source_observed_idx').on(table.sourceId, table.observedAt),
    uniqueIndex('market_observations_idempotency_idx').on(
      table.sourceId,
      table.instrumentId,
      table.observedAt
    ),
  ]
);

export type MarketObservationRecord = typeof marketObservationsTable.$inferSelect;
export type InsertMarketObservationRecord = typeof marketObservationsTable.$inferInsert;
