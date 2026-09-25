import { ValueObject } from '../../common/value-object.js';
import { ok, err, type Result } from '../../common/result.js';
import {
  InvalidImageFileTypeError,
  OversizedImageError,
  PathTraversalError,
} from './visual-search-errors.js';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface VisualSearchImageProps {
  filename: string;
  mimeType: AllowedImageMimeType;
  sizeBytes: number;
  dataBase64: string;
}

export interface CreateVisualSearchImageInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export class VisualSearchImage extends ValueObject<VisualSearchImageProps> {
  private constructor(props: VisualSearchImageProps) {
    super(props);
  }

  get filename(): string {
    return this.props.filename;
  }

  get mimeType(): AllowedImageMimeType {
    return this.props.mimeType;
  }

  get sizeBytes(): number {
    return this.props.sizeBytes;
  }

  get dataBase64(): string {
    return this.props.dataBase64;
  }

  static create(
    input: CreateVisualSearchImageInput
  ): Result<
    VisualSearchImage,
    InvalidImageFileTypeError | OversizedImageError | PathTraversalError
  > {
    // 1. Path traversal check on filename
    const cleanFilename = input.filename.trim();
    if (
      cleanFilename.includes('..') ||
      cleanFilename.includes('/') ||
      cleanFilename.includes('\\') ||
      cleanFilename.includes('\0')
    ) {
      return err(new PathTraversalError(cleanFilename));
    }

    // 2. MIME type check
    const normalizedMime = input.mimeType.toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as AllowedImageMimeType)) {
      return err(
        new InvalidImageFileTypeError(normalizedMime, [...ALLOWED_IMAGE_MIME_TYPES])
      );
    }

    // 3. File size check
    if (input.sizeBytes <= 0 || input.sizeBytes > MAX_IMAGE_FILE_SIZE_BYTES) {
      return err(
        new OversizedImageError(input.sizeBytes, MAX_IMAGE_FILE_SIZE_BYTES)
      );
    }

    return ok(
      new VisualSearchImage({
        filename: cleanFilename,
        mimeType: normalizedMime as AllowedImageMimeType,
        sizeBytes: input.sizeBytes,
        dataBase64: input.dataBase64,
      })
    );
  }

  toDto(): VisualSearchImageProps {
    return { ...this.props };
  }
}
