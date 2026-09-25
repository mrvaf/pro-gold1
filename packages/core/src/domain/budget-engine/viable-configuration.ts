import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import type { Money } from '../finance/money.js';
import type { Weight } from '../material/weight.js';
import type { GoldPurity } from '../material/gold-purity.js';
import type { PricingResult } from '../pricing/pricing-result.js';

export interface ViableConfigurationProps {
  readonly karat: number;
  readonly fineness: number;
  readonly weightGrams: Decimal;
  readonly estimatedCost: Money;
  readonly budgetCeiling: Money;
  readonly remainingBudget: Money;
  readonly stoneAllowance?: Money | undefined;
  readonly pricingResult: PricingResult;
}

export class ViableConfiguration extends ValueObject<ViableConfigurationProps> {
  private constructor(props: ViableConfigurationProps) {
    super(props);
  }

  get karat(): number {
    return this.props.karat;
  }

  get fineness(): number {
    return this.props.fineness;
  }

  get weightGrams(): Decimal {
    return this.props.weightGrams;
  }

  get estimatedCost(): Money {
    return this.props.estimatedCost;
  }

  get budgetCeiling(): Money {
    return this.props.budgetCeiling;
  }

  get remainingBudget(): Money {
    return this.props.remainingBudget;
  }

  get stoneAllowance(): Money | undefined {
    return this.props.stoneAllowance;
  }

  get pricingResult(): PricingResult {
    return this.props.pricingResult;
  }

  static create(props: ViableConfigurationProps): ViableConfiguration {
    return new ViableConfiguration(props);
  }

  toDto(): {
    karat: number;
    fineness: number;
    weightGrams: string;
    estimatedCost: string;
    currency: string;
    remainingBudget: string;
    stoneAllowance?: string | undefined;
  } {
    return {
      karat: this.props.karat,
      fineness: this.props.fineness,
      weightGrams: this.props.weightGrams.toFixed(4),
      estimatedCost: this.props.estimatedCost.amount.toString(),
      currency: this.props.estimatedCost.currency,
      remainingBudget: this.props.remainingBudget.amount.toString(),
      stoneAllowance: this.props.stoneAllowance?.amount.toString(),
    };
  }
}
