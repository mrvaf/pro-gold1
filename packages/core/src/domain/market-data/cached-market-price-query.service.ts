import { MarketObservation } from './market-observation.js';
import { MarketInstrumentId, createMarketInstrumentId } from './market-instrument.js';
import { MarketObservationRepositoryPort } from '../../ports/market-observation.repository.port.js';
import { CachePort, InMemoryCache } from '../../common/cache.js';

export interface CachedMarketPriceQueryPort {
  getLatestObservation(instrumentId: string, tenantId?: string): Promise<MarketObservation | null>;
  invalidate(instrumentId: string, tenantId?: string): Promise<void>;
}

export class CachedMarketPriceQueryService implements CachedMarketPriceQueryPort {
  private readonly cache: CachePort<MarketObservation>;

  constructor(
    private readonly repository: MarketObservationRepositoryPort,
    cache?: CachePort<MarketObservation>,
    private readonly ttlMs: number = 30_000 // 30 seconds fresh TTL
  ) {
    this.cache = cache ?? new InMemoryCache<MarketObservation>(ttlMs);
  }

  private buildKey(instrumentId: string, tenantId?: string): string {
    return tenantId ? `market-price:${tenantId}:${instrumentId}` : `market-price:global:${instrumentId}`;
  }

  async getLatestObservation(instrumentId: string, tenantId?: string): Promise<MarketObservation | null> {
    const key = this.buildKey(instrumentId, tenantId);
    const cached = await this.cache.get(key);
    if (cached) {
      return cached;
    }

    const instIdResult = createMarketInstrumentId(instrumentId);
    if (!instIdResult.isOk) {
      return null;
    }

    const latest = await this.repository.findLatestByInstrument(instIdResult.value);
    if (latest) {
      await this.cache.set(key, latest, this.ttlMs);
    }
    return latest;
  }

  async invalidate(instrumentId: string, tenantId?: string): Promise<void> {
    const key = this.buildKey(instrumentId, tenantId);
    await this.cache.delete(key);
  }
}

