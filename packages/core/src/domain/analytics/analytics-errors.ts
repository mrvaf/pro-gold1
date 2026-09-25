import { DomainError } from '../../common/errors.js';

export class InvalidAnalyticsQueryError extends DomainError {
  readonly code: string = 'INVALID_ANALYTICS_QUERY';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`INVALID_ANALYTICS_QUERY: ${message}`);
  }
}
