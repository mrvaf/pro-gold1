import { Decimal } from 'decimal.js';
import { ValueObject } from '../../common/value-object.js';
import { Money } from '../finance/money.js';
import type { CurrencyCode } from '../finance/currency.js';
import type { MakingChargeType, MarginType, TaxableBaseType } from './pricing-types.js';

export interface PricingLineItem {
  readonly code: string;
  readonly label: string;
  readonly labelFa: string;
  readonly amount: Money;
  readonly metadata?: Record<string, string> | undefined;
}

export interface PricingBreakdownProps {
  currency: CurrencyCode;
  baseMetal: {
    itemWeightGrams: string;
    purityFineness: string;
    pureGrams: string;
    pureGoldMarketRatePerGram: string;
    amount: string;
  };
  makingCharge: {
    type: MakingChargeType;
    rate: string;
    amount: string;
  };
  sellerMargin: {
    type: MarginType;
    rate: string;
    amount: string;
  };
  stoneValue: {
    amount: string;
  };
  tax: {
    taxableBase: TaxableBaseType;
    taxableAmount: string;
    rate: string;
    amount: string;
  };
  subtotal: string;
  unroundedTotal: string;
  roundingAdjustment: string;
  finalAmount: string;
}

export interface PricingBreakdownDto {
  currency: CurrencyCode;
  baseMetal: {
    itemWeightGrams: string;
    purityFineness: string;
    pureGrams: string;
    pureGoldMarketRatePerGram: string;
    amount: string;
  };
  makingCharge: {
    type: string;
    rate: string;
    amount: string;
  };
  sellerMargin: {
    type: string;
    rate: string;
    amount: string;
  };
  stoneValue: {
    amount: string;
  };
  tax: {
    taxableBase: string;
    taxableAmount: string;
    rate: string;
    amount: string;
  };
  subtotal: string;
  unroundedTotal: string;
  roundingAdjustment: string;
  finalAmount: string;
  lineItems: Array<{
    code: string;
    label: string;
    labelFa: string;
    amount: string;
    currency: string;
  }>;
}

export class PricingBreakdown extends ValueObject<PricingBreakdownProps> {
  readonly currency: CurrencyCode;
  readonly baseMetalValue: Money;
  readonly makingChargeAmount: Money;
  readonly sellerMarginAmount: Money;
  readonly stoneValueAmount: Money;
  readonly taxAmount: Money;
  readonly subtotal: Money;
  readonly unroundedTotal: Money;
  readonly roundingAdjustment: Money;
  readonly finalAmount: Money;

  // Metadata snapshots
  readonly itemWeightGrams: Decimal;
  readonly purityFineness: Decimal;
  readonly pureGrams: Decimal;
  readonly pureGoldMarketRatePerGram: Money;
  readonly makingChargeType: MakingChargeType;
  readonly makingChargeRate: Decimal;
  readonly sellerMarginType: MarginType;
  readonly sellerMarginRate: Decimal;
  readonly taxableBase: TaxableBaseType;
  readonly taxableAmount: Money;
  readonly taxRate: Decimal;

  constructor(params: {
    currency: CurrencyCode;
    itemWeightGrams: Decimal;
    purityFineness: Decimal;
    pureGrams: Decimal;
    pureGoldMarketRatePerGram: Money;
    baseMetalValue: Money;
    makingChargeType: MakingChargeType;
    makingChargeRate: Decimal;
    makingChargeAmount: Money;
    sellerMarginType: MarginType;
    sellerMarginRate: Decimal;
    sellerMarginAmount: Money;
    stoneValueAmount: Money;
    taxableBase: TaxableBaseType;
    taxableAmount: Money;
    taxRate: Decimal;
    taxAmount: Money;
    subtotal: Money;
    unroundedTotal: Money;
    roundingAdjustment: Money;
    finalAmount: Money;
  }) {
    super({
      currency: params.currency,
      baseMetal: {
        itemWeightGrams: params.itemWeightGrams.toString(),
        purityFineness: params.purityFineness.toString(),
        pureGrams: params.pureGrams.toString(),
        pureGoldMarketRatePerGram: params.pureGoldMarketRatePerGram.amount.toString(),
        amount: params.baseMetalValue.amount.toString(),
      },
      makingCharge: {
        type: params.makingChargeType,
        rate: params.makingChargeRate.toString(),
        amount: params.makingChargeAmount.amount.toString(),
      },
      sellerMargin: {
        type: params.sellerMarginType,
        rate: params.sellerMarginRate.toString(),
        amount: params.sellerMarginAmount.amount.toString(),
      },
      stoneValue: {
        amount: params.stoneValueAmount.amount.toString(),
      },
      tax: {
        taxableBase: params.taxableBase,
        taxableAmount: params.taxableAmount.amount.toString(),
        rate: params.taxRate.toString(),
        amount: params.taxAmount.amount.toString(),
      },
      subtotal: params.subtotal.amount.toString(),
      unroundedTotal: params.unroundedTotal.amount.toString(),
      roundingAdjustment: params.roundingAdjustment.amount.toString(),
      finalAmount: params.finalAmount.amount.toString(),
    });

    this.currency = params.currency;
    this.baseMetalValue = params.baseMetalValue;
    this.makingChargeAmount = params.makingChargeAmount;
    this.sellerMarginAmount = params.sellerMarginAmount;
    this.stoneValueAmount = params.stoneValueAmount;
    this.taxAmount = params.taxAmount;
    this.subtotal = params.subtotal;
    this.unroundedTotal = params.unroundedTotal;
    this.roundingAdjustment = params.roundingAdjustment;
    this.finalAmount = params.finalAmount;

    this.itemWeightGrams = params.itemWeightGrams;
    this.purityFineness = params.purityFineness;
    this.pureGrams = params.pureGrams;
    this.pureGoldMarketRatePerGram = params.pureGoldMarketRatePerGram;
    this.makingChargeType = params.makingChargeType;
    this.makingChargeRate = params.makingChargeRate;
    this.sellerMarginType = params.sellerMarginType;
    this.sellerMarginRate = params.sellerMarginRate;
    this.taxableBase = params.taxableBase;
    this.taxableAmount = params.taxableAmount;
    this.taxRate = params.taxRate;
  }

  get lineItems(): PricingLineItem[] {
    const items: PricingLineItem[] = [
      {
        code: 'BASE_METAL',
        label: 'Base Metal Value',
        labelFa: 'ارزش طلای خام',
        amount: this.baseMetalValue,
        metadata: {
          itemWeightGrams: this.itemWeightGrams.toString(),
          purityFineness: this.purityFineness.toString(),
          pureGrams: this.pureGrams.toString(),
          ratePerGram: this.pureGoldMarketRatePerGram.amount.toString(),
        },
      },
      {
        code: 'MAKING_CHARGE',
        label: 'Making Charge (Labor)',
        labelFa: 'اجرت ساخت',
        amount: this.makingChargeAmount,
        metadata: {
          type: this.makingChargeType,
          rate: this.makingChargeRate.toString(),
        },
      },
      {
        code: 'SELLER_MARGIN',
        label: 'Seller Margin',
        labelFa: 'سود طلافروش',
        amount: this.sellerMarginAmount,
        metadata: {
          type: this.sellerMarginType,
          rate: this.sellerMarginRate.toString(),
        },
      },
    ];

    if (!this.stoneValueAmount.isZero()) {
      items.push({
        code: 'STONE_VALUE',
        label: 'Stone / Gemstone Value',
        labelFa: 'ارزش سنگ / جواهرات',
        amount: this.stoneValueAmount,
      });
    }

    if (!this.taxAmount.isZero()) {
      items.push({
        code: 'TAX_VAT',
        label: 'Value Added Tax (VAT)',
        labelFa: 'مالیات بر ارزش افزوده',
        amount: this.taxAmount,
        metadata: {
          taxableBase: this.taxableBase,
          taxableAmount: this.taxableAmount.amount.toString(),
          rate: this.taxRate.toString(),
        },
      });
    }

    if (!this.roundingAdjustment.isZero()) {
      items.push({
        code: 'ROUNDING_ADJUSTMENT',
        label: 'Rounding Adjustment',
        labelFa: 'تعدیل رند کردن',
        amount: this.roundingAdjustment,
      });
    }

    return items;
  }

  get rawProps(): PricingBreakdownProps {
    return this.props;
  }

  /**
   * Verifies the mathematical invariant that the sum of line items
   * equals the authoritative finalAmount exactly.
   */
  verifyLineItemInvariant(): boolean {
    let sum = Money.zero(this.currency);
    for (const item of this.lineItems) {
      sum = sum.add(item.amount).unwrap();
    }
    return sum.equals(this.finalAmount);
  }

  toDto(): PricingBreakdownDto {
    return {
      currency: this.currency,
      baseMetal: {
        itemWeightGrams: this.itemWeightGrams.toString(),
        purityFineness: this.purityFineness.toString(),
        pureGrams: this.pureGrams.toString(),
        pureGoldMarketRatePerGram: this.pureGoldMarketRatePerGram.amount.toString(),
        amount: this.baseMetalValue.amount.toString(),
      },
      makingCharge: {
        type: this.makingChargeType,
        rate: this.makingChargeRate.toString(),
        amount: this.makingChargeAmount.amount.toString(),
      },
      sellerMargin: {
        type: this.sellerMarginType,
        rate: this.sellerMarginRate.toString(),
        amount: this.sellerMarginAmount.amount.toString(),
      },
      stoneValue: {
        amount: this.stoneValueAmount.amount.toString(),
      },
      tax: {
        taxableBase: this.taxableBase,
        taxableAmount: this.taxableAmount.amount.toString(),
        rate: this.taxRate.toString(),
        amount: this.taxAmount.amount.toString(),
      },
      subtotal: this.subtotal.amount.toString(),
      unroundedTotal: this.unroundedTotal.amount.toString(),
      roundingAdjustment: this.roundingAdjustment.amount.toString(),
      finalAmount: this.finalAmount.amount.toString(),
      lineItems: this.lineItems.map((li) => ({
        code: li.code,
        label: li.label,
        labelFa: li.labelFa,
        amount: li.amount.amount.toString(),
        currency: li.amount.currency,
      })),
    };
  }
}
