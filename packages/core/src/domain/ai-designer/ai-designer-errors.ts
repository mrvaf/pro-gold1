import { DomainError } from '../../common/errors.js';

export class DesignSessionError extends DomainError {
  readonly code: string = 'DESIGN_SESSION_ERROR';
  readonly httpStatus: number = 400;
}

export class DesignSessionNotFoundError extends DomainError {
  readonly code: string = 'DESIGN_SESSION_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(sessionId: string) {
    super(`Design session with ID "${sessionId}" not found.`);
  }
}

export class InvalidDesignSessionStateError extends DomainError {
  readonly code: string = 'INVALID_DESIGN_SESSION_STATE';
  readonly httpStatus: number = 409;

  constructor(message: string) {
    super(message);
  }
}
