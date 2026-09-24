import type {
  MarketDataSource,
  MarketDataSourceId,
  MarketDataSourceRepositoryPort,
} from '@v-gold/core';

export class InMemoryMarketDataSourceRepository implements MarketDataSourceRepositoryPort {
  private readonly sources = new Map<string, MarketDataSource>();

  async findById(id: MarketDataSourceId): Promise<MarketDataSource | null> {
    return this.sources.get(id) ?? null;
  }

  async findByCode(code: string): Promise<MarketDataSource | null> {
    const normalized = code.trim().toUpperCase();
    for (const source of this.sources.values()) {
      if (source.code.toUpperCase() === normalized) {
        return source;
      }
    }
    return null;
  }

  async findAllActive(): Promise<MarketDataSource[]> {
    return Array.from(this.sources.values()).filter((s) => s.isActive);
  }

  async save(source: MarketDataSource): Promise<void> {
    this.sources.set(source.id, source);
  }

  async count(): Promise<number> {
    return this.sources.size;
  }

  clear(): void {
    this.sources.clear();
  }
}
