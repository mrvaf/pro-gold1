import { DomainError } from '../../common/errors.js';

export class InvalidGuildLicenseError extends DomainError {
  readonly code: string = 'INVALID_GUILD_LICENSE';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`INVALID_GUILD_LICENSE: ${message}`);
  }
}

export class InvalidHallmarkAuditError extends DomainError {
  readonly code: string = 'INVALID_HALLMARK_AUDIT';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`INVALID_HALLMARK_AUDIT: ${message}`);
  }
}

export class InvalidReviewModerationError extends DomainError {
  readonly code: string = 'INVALID_REVIEW_MODERATION';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`INVALID_REVIEW_MODERATION: ${message}`);
  }
}

export class VerificationRecordNotFoundError extends DomainError {
  readonly code: string = 'VERIFICATION_RECORD_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`VERIFICATION_RECORD_NOT_FOUND: Record '${id}' was not found`);
  }
}

export class ReviewNotFoundError extends DomainError {
  readonly code: string = 'REVIEW_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`REVIEW_NOT_FOUND: Review '${id}' was not found`);
  }
}
