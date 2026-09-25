import { Decimal } from 'decimal.js';
import {
  type CurrencyCode,
  type MarketInstrumentId,
  type PricingRuleId,
  createEntityId,
  Money,
  PricingRule,
  MarketObservation,
  MarketDataFreshnessPolicy,
  BudgetAwarePricingEngine,
  type ViableConfiguration,
  type TenantId,
  type StoreId,
  type Result,
  ok,
  err,
  PricingError,
  DomainError,
  ValidationError,
} from '@v-gold/core';
import type {
  PricingRuleRepositoryPort,
  MarketObservationRepositoryPort,
  MarketInstrumentRepositoryPort,
  FxRateRepositoryPort,
} from '@v-gold/core';

export interface SolveBudgetOptionsCommand {
  budgetCeilingAmount: string;
  currency: CurrencyCode;
  targetKarats?: number[] | undefined; // default [14, 18, 21, 24]
  instrumentSymbol: string;
  ruleId?: string | undefined;
  stoneAllowanceAmount?: string | undefined;
  minWeightGrams?: string | undefined;
  maxWeightGrams?: string | undefined;
  allowStaleMarketData?: boolean | undefined;
  tenantId?: TenantId | undefined;
  storeId?: StoreId | undefined;
}

export class BudgetEngineService {
  constructor(
    private readonly pricingRuleRepo: PricingRuleRepositoryPort,
    private readonly marketObservationRepo: MarketObservationRepositoryPort,
    private readonly marketInstrumentRepo: MarketInstrumentRepositoryPort,
    private readonly fxRateRepo: FxRateRepositoryPort,
    private readonly freshnessPolicy: MarketDataFreshnessPolicy = new MarketDataFreshnessPolicy()
  ) {}

  async solveViableOptions(
    cmd: SolveBudgetOptionsCommand
  ): Promise<Result<ViableConfiguration[], DomainError>> {
    const ceilingRes = Money.create(cmd.budgetCeilingAmount, cmd.currency);
    if (ceilingRes.isErr) {
      return err(ceilingRes.error);
    }
    const budgetCeiling = ceilingRes.value;

    let stoneAllowance: Money | undefined;
    if (cmd.stoneAllowanceAmount) {
      const stoneRes = Money.create(cmd.stoneAllowanceAmount, cmd.currency);
      if (stoneRes.isErr) {
        return err(stoneRes.error);
      }
      stoneAllowance = stoneRes.value;
    }

    // 1. Resolve Instrument ID
    const instrument = await this.marketInstrumentRepo.findBySymbol(cmd.instrumentSymbol);
    const instrumentId = instrument
      ? instrument.id
      : createEntityId<MarketInstrumentId>(cmd.instrumentSymbol);

    // 2. Fetch Market Observation
    const obs = await this.marketObservationRepo.findLatestByInstrument(instrumentId);
    if (!obs) {
      return err(PricingError.marketDataUnavailable(cmd.instrumentSymbol));
    }

    // 3. Fetch Pricing Rule
    let rule: PricingRule | null = null;
    const ruleId = cmd.ruleId ? createEntityId<PricingRuleId>(cmd.ruleId) : undefined;
    rule = await this.pricingRuleRepo.findEffective({
      atDate: new Date(),
      tenantId: cmd.tenantId,
      ruleId,
      includeReferenceSamples: true,
    });

    if (!rule) {
      return err(
        cmd.ruleId
          ? PricingError.ruleNotFound(cmd.ruleId)
          : PricingError.configurationError('No effective pricing rule found.')
      );
    }

    // 4. Solve Reverse Pricing
    return BudgetAwarePricingEngine.solveViableConfigurations({
      budgetCeiling,
      targetKarats: cmd.targetKarats && cmd.targetKarats.length > 0 ? cmd.targetKarats : [14, 18, 21, 24],
      marketObservation: obs,
      freshnessPolicy: this.freshnessPolicy,
      rule,
      allowStaleMarketData: cmd.allowStaleMarketData,
      stoneAllowance,
      tenantId: cmd.tenantId,
      storeId: cmd.storeId,
      minWeightGrams: cmd.minWeightGrams ? new Decimal(cmd.minWeightGrams) : undefined,
      maxWeightGrams: cmd.maxWeightGrams ? new Decimal(cmd.maxWeightGrams) : undefined,
    });
  }
}
