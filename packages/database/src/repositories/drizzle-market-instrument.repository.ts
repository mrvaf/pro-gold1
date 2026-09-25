import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type MarketInstrumentRepositoryPort,
  MarketInstrument,
  createEntityId,
  type MarketInstrumentId,
  type CurrencyCode,
  type MarketUnitCode,
  type MarketAssetType,
} from '@v-gold/core';
import { marketInstrumentsTable, type MarketInstrumentRecord } from '../schema/market-instruments.js';

export const toDomainMarketInstrument = (record: MarketInstrumentRecord): MarketInstrument => {
  return MarketInstrument.reconstitute(
    createEntityId<MarketInstrumentId>(record.id),
    record.symbol,
    record.baseAsset,
    record.quoteCurrency as CurrencyCode,
    record.unit as MarketUnitCode,
    record.displayName,
    record.assetType as MarketAssetType,
    record.isActive,
    record.createdAt,
    record.updatedAt
  );
};

export const toDatabaseMarketInstrument = (instrument: MarketInstrument): MarketInstrumentRecord => {
  return {
    id: instrument.id,
    symbol: instrument.symbol,
    baseAsset: instrument.baseAsset,
    quoteCurrency: instrument.quoteCurrency,
    unit: instrument.unit,
    displayName: instrument.displayName,
    assetType: instrument.assetType,
    isActive: instrument.isActive,
    createdAt: instrument.createdAt,
    updatedAt: instrument.updatedAt,
  };
};

export class DrizzleMarketInstrumentRepository implements MarketInstrumentRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async findById(id: MarketInstrumentId): Promise<MarketInstrument | null> {
    const results = await this.db
      .select()
      .from(marketInstrumentsTable)
      .where(eq(marketInstrumentsTable.id, id))
      .limit(1);

    const record = results[0];
    return record ? toDomainMarketInstrument(record) : null;
  }

  async findBySymbol(symbol: string): Promise<MarketInstrument | null> {
    const results = await this.db
      .select()
      .from(marketInstrumentsTable)
      .where(eq(marketInstrumentsTable.symbol, symbol.toUpperCase()))
      .limit(1);

    const record = results[0];
    return record ? toDomainMarketInstrument(record) : null;
  }

  async findAllActive(): Promise<MarketInstrument[]> {
    const records = await this.db
      .select()
      .from(marketInstrumentsTable)
      .where(eq(marketInstrumentsTable.isActive, true));

    return records.map(toDomainMarketInstrument);
  }

  async save(instrument: MarketInstrument): Promise<void> {
    const record = toDatabaseMarketInstrument(instrument);
    await this.db
      .insert(marketInstrumentsTable)
      .values(record)
      .onConflictDoUpdate({
        target: marketInstrumentsTable.id,
        set: {
          symbol: record.symbol,
          baseAsset: record.baseAsset,
          quoteCurrency: record.quoteCurrency,
          unit: record.unit,
          displayName: record.displayName,
          assetType: record.assetType,
          isActive: record.isActive,
          updatedAt: record.updatedAt,
        },
      });
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(marketInstrumentsTable);
    return records.length;
  }
}
