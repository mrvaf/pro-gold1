/**
 * Structured Domain Errors for V-GOLD.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends DomainError {
  readonly code: string = 'VALIDATION_ERROR';
  readonly httpStatus = 400;
}

export class UnauthorizedError extends DomainError {
  readonly code: string = 'UNAUTHORIZED';
  readonly httpStatus = 401;
}

export class ForbiddenError extends DomainError {
  readonly code: string = 'FORBIDDEN';
  readonly httpStatus = 403;
}

export class NotFoundError extends DomainError {
  readonly code: string = 'NOT_FOUND';
  readonly httpStatus = 404;
}

export class ConflictError extends DomainError {
  readonly code: string = 'CONFLICT';
  readonly httpStatus = 409;
}

export class BusinessRuleViolationError extends DomainError {
  readonly code: string = 'UNPROCESSABLE_ENTITY';
  readonly httpStatus = 422;
}

export class AiProviderUnavailableError extends DomainError {
  readonly code: string = 'AI_PROVIDER_UNAVAILABLE';
  readonly httpStatus: number = 503;
}

export class AiTimeoutError extends DomainError {
  readonly code: string = 'AI_PROVIDER_TIMEOUT';
  readonly httpStatus: number = 504;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details ?? { timeout: true });
  }
}

