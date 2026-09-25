import { DomainError } from '../../common/errors.js';

export class Studio3DError extends DomainError {
  readonly code: string = 'STUDIO_3D_ERROR';
  readonly httpStatus: number = 400;
}

export class Invalid3DAssetTypeError extends DomainError {
  readonly code: string = 'INVALID_3D_ASSET_TYPE';
  readonly httpStatus: number = 415;

  constructor(mimeType: string, allowedTypes: string[]) {
    super(`Unsupported 3D asset MIME type "${mimeType}". Allowed types: ${allowedTypes.join(', ')}.`);
  }
}

export class Oversized3DAssetError extends DomainError {
  readonly code: string = 'OVERSIZED_3D_ASSET';
  readonly httpStatus: number = 413;

  constructor(sizeBytes: number, maxSizeBytes: number) {
    super(`3D asset size ${sizeBytes} bytes exceeds maximum allowed size of ${maxSizeBytes} bytes.`);
  }
}

export class Invalid3DScaleError extends DomainError {
  readonly code: string = 'INVALID_3D_SCALE';
  readonly httpStatus: number = 422;

  constructor(axis: string, value: number) {
    super(`3D bounding scale on ${axis}-axis (${value}) is outside allowable jewelry bounds (0.001m to 1.0m).`);
  }
}

export class Studio3DAssetNotFoundError extends DomainError {
  readonly code: string = 'STUDIO_3D_ASSET_NOT_FOUND';
  readonly httpStatus: number = 404;

  constructor(id: string) {
    super(`3D Studio asset with id "${id}" was not found.`);
  }
}
