import { DomainError } from '../../common/errors.js';

export class CommerceError extends DomainError {
  readonly code: string = 'COMMERCE_ERROR';
  readonly httpStatus: number = 400;
}

export class OrderNotFoundError extends DomainError {
  readonly code: string = 'ORDER_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(orderId: string) {
    super(`Order with id "${orderId}" was not found.`);
  }
}

export class CartNotFoundError extends DomainError {
  readonly code: string = 'CART_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(cartId: string) {
    super(`Cart with id "${cartId}" was not found.`);
  }
}

export class InvalidOrderStateTransitionError extends DomainError {
  readonly code: string = 'INVALID_ORDER_STATE_TRANSITION';
  readonly httpStatus: number = 422;

  constructor(from: string, to: string) {
    super(`Cannot transition order from state "${from}" to state "${to}".`);
  }
}

export class StockReservationExpiredError extends DomainError {
  readonly code: string = 'STOCK_RESERVATION_EXPIRED';
  readonly httpStatus: number = 409;

  constructor(sku: string) {
    super(`Stock reservation for SKU "${sku}" has expired or is unavailable.`);
  }
}

export class InsufficientInventoryError extends DomainError {
  readonly code: string = 'INSUFFICIENT_INVENTORY';
  readonly httpStatus: number = 409;

  constructor(sku: string, requested: number, available: number) {
    super(`Insufficient inventory for SKU "${sku}". Requested: ${requested}, Available: ${available}`);
  }
}

export class PaymentVerificationFailedError extends DomainError {
  readonly code: string = 'PAYMENT_VERIFICATION_FAILED';
  readonly httpStatus: number = 400;

  constructor(reason: string) {
    super(`Payment verification failed: ${reason}`);
  }
}
