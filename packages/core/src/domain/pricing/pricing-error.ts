import { DomainError } from '../../common/errors.js';
import type { PricingErrorCode } from './pricing-types.js';

export class PricingError extends DomainError {
  override readonly code: PricingErrorCode;
  readonly httpStatus: number;

  constructor(code: PricingErrorCode, message: string, httpStatus: number = 422) {
    super(message);
    this.name = 'PricingError';
    this.code = code;
    this.httpStatus = httpStatus;
  }

  static marketDataUnavailable(instrumentSymbol: string): PricingError {
    return new PricingError(
      'MARKET_DATA_UNAVAILABLE',
      `Market data observation is unavailable for instrument "${instrumentSymbol}". Cannot produce an authoritative price.`,
      503
    );
  }

  static marketDataStale(instrumentSymbol: string, observedAt: Date, ageMinutes: number): PricingError {
    return new PricingError(
      'MARKET_DATA_STALE',
      `Market observation for instrument "${instrumentSymbol}" is stale (observed at ${observedAt.toISOString()}, age: ${ageMinutes.toFixed(1)}m). Fresh rates required for authoritative pricing.`,
      422
    );
  }

  static unsupportedMarketUnit(unit: string): PricingError {
    return new PricingError(
      'UNSUPPORTED_MARKET_UNIT',
      `Market unit "${unit}" cannot be converted to physical mass.`,
      422
    );
  }

  static fxRateMissing(baseCurrency: string, quoteCurrency: string): PricingError {
    return new PricingError(
      'FX_RATE_MISSING',
      `Required exchange rate from ${baseCurrency} to ${quoteCurrency} is not available.`,
      422
    );
  }

  static ruleNotFound(ruleId: string): PricingError {
    return new PricingError(
      'RULE_NOT_FOUND',
      `Pricing rule with ID "${ruleId}" was not found.`,
      404
    );
  }

  static ruleExpired(ruleId: string, effectiveTo: Date): PricingError {
    return new PricingError(
      'RULE_EXPIRED',
      `Pricing rule "${ruleId}" has expired (effective until ${effectiveTo.toISOString()}).`,
      422
    );
  }

  static idorAccessDenied(resource: string): PricingError {
    return new PricingError(
      'IDOR_ACCESS_DENIED',
      `Access denied: cannot access ${resource} belonging to another tenant.`,
      403
    );
  }

  static precisionError(details: string): PricingError {
    return new PricingError(
      'PRECISION_ERROR',
      `Financial precision violation in pricing engine: ${details}`,
      500
    );
  }

  static configurationError(details: string): PricingError {
    return new PricingError(
      'PRICING_CONFIGURATION_ERROR',
      `Invalid pricing configuration: ${details}`,
      422
    );
  }
}
