import { DomainError } from '../../common/errors.js';

export class DesignConceptError extends DomainError {
  readonly code: string = 'DESIGN_CONCEPT_ERROR';
  readonly httpStatus: number = 400;
}

export class DesignConceptNotFoundError extends DomainError {
  readonly code: string = 'DESIGN_CONCEPT_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(conceptId: string) {
    super(`Design concept with ID "${conceptId}" not found.`);
  }
}

export class InvalidConceptStateError extends DomainError {
  readonly code: string = 'INVALID_CONCEPT_STATE';
  readonly httpStatus: number = 409;

  constructor(message: string) {
    super(message);
  }
}

export class ConceptGroundingViolationError extends DomainError {
  readonly code: string = 'CONCEPT_GROUNDING_VIOLATION';
  readonly httpStatus: number = 422;

  constructor(message: string) {
    super(`Strict Domain Attribute Grounding Violation: ${message}`);
  }
}
