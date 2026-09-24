import type {
  MarketInstrument,
  MarketInstrumentId,
} from '../domain/market-data/market-instrument.js';

export interface MarketInstrumentRepositoryPort {
  findById(id: MarketInstrumentId): Promise<MarketInstrument | null>;
  findBySymbol(symbol: string): Promise<MarketInstrument | null>;
  findAllActive(): Promise<MarketInstrument[]>;
  save(instrument: MarketInstrument): Promise<void>;
  count(): Promise<number>;
}
