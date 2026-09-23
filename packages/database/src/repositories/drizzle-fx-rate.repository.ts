import { and, desc, eq, gte, lte } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type FxRateRepositoryPort,
  FxRate,
  type CurrencyCode,
} from '@v-gold/core';
import { fxRatesTable, type FxRateRecord } from '../schema/fx-rates.js';
import crypto from 'node:crypto';

export const toDomainFxRate = (record: FxRateRecord): FxRate => {
  const result = FxRate.create({
    baseCurrency: record.baseCurrency,
    quoteCurrency: record.quoteCurrency,
    rate: record.rate,
    observedAt: record.observedAt,
    source: record.source,
  });

  if (result.isErr) {
    throw new Error(`Corrupted database FX rate record ${record.id}: ${result.error.message}`);
  }

  return result.value;
};

export class DrizzleFxRateRepository implements FxRateRepositoryPort {
  constructor(private readonly db: PgDatabase<any>) {}

  async save(rate: FxRate): Promise<void> {
    const id = `fx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    await this.db
      .insert(fxRatesTable)
      .values({
        id,
        baseCurrency: rate.baseCurrency,
        quoteCurrency: rate.quoteCurrency,
        rate: rate.rate.toString(),
        observedAt: rate.observedAt,
        source: rate.source,
      })
      .onConflictDoNothing();
  }

  async findLatest(
    base: CurrencyCode,
    quote: CurrencyCode
  ): Promise<FxRate | null> {
    const results = await this.db
      .select()
      .from(fxRatesTable)
      .where(
        and(
          eq(fxRatesTable.baseCurrency, base),
          eq(fxRatesTable.quoteCurrency, quote)
        )
      )
      .orderBy(desc(fxRatesTable.observedAt))
      .limit(1);

    const record = results[0];
    return record ? toDomainFxRate(record) : null;
  }

  async findHistory(
    base: CurrencyCode,
    quote: CurrencyCode,
    from: Date,
    to: Date,
    limit: number = 100
  ): Promise<FxRate[]> {
    const records = await this.db
      .select()
      .from(fxRatesTable)
      .where(
        and(
          eq(fxRatesTable.baseCurrency, base),
          eq(fxRatesTable.quoteCurrency, quote),
          gte(fxRatesTable.observedAt, from),
          lte(fxRatesTable.observedAt, to)
        )
      )
      .orderBy(desc(fxRatesTable.observedAt))
      .limit(limit);

    return records.map(toDomainFxRate);
  }

  async exists(
    base: CurrencyCode,
    quote: CurrencyCode,
    observedAt: Date,
    source: string
  ): Promise<boolean> {
    const results = await this.db
      .select({ id: fxRatesTable.id })
      .from(fxRatesTable)
      .where(
        and(
          eq(fxRatesTable.baseCurrency, base),
          eq(fxRatesTable.quoteCurrency, quote),
          eq(fxRatesTable.observedAt, observedAt),
          eq(fxRatesTable.source, source)
        )
      )
      .limit(1);

    return results.length > 0;
  }

  async count(): Promise<number> {
    const records = await this.db.select().from(fxRatesTable);
    return records.length;
  }
}
