import { DomainError } from '../../common/errors.js';

export class InvalidWorkspaceStateError extends DomainError {
  readonly code: string = 'INVALID_WORKSPACE_STATE';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(message);
  }
}

export class WorkspaceSuspendedError extends DomainError {
  readonly code: string = 'WORKSPACE_SUSPENDED';
  readonly httpStatus: number = 403;

  constructor(message = 'Seller operational workspace is suspended.') {
    super(message);
  }
}

export class SellerOsUnauthorizedError extends DomainError {
  readonly code: string = 'SELLER_OS_UNAUTHORIZED';
  readonly httpStatus: number = 403;

  constructor(message = 'User is not authorized to perform operations in this seller workspace.') {
    super(message);
  }
}
