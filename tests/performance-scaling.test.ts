import { describe, it, expect, vi } from 'vitest';
import { InMemoryCache } from '../packages/core/src/common/cache.js';
import {
  paginateArray,
  parsePaginationParams,
} from '../packages/core/src/common/pagination.js';
import { CachedMarketPriceQueryService } from '../packages/core/src/domain/market-data/cached-market-price-query.service.js';
import { MarketObservation } from '../packages/core/src/domain/market-data/market-observation.js';
import { MarketPrice } from '../packages/core/src/domain/market-data/market-price.js';

describe('Stage 22 — Performance Optimization & Scaling Tests', () => {
  describe('In-Memory Cache Port & Expiration Policy', () => {
    it('sets and gets value before expiration', async () => {
      const cache = new InMemoryCache<string>(5000);
      await cache.set('gold-price-18k', '3450.50', 5000);

      const val = await cache.get('gold-price-18k');
      expect(val).toBe('3450.50');
    });

    it('returns null and purges when value is expired', async () => {
      const cache = new InMemoryCache<string>(10);
      await cache.set('transient-rate', '123.45', 10);

      // Advance time
      await new Promise((resolve) => setTimeout(resolve, 25));

      const val = await cache.get('transient-rate');
      expect(val).toBeNull();
    });

    it('invalidates cache explicitly on demand', async () => {
      const cache = new InMemoryCache<number>(10000);
      await cache.set('rate', 42);
      expect(await cache.get('rate')).toBe(42);

      await cache.delete('rate');
      expect(await cache.get('rate')).toBeNull();
    });
  });

  describe('Bounded Keyset Pagination Helper', () => {
    const items = [
      { id: 'item-1', name: 'Ring A' },
      { id: 'item-2', name: 'Ring B' },
      { id: 'item-3', name: 'Ring C' },
      { id: 'item-4', name: 'Ring D' },
      { id: 'item-5', name: 'Ring E' },
    ];

    it('enforces bounds and defaults for pagination parameters', () => {
      const parsedDefault = parsePaginationParams({});
      expect(parsedDefault.limit).toBe(20);
      expect(parsedDefault.cursor).toBeUndefined();

      const parsedCustom = parsePaginationParams({ limit: '3', cursor: 'item-2' });
      expect(parsedCustom.limit).toBe(3);
      expect(parsedCustom.cursor).toBe('item-2');

      // Clamps limit between 1 and 100
      expect(() => parsePaginationParams({ limit: '500' })).toThrow();
    });

    it('paginates arrays deterministically using cursor', () => {
      // First page
      const page1 = paginateArray(items, { limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.items[0]?.id).toBe('item-1');
      expect(page1.items[1]?.id).toBe('item-2');
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe('item-2');

      // Second page
      const page2 = paginateArray(items, { limit: 2, cursor: page1.nextCursor });
      expect(page2.items.length).toBe(2);
      expect(page2.items[0]?.id).toBe('item-3');
      expect(page2.items[1]?.id).toBe('item-4');
      expect(page2.hasMore).toBe(true);
      expect(page2.nextCursor).toBe('item-4');

      // Third page (last page)
      const page3 = paginateArray(items, { limit: 2, cursor: page2.nextCursor });
      expect(page3.items.length).toBe(1);
      expect(page3.items[0]?.id).toBe('item-5');
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeUndefined();
    });
  });

  describe('CachedMarketPriceQueryService', () => {
    it('caches database query results avoiding repeated lookups', async () => {
      const mockPrice = MarketPrice.create({
        amount: '2500.00',
        currency: 'USD',
        unit: 'GRAM',
      }).unwrap();

      const mockObservation = MarketObservation.create({
        id: 'obs-gold-1',
        sourceId: 'source-1',
        instrumentId: 'inst-gold-usd',
        price: mockPrice,
        observedAt: new Date(),
        rawPayload: '{}',
      }).unwrap();

      const findLatestMock = vi.fn().mockResolvedValue(mockObservation);
      const mockRepo: any = {
        findLatestByInstrument: findLatestMock,
      };

      const cachedService = new CachedMarketPriceQueryService(mockRepo, undefined, 5000);

      // Call 1: Misses cache, calls DB repo
      const res1 = await cachedService.getLatestObservation('inst-gold-usd', 'tenant-1');
      expect(res1).toBe(mockObservation);
      expect(findLatestMock).toHaveBeenCalledTimes(1);

      // Call 2: Hits cache, does not call DB repo again
      const res2 = await cachedService.getLatestObservation('inst-gold-usd', 'tenant-1');
      expect(res2).toBe(mockObservation);
      expect(findLatestMock).toHaveBeenCalledTimes(1);

      // Invalidation clears tenant key
      await cachedService.invalidate('inst-gold-usd', 'tenant-1');

      // Call 3: Misses cache again
      await cachedService.getLatestObservation('inst-gold-usd', 'tenant-1');
      expect(findLatestMock).toHaveBeenCalledTimes(2);
    });
  });
});
