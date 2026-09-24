import type {
  FxRate,
  CurrencyCode,
  FxRateRepositoryPort,
} from '@v-gold/core';

export class InMemoryFxRateRepository implements FxRateRepositoryPort {
  private readonly rates: FxRate[] = [];

  private makeKey(rate: FxRate): string {
    return `${rate.baseCurrency}::${rate.quoteCurrency}::${rate.observedAt.toISOString()}::${rate.source}`;
  }

  async save(rate: FxRate): Promise<void> {
    const key = this.makeKey(rate);
    const existingIndex = this.rates.findIndex((r) => this.makeKey(r) === key);
    if (existingIndex >= 0) {
      return; // Idempotent no-op
    }
    this.rates.push(rate);
  }

  async findLatest(base: CurrencyCode, quote: CurrencyCode): Promise<FxRate | null> {
    const matching = this.rates
      .filter((r) => r.baseCurrency === base && r.quoteCurrency === quote)
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

    return matching[0] ?? null;
  }

  async findHistory(
    base: CurrencyCode,
    quote: CurrencyCode,
    from: Date,
    to: Date,
    limit: number = 100
  ): Promise<FxRate[]> {
    return this.rates
      .filter(
        (r) =>
          r.baseCurrency === base &&
          r.quoteCurrency === quote &&
          r.observedAt.getTime() >= from.getTime() &&
          r.observedAt.getTime() <= to.getTime()
      )
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
      .slice(0, limit);
  }

  async exists(
    base: CurrencyCode,
    quote: CurrencyCode,
    observedAt: Date,
    source: string
  ): Promise<boolean> {
    const targetTime = observedAt.getTime();
    return this.rates.some(
      (r) =>
        r.baseCurrency === base &&
        r.quoteCurrency === quote &&
        r.observedAt.getTime() === targetTime &&
        r.source === source
    );
  }

  async count(): Promise<number> {
    return this.rates.length;
  }

  clear(): void {
    this.rates.length = 0;
  }
}
