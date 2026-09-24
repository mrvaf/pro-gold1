import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type MarketDataSourceRepositoryPort,
  MarketDataSource,
  createEntityId,
  type MarketDataSourceId,
} from '@v-gold/core';
import { marketDataSourcesTable, type MarketDataSourceRecord } from '../schema/market-data-sources.js';

export const toDomainMarketDataSource = (record: MarketDataSourceRecord): MarketDataSource => {
  return MarketDataSource.reconstitute(
    createEntityId<MarketDataSourceId>(record.id),
    record.name,
    record.code,
    record.description ?? undefined,
    record.isActive,
    record.createdAt,
    record.updatedAt
  );
};

export const toDatabaseMarketDataSource = (source: MarketDataSource): MarketDataSourceRecord => {
  return {
    id: source.id,
    name: source.name,
    code: source.code,
    description: source.description ?? null,
    isActive: source.isActive,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

export class DrizzleMarketDataSourceRepository implements MarketDataSourceRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async findById(id: MarketDataSourceId): Promise<MarketDataSource | null> {
    const results = await this.db
      .select()
      .from(marketDataSourcesTable)
      .where(eq(marketDataSourcesTable.id, id))
      .limit(1);

    const record = results[0];
    return record ? toDomainMarketDataSource(record) : null;
  }

  async findByCode(code: string): Promise<MarketDataSource | null> {
    const results = await this.db
      .select()
      .from(marketDataSourcesTable)
      .where(eq(marketDataSourcesTable.code, code.toUpperCase()))
      .limit(1);

    const record = results[0];
    return record ? toDomainMarketDataSource(record) : null;
  }

  async findAllActive(): Promise<MarketDataSource[]> {
    const records = await this.db
      .select()
      .from(marketDataSourcesTable)
      .where(eq(marketDataSourcesTable.isActive, true));

    return records.map(toDomainMarketDataSource);
  }

  async save(source: MarketDataSource): Promise<void> {
    const record = toDatabaseMarketDataSource(source);
    await this.db
      .insert(marketDataSourcesTable)
      .values(record)
      .onConflictDoUpdate({
        target: marketDataSourcesTable.id,
        set: {
          name: record.name,
          code: record.code,
          description: record.description,
          isActive: record.isActive,
          updatedAt: record.updatedAt,
        },
      });
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(marketDataSourcesTable);
    return records.length;
  }
}
