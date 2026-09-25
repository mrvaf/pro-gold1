import {
  MarketInstrument,
  MarketDataSource,
  MarketDataFreshnessPolicy,
  MarketDataIngestionService,
  MarketDataQueryService,
} from '@v-gold/core';
import type {
  MarketDataSourceRepositoryPort,
  MarketInstrumentRepositoryPort,
  MarketObservationRepositoryPort,
} from '@v-gold/core';
import {
  createPersistence,
  type Persistence,
  UnavailableMarketDataProvider,
} from '@v-gold/database';

class MarketDataContainer {
  readonly sourceRepo: MarketDataSourceRepositoryPort;
  readonly instrumentRepo: MarketInstrumentRepositoryPort;
  readonly observationRepo: MarketObservationRepositoryPort;
  readonly provider = new UnavailableMarketDataProvider();
  readonly freshnessPolicy = new MarketDataFreshnessPolicy();
  readonly ingestionService: MarketDataIngestionService;
  readonly queryService: MarketDataQueryService;

  private isInitialized = false;

  constructor(persistence: Persistence = createPersistence()) {
    this.sourceRepo = persistence.marketDataSourceRepository;
    this.instrumentRepo = persistence.marketInstrumentRepository;
    this.observationRepo = persistence.marketObservationRepository;
    this.ingestionService = new MarketDataIngestionService(
      this.observationRepo,
      this.instrumentRepo,
      this.sourceRepo
    );

    this.queryService = new MarketDataQueryService(
      this.observationRepo,
      this.instrumentRepo,
      this.sourceRepo,
      this.freshnessPolicy
    );

    this.initializeDefaults();
  }

  private initializeDefaults() {
    if (this.isInitialized) return;

    // Register default reference source (explicitly indicating no credentials configured)
    const sourceResult = MarketDataSource.create({
      id: 'src_unavailable',
      name: 'Unavailable Market Data Provider',
      code: 'UNAVAILABLE_PROVIDER',
      description: 'Default platform provider when external credentials are not set',
    });
    if (sourceResult.isOk) {
      this.sourceRepo.save(sourceResult.value);
    }

    // Register standard precious metals instruments
    const instruments = [
      {
        id: 'inst_xau_usd',
        symbol: 'XAU/USD',
        baseAsset: 'XAU',
        quoteCurrency: 'USD',
        unit: 'TROY_OUNCE',
        displayName: 'Gold Spot (USD per Troy Ounce)',
      },
      {
        id: 'inst_xau_eur',
        symbol: 'XAU/EUR',
        baseAsset: 'XAU',
        quoteCurrency: 'EUR',
        unit: 'TROY_OUNCE',
        displayName: 'Gold Spot (EUR per Troy Ounce)',
      },
      {
        id: 'inst_xau_irr',
        symbol: 'XAU/IRR',
        baseAsset: 'XAU',
        quoteCurrency: 'IRR',
        unit: 'GRAM',
        displayName: 'Gold 24K (IRR per Gram)',
      },
      {
        id: 'inst_xag_usd',
        symbol: 'XAG/USD',
        baseAsset: 'XAG',
        quoteCurrency: 'USD',
        unit: 'TROY_OUNCE',
        displayName: 'Silver Spot (USD per Troy Ounce)',
      },
    ];

    for (const inst of instruments) {
      const res = MarketInstrument.create(inst);
      if (res.isOk) {
        this.instrumentRepo.save(res.value);
      }
    }

    this.isInitialized = true;
  }
}

let containerInstance: MarketDataContainer | null = null;

export function getMarketDataContainer(): MarketDataContainer {
  if (!containerInstance) {
    containerInstance = new MarketDataContainer();
  }
  return containerInstance;
}
