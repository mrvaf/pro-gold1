import { DomainError } from '../../common/errors.js';

export class TryOnError extends DomainError {
  readonly code: string = 'TRY_ON_ERROR';
  readonly httpStatus: number = 400;
}

export class InvalidAnchoringScaleError extends DomainError {
  readonly code: string = 'INVALID_ANCHORING_SCALE';
  readonly httpStatus: number = 422;

  constructor(bodyPart: string, value: number, expectedRange: string) {
    super(`Scale parameter for ${bodyPart} (${value}) is outside realistic biometric bounds (${expectedRange}).`);
  }
}

export class TryOnSessionExpiredError extends DomainError {
  readonly code: string = 'TRY_ON_SESSION_EXPIRED';
  readonly httpStatus: number = 410;

  constructor(sessionId: string) {
    super(`Virtual try-on session "${sessionId}" has expired for security and privacy compliance.`);
  }
}

export class TryOnSessionNotFoundError extends DomainError {
  readonly code: string = 'TRY_ON_SESSION_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(sessionId: string) {
    super(`Virtual try-on session "${sessionId}" was not found.`);
  }
}
