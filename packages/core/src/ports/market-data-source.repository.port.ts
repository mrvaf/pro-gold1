import type {
  MarketDataSource,
  MarketDataSourceId,
} from '../domain/market-data/market-data-source.js';

export interface MarketDataSourceRepositoryPort {
  findById(id: MarketDataSourceId): Promise<MarketDataSource | null>;
  findByCode(code: string): Promise<MarketDataSource | null>;
  findAllActive(): Promise<MarketDataSource[]>;
  save(source: MarketDataSource): Promise<void>;
  count(): Promise<number>;
}
