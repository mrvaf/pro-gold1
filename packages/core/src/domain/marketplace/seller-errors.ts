import { DomainError } from '../../common/errors.js';

export class InvalidSellerStateError extends DomainError {
  readonly code: string = 'INVALID_SELLER_STATE';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(message);
  }
}

export class SellerSuspendedError extends DomainError {
  readonly code: string = 'SELLER_SUSPENDED';
  readonly httpStatus: number = 403;

  constructor(message = 'Seller profile is suspended.') {
    super(message);
  }
}

export class InvalidListingStateError extends DomainError {
  readonly code: string = 'INVALID_LISTING_STATE';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(message);
  }
}

