import type {
  MarketInstrument,
  MarketInstrumentId,
  MarketInstrumentRepositoryPort,
} from '@v-gold/core';

export class InMemoryMarketInstrumentRepository implements MarketInstrumentRepositoryPort {
  private readonly instruments = new Map<string, MarketInstrument>();

  async findById(id: MarketInstrumentId): Promise<MarketInstrument | null> {
    return this.instruments.get(id) ?? null;
  }

  async findBySymbol(symbol: string): Promise<MarketInstrument | null> {
    const normalized = symbol.trim().toUpperCase();
    for (const instrument of this.instruments.values()) {
      if (instrument.symbol.toUpperCase() === normalized) {
        return instrument;
      }
    }
    return null;
  }

  async findAllActive(): Promise<MarketInstrument[]> {
    return Array.from(this.instruments.values()).filter((i) => i.isActive);
  }

  async save(instrument: MarketInstrument): Promise<void> {
    this.instruments.set(instrument.id, instrument);
  }

  async count(): Promise<number> {
    return this.instruments.size;
  }

  clear(): void {
    this.instruments.clear();
  }
}
