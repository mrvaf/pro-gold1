import { DomainError } from '../../common/errors.js';

export class PackagingError extends DomainError {
  readonly code: string = 'PACKAGING_ERROR';
  readonly httpStatus: number = 400;
}

export class InvalidPackagingDimensionsError extends DomainError {
  readonly code: string = 'INVALID_PACKAGING_DIMENSIONS';
  readonly httpStatus: number = 422;

  constructor(message: string) {
    super(message);
  }
}

export class InvalidPackagingMaterialError extends DomainError {
  readonly code: string = 'INVALID_PACKAGING_MATERIAL';
  readonly httpStatus: number = 422;

  constructor(message: string) {
    super(message);
  }
}

export class PackagingSpecificationNotFoundError extends DomainError {
  readonly code: string = 'PACKAGING_SPECIFICATION_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`Packaging specification with id "${id}" was not found.`);
  }
}
