import type {
  MarketObservation,
  MarketObservationId,
  MarketInstrumentId,
  MarketDataSourceId,
  MarketObservationRepositoryPort,
} from '@v-gold/core';

export class InMemoryMarketObservationRepository implements MarketObservationRepositoryPort {
  private readonly observations = new Map<string, MarketObservation>();

  private makeIdempotencyKey(
    sourceId: MarketDataSourceId,
    instrumentId: MarketInstrumentId,
    observedAt: Date
  ): string {
    return `${sourceId}::${instrumentId}::${observedAt.toISOString()}`;
  }

  async save(observation: MarketObservation): Promise<void> {
    // If exact observation already exists, do not overwrite historical record
    const key = this.makeIdempotencyKey(
      observation.sourceId,
      observation.instrumentId,
      observation.observedAt
    );
    for (const obs of this.observations.values()) {
      if (
        this.makeIdempotencyKey(obs.sourceId, obs.instrumentId, obs.observedAt) === key
      ) {
        return; // Idempotent no-op
      }
    }
    this.observations.set(observation.id, observation);
  }

  async saveBatch(observations: MarketObservation[]): Promise<number> {
    let saved = 0;
    for (const obs of observations) {
      await this.save(obs);
      saved++;
    }
    return saved;
  }

  async findLatestByInstrument(
    instrumentId: MarketInstrumentId
  ): Promise<MarketObservation | null> {
    const matching = Array.from(this.observations.values())
      .filter((obs) => obs.instrumentId === instrumentId)
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

    return matching[0] ?? null;
  }

  async findHistory(
    instrumentId: MarketInstrumentId,
    from: Date,
    to: Date,
    limit: number = 100
  ): Promise<MarketObservation[]> {
    return Array.from(this.observations.values())
      .filter(
        (obs) =>
          obs.instrumentId === instrumentId &&
          obs.observedAt.getTime() >= from.getTime() &&
          obs.observedAt.getTime() <= to.getTime()
      )
      .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
      .slice(0, limit);
  }

  async exists(
    sourceId: MarketDataSourceId,
    instrumentId: MarketInstrumentId,
    observedAt: Date
  ): Promise<boolean> {
    const targetTime = observedAt.getTime();
    for (const obs of this.observations.values()) {
      if (
        obs.sourceId === sourceId &&
        obs.instrumentId === instrumentId &&
        obs.observedAt.getTime() === targetTime
      ) {
        return true;
      }
    }
    return false;
  }

  async count(): Promise<number> {
    return this.observations.size;
  }

  clear(): void {
    this.observations.clear();
  }
}
