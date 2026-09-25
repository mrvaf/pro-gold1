import { DomainError } from '../../common/errors.js';

export class VisualSearchError extends DomainError {
  readonly code: string = 'VISUAL_SEARCH_ERROR';
  readonly httpStatus: number = 400;
}

export class InvalidImageFileTypeError extends DomainError {
  readonly code: string = 'INVALID_IMAGE_FILE_TYPE';
  readonly httpStatus: number = 415;

  constructor(mimeType: string, allowedTypes: string[]) {
    super(
      `Unsupported image media type "${mimeType}". Allowed types: ${allowedTypes.join(', ')}.`
    );
  }
}

export class OversizedImageError extends DomainError {
  readonly code: string = 'OVERSIZED_IMAGE';
  readonly httpStatus: number = 413;

  constructor(sizeBytes: number, maxSizeBytes: number) {
    super(
      `Image size ${sizeBytes} bytes exceeds maximum allowed size of ${maxSizeBytes} bytes.`
    );
  }
}

export class PathTraversalError extends DomainError {
  readonly code: string = 'PATH_TRAVERSAL_DETECTED';
  readonly httpStatus: number = 400;

  constructor(filename: string) {
    super(`Suspicious path traversal sequence detected in filename: "${filename}".`);
  }
}

export class InvalidFeatureVectorError extends DomainError {
  readonly code: string = 'INVALID_FEATURE_VECTOR';
  readonly httpStatus: number = 422;

  constructor(message: string) {
    super(`Invalid feature embedding vector: ${message}`);
  }
}
