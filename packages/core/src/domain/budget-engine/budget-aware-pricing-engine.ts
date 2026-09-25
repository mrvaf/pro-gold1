import { Decimal } from 'decimal.js';
import { err, ok, type Result } from '../../common/result.js';
import { Money } from '../finance/money.js';
import type { CurrencyCode } from '../finance/currency.js';
import { Weight } from '../material/weight.js';
import { GoldPurity } from '../material/gold-purity.js';
import type { MarketObservation } from '../market-data/market-observation.js';
import type { MarketDataFreshnessPolicy } from '../market-data/market-data-freshness.policy.js';
import type { PricingRule } from '../pricing/pricing-rule.js';
import type { FxRate } from '../finance/fx-rate.js';
import type { TenantId } from '../tenant/tenant.js';
import type { StoreId } from '../tenant/store.js';
import { PricingEngine } from '../pricing/pricing-engine.js';
import { PricingError } from '../pricing/pricing-error.js';
import {
  InsufficientBudgetError,
  BudgetConfigurationExceededError,
} from './budget-errors.js';
import { ViableConfiguration } from './viable-configuration.js';

export interface BudgetReverseSolveContext {
  readonly budgetCeiling: Money;
  readonly targetKarats: number[]; // e.g. [18, 21, 24] or [14, 18]
  readonly marketObservation: MarketObservation;
  readonly freshnessPolicy: MarketDataFreshnessPolicy;
  readonly rule: PricingRule;
  readonly timestamp?: Date | undefined;
  readonly allowStaleMarketData?: boolean | undefined;
  readonly fxRate?: FxRate | undefined;
  readonly stoneAllowance?: Money | undefined;
  readonly tenantId?: TenantId | undefined;
  readonly storeId?: StoreId | undefined;
  readonly minWeightGrams?: Decimal | undefined; // default 0.5g
  readonly maxWeightGrams?: Decimal | undefined; // default 100g
}

/**
 * Authoritative Budget-Aware Design & Reverse-Pricing Engine.
 *
 * Mandates:
 * 1. Arbitrary-precision bisection search guaranteeing zero floating-point inaccuracies.
 * 2. Generated configurations strictly satisfy estimatedCost <= budgetCeiling.
 * 3. Integrates with the authoritative PricingEngine (spot rates, ojrat, margin, VAT, FX).
 */
export class BudgetAwarePricingEngine {
  private static readonly EPSILON_GRAMS = new Decimal('0.0001'); // 0.1 mg precision
  private static readonly MAX_ITERATIONS = 40;

  static solveViableConfigurations(
    context: BudgetReverseSolveContext
  ): Result<ViableConfiguration[], InsufficientBudgetError | PricingError> {
    const minWeight = context.minWeightGrams ?? new Decimal('0.5');
    const maxWeight = context.maxWeightGrams ?? new Decimal('100.0');
    const stoneAllowance = context.stoneAllowance ?? Money.zero(context.budgetCeiling.currency);

    if (context.budgetCeiling.amount.lte(0)) {
      return err(new InsufficientBudgetError('Budget ceiling must be greater than zero.'));
    }

    if (stoneAllowance.amount.gte(context.budgetCeiling.amount)) {
      return err(
        new InsufficientBudgetError(
          'Stone allowance equals or exceeds the total target budget ceiling.'
        )
      );
    }

    const viableConfigs: ViableConfiguration[] = [];

    for (const karat of context.targetKarats) {
      const purityRes = GoldPurity.fromKarat(karat.toString());
      if (purityRes.isErr) {
        continue;
      }
      const purity = purityRes.value;

      // 1. Check if minWeight is already above budget
      const minWeightVO = Weight.fromGrams(minWeight).unwrap();
      const minEvalRes = PricingEngine.calculate({
        weight: minWeightVO,
        purity,
        targetCurrency: context.budgetCeiling.currency,
        marketObservation: context.marketObservation,
        freshnessPolicy: context.freshnessPolicy,
        rule: context.rule,
        timestamp: context.timestamp,
        allowStaleMarketData: context.allowStaleMarketData,
        fxRate: context.fxRate,
        stoneValue: stoneAllowance.isZero() ? undefined : stoneAllowance,
        tenantId: context.tenantId,
        storeId: context.storeId,
      });

      if (minEvalRes.isErr) {
        return err(minEvalRes.error);
      }

      const minCost = minEvalRes.value.finalPrice;
      if (minCost.amount.gt(context.budgetCeiling.amount)) {
        // Not even minimum weight fits budget for this karat
        continue;
      }

      // 2. Binary search for maximum viable weight
      let low = minWeight;
      let high = maxWeight;
      let bestResult = minEvalRes.value;
      let bestWeight = minWeight;

      for (let iter = 0; iter < this.MAX_ITERATIONS; iter++) {
        const mid = low.plus(high).dividedBy(2);
        const midWeightVO = Weight.fromGrams(mid).unwrap();

        const evalRes = PricingEngine.calculate({
          weight: midWeightVO,
          purity,
          targetCurrency: context.budgetCeiling.currency,
          marketObservation: context.marketObservation,
          freshnessPolicy: context.freshnessPolicy,
          rule: context.rule,
          timestamp: context.timestamp,
          allowStaleMarketData: context.allowStaleMarketData,
          fxRate: context.fxRate,
          stoneValue: stoneAllowance.isZero() ? undefined : stoneAllowance,
          tenantId: context.tenantId,
          storeId: context.storeId,
        });

        if (evalRes.isErr) {
          return err(evalRes.error);
        }

        const cost = evalRes.value.finalPrice;

        if (cost.amount.lte(context.budgetCeiling.amount)) {
          // Viable under ceiling, record and try higher
          bestResult = evalRes.value;
          bestWeight = mid;
          low = mid;
        } else {
          // Exceeds ceiling, narrow down
          high = mid;
        }

        if (high.minus(low).lte(this.EPSILON_GRAMS)) {
          break;
        }
      }

      // Invariant sanity check: verify final calculated price strictly <= budgetCeiling
      if (bestResult.finalPrice.amount.gt(context.budgetCeiling.amount)) {
        return err(
          new BudgetConfigurationExceededError(
            bestResult.finalPrice.amount.toString(),
            context.budgetCeiling.amount.toString(),
            context.budgetCeiling.currency
          ) as any
        );
      }

      const remainingBudget = context.budgetCeiling.subtract(bestResult.finalPrice).unwrap();

      viableConfigs.push(
        ViableConfiguration.create({
          karat,
          fineness: purity.fineness.toNumber(),
          weightGrams: bestWeight,
          estimatedCost: bestResult.finalPrice,
          budgetCeiling: context.budgetCeiling,
          remainingBudget,
          stoneAllowance: stoneAllowance.isZero() ? undefined : stoneAllowance,
          pricingResult: bestResult,
        })
      );
    }

    if (viableConfigs.length === 0) {
      return err(
        new InsufficientBudgetError(
          `Target budget ${context.budgetCeiling.amount.toString()} ${context.budgetCeiling.currency} is insufficient for any specified karat options at minimum weight.`
        )
      );
    }

    return ok(viableConfigs);
  }
}
