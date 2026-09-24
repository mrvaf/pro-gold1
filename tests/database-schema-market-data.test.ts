import { describe, expect, it } from 'vitest';
import {
  marketDataSourcesTable,
  marketInstrumentsTable,
  marketObservationsTable,
} from '@v-gold/database';

describe('Market Data Database Schema', () => {
  it('validates marketDataSourcesTable schema definition', () => {
    expect(marketDataSourcesTable.id).toBeDefined();
    expect(marketDataSourcesTable.name).toBeDefined();
    expect(marketDataSourcesTable.code).toBeDefined();
    expect(marketDataSourcesTable.isActive).toBeDefined();
    expect(marketDataSourcesTable.createdAt).toBeDefined();
    expect(marketDataSourcesTable.updatedAt).toBeDefined();
  });

  it('validates marketInstrumentsTable schema definition', () => {
    expect(marketInstrumentsTable.id).toBeDefined();
    expect(marketInstrumentsTable.symbol).toBeDefined();
    expect(marketInstrumentsTable.baseAsset).toBeDefined();
    expect(marketInstrumentsTable.quoteCurrency).toBeDefined();
    expect(marketInstrumentsTable.unit).toBeDefined();
    expect(marketInstrumentsTable.displayName).toBeDefined();
    expect(marketInstrumentsTable.assetType).toBeDefined();
    expect(marketInstrumentsTable.isActive).toBeDefined();
  });

  it('validates marketObservationsTable schema definition with numeric(24, 8) precision', () => {
    expect(marketObservationsTable.id).toBeDefined();
    expect(marketObservationsTable.instrumentId).toBeDefined();
    expect(marketObservationsTable.sourceId).toBeDefined();
    expect(marketObservationsTable.amount).toBeDefined();
    expect(marketObservationsTable.bid).toBeDefined();
    expect(marketObservationsTable.ask).toBeDefined();
    expect(marketObservationsTable.currency).toBeDefined();
    expect(marketObservationsTable.unit).toBeDefined();
    expect(marketObservationsTable.quality).toBeDefined();
    expect(marketObservationsTable.observedAt).toBeDefined();
    expect(marketObservationsTable.ingestedAt).toBeDefined();
    expect(marketObservationsTable.externalId).toBeDefined();
    expect(marketObservationsTable.metadata).toBeDefined();

    // Verify dataType of amount is numeric string
    expect(marketObservationsTable.amount.dataType).toBe('string');
  });
});
