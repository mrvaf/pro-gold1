import type { FxRate } from '../domain/finance/fx-rate.js';
import type { CurrencyCode } from '../domain/finance/currency.js';

export interface FxRateRepositoryPort {
  save(rate: FxRate): Promise<void>;
  findLatest(base: CurrencyCode, quote: CurrencyCode): Promise<FxRate | null>;
  findHistory(
    base: CurrencyCode,
    quote: CurrencyCode,
    from: Date,
    to: Date,
    limit?: number
  ): Promise<FxRate[]>;
  exists(
    base: CurrencyCode,
    quote: CurrencyCode,
    observedAt: Date,
    source: string
  ): Promise<boolean>;
  count(): Promise<number>;
}
