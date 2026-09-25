import { DomainError } from '../../common/errors.js';

export class BudgetEngineError extends DomainError {
  readonly code: string = 'BUDGET_ENGINE_ERROR';
  readonly httpStatus: number = 400;
}

export class InsufficientBudgetError extends DomainError {
  readonly code: string = 'INSUFFICIENT_BUDGET';
  readonly httpStatus: number = 422;

  constructor(message: string) {
    super(`Provided budget ceiling is insufficient for viable gold jewelry: ${message}`);
  }
}

export class BudgetConfigurationExceededError extends DomainError {
  readonly code: string = 'BUDGET_CEILING_EXCEEDED';
  readonly httpStatus: number = 422;

  constructor(calculatedAmount: string, ceilingAmount: string, currency: string) {
    super(
      `Calculated configuration cost ${calculatedAmount} ${currency} strictly exceeds target budget ceiling ${ceilingAmount} ${currency}.`
    );
  }
}
