import { DomainError } from '../../common/errors.js';

export class ContentStudioError extends DomainError {
  readonly code: string = 'CONTENT_STUDIO_ERROR';
  readonly httpStatus: number = 400;
}

export class ContentSpecNotFoundError extends DomainError {
  readonly code: string = 'CONTENT_SPEC_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`Content specification with id "${id}" was not found.`);
  }
}

export class ContentGroundingViolationError extends DomainError {
  readonly code: string = 'CONTENT_GROUNDING_VIOLATION';
  readonly httpStatus: number = 422;

  constructor(expectedSpec: string, foundText: string) {
    super(`Generated content violates factual grounding. Expected "${expectedSpec}" was contradicted or ungrounded in text: "${foundText}"`);
  }
}
