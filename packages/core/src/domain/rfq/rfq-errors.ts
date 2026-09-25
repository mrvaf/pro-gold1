import { DomainError } from '../../common/errors.js';

export class RfqError extends DomainError {
  readonly code: string = 'RFQ_ERROR';
  readonly httpStatus: number = 400;
}

export class InvalidRfqStateTransitionError extends DomainError {
  readonly code: string = 'INVALID_RFQ_STATE_TRANSITION';
  readonly httpStatus: number = 422;

  constructor(from: string, to: string) {
    super(`Cannot transition RFQ from state "${from}" to state "${to}".`);
  }
}

export class RfqNotFoundError extends DomainError {
  readonly code: string = 'RFQ_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`Custom manufacturing RFQ with id "${id}" was not found.`);
  }
}

export class RfqProposalNotFoundError extends DomainError {
  readonly code: string = 'RFQ_PROPOSAL_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(proposalId: string) {
    super(`Goldsmith quotation proposal with id "${proposalId}" was not found.`);
  }
}

export class UnauthorizedRfqParticipantError extends DomainError {
  readonly code: string = 'UNAUTHORIZED_RFQ_PARTICIPANT';
  readonly httpStatus: number = 403;

  constructor(userId: string, rfqId: string) {
    super(`User "${userId}" is not an authorized participant in RFQ "${rfqId}".`);
  }
}
