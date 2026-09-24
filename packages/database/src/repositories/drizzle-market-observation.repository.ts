import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type MarketObservationRepositoryPort,
  MarketObservation,
  MarketPrice,
  createEntityId,
  type MarketObservationId,
  type MarketInstrumentId,
  type MarketDataSourceId,
  type MarketDataQuality,
} from '@v-gold/core';
import {
  marketObservationsTable,
  type MarketObservationRecord,
} from '../schema/market-observations.js';

export const toDomainMarketObservation = (record: MarketObservationRecord): MarketObservation => {
  const priceResult = MarketPrice.create({
    amount: record.amount,
    currency: record.currency,
    unit: record.unit,
    bid: record.bid ?? undefined,
    ask: record.ask ?? undefined,
  });

  if (priceResult.isErr) {
    throw new Error(`Corrupted database price for observation ${record.id}: ${priceResult.error.message}`);
  }

  return MarketObservation.reconstitute(
    createEntityId<MarketObservationId>(record.id),
    createEntityId<MarketInstrumentId>(record.instrumentId),
    createEntityId<MarketDataSourceId>(record.sourceId),
    priceResult.value,
    record.quality as MarketDataQuality,
    record.observedAt,
    record.ingestedAt,
    record.externalId ?? undefined,
    record.metadata ? (record.metadata as Record<string, unknown>) : undefined
  );
};

export const toDatabaseMarketObservation = (
  observation: MarketObservation
): MarketObservationRecord => {
  return {
    id: observation.id,
    instrumentId: observation.instrumentId,
    sourceId: observation.sourceId,
    amount: observation.price.amount.toString(),
    bid: observation.price.bid ? observation.price.bid.toString() : null,
    ask: observation.price.ask ? observation.price.ask.toString() : null,
    currency: observation.price.currency,
    unit: observation.price.unit,
    quality: observation.quality,
    observedAt: observation.observedAt,
    ingestedAt: observation.ingestedAt,
    externalId: observation.externalId ?? null,
    metadata: observation.metadata ?? null,
  };
};

export class DrizzleMarketObservationRepository implements MarketObservationRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(observation: MarketObservation): Promise<void> {
    const record = toDatabaseMarketObservation(observation);
    await this.db
      .insert(marketObservationsTable)
      .values(record)
      .onConflictDoNothing();
  }

  async saveBatch(observations: MarketObservation[]): Promise<number> {
    if (observations.length === 0) return 0;
    const records = observations.map(toDatabaseMarketObservation);
    const result = await this.db
      .insert(marketObservationsTable)
      .values(records)
      .onConflictDoNothing();

    return Array.isArray(result) ? result.length : observations.length;
  }

  async findLatestByInstrument(
    instrumentId: MarketInstrumentId
  ): Promise<MarketObservation | null> {
    const results = await this.db
      .select()
      .from(marketObservationsTable)
      .where(eq(marketObservationsTable.instrumentId, instrumentId))
      .orderBy(desc(marketObservationsTable.observedAt))
      .limit(1);

    const record = results[0];
    return record ? toDomainMarketObservation(record) : null;
  }

  async findHistory(
    instrumentId: MarketInstrumentId,
    from: Date,
    to: Date,
    limit: number = 100
  ): Promise<MarketObservation[]> {
    const records = await this.db
      .select()
      .from(marketObservationsTable)
      .where(
        and(
          eq(marketObservationsTable.instrumentId, instrumentId),
          gte(marketObservationsTable.observedAt, from),
          lte(marketObservationsTable.observedAt, to)
        )
      )
      .orderBy(desc(marketObservationsTable.observedAt))
      .limit(limit);

    return records.map(toDomainMarketObservation);
  }

  async exists(
    sourceId: MarketDataSourceId,
    instrumentId: MarketInstrumentId,
    observedAt: Date
  ): Promise<boolean> {
    const results = await this.db
      .select({ id: marketObservationsTable.id })
      .from(marketObservationsTable)
      .where(
        and(
          eq(marketObservationsTable.sourceId, sourceId),
          eq(marketObservationsTable.instrumentId, instrumentId),
          eq(marketObservationsTable.observedAt, observedAt)
        )
      )
      .limit(1);

    return results.length > 0;
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(marketObservationsTable);
    return records.length;
  }
}
