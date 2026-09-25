import { DomainError } from '../../common/errors.js';

export class InvalidPublishingChannelError extends DomainError {
  readonly code: string = 'INVALID_PUBLISHING_CHANNEL';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`INVALID_PUBLISHING_CHANNEL: ${message}`);
  }
}

export class PublishingPostValidationError extends DomainError {
  readonly code: string = 'PUBLISHING_POST_VALIDATION_ERROR';
  readonly httpStatus: number = 400;

  constructor(message: string) {
    super(`PUBLISHING_POST_VALIDATION_ERROR: ${message}`);
  }
}

export class PublishingChannelNotFoundError extends DomainError {
  readonly code: string = 'PUBLISHING_CHANNEL_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(channelId: string) {
    super(`PUBLISHING_CHANNEL_NOT_FOUND: Publishing channel '${channelId}' was not found`);
  }
}

export class PublishingPostNotFoundError extends DomainError {
  readonly code: string = 'PUBLISHING_POST_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(postId: string) {
    super(`PUBLISHING_POST_NOT_FOUND: Publishing post '${postId}' was not found`);
  }
}

export class InvalidPostStateTransitionError extends DomainError {
  readonly code: string = 'INVALID_POST_STATE_TRANSITION';
  readonly httpStatus: number = 400;

  constructor(from: string, to: string) {
    super(`INVALID_POST_STATE_TRANSITION: Cannot transition post from '${from}' to '${to}'`);
  }
}

export class EncryptionError extends DomainError {
  readonly code: string = 'ENCRYPTION_ERROR';
  readonly httpStatus: number = 500;

  constructor(message: string) {
    super(`ENCRYPTION_ERROR: ${message}`);
  }
}
