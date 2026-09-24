import { ValueObject } from '../../common/value-object.js';
import { ValidationError } from '../../common/errors.js';
import { err, ok, type Result } from '../../common/result.js';

export interface SKUProps {
  value: string;
}

/**
 * SKU (Stock Keeping Unit) Value Object.
 * Tenant-scoped, validated, stable identifier for product variants and inventory items.
 * Must match uppercase alphanumeric format with hyphens or underscores (3 to 64 chars).
 */
export class SKU extends ValueObject<SKUProps> {
  private static readonly SKU_REGEX = /^[A-Z0-9_-]{3,64}$/;

  private constructor(value: string) {
    super({ value });
  }

  get value(): string {
    return this.props.value;
  }

  /**
   * Create and validate SKU from raw string.
   */
  static create(rawSku: string): Result<SKU, ValidationError> {
    if (!rawSku || typeof rawSku !== 'string') {
      return err(new ValidationError('SKU cannot be empty.'));
    }

    const trimmed = rawSku.trim().toUpperCase();
    if (trimmed.length < 3 || trimmed.length > 64) {
      return err(
        new ValidationError(`SKU length must be between 3 and 64 characters. Received: "${rawSku}" (${trimmed.length} chars).`)
      );
    }

    if (!SKU.SKU_REGEX.test(trimmed)) {
      return err(
        new ValidationError(
          `Invalid SKU format: "${rawSku}". SKU must contain only uppercase alphanumeric characters, hyphens, and underscores.`
        )
      );
    }

    return ok(new SKU(trimmed));
  }

  /**
   * Deterministic SKU generator helper from structured parts.
   */
  static generate(params: {
    prefix?: string;
    productType: string;
    purityKarat?: string | number;
    serialOrCode: string;
  }): Result<SKU, ValidationError> {
    const parts: string[] = [];
    if (params.prefix) parts.push(params.prefix.trim().toUpperCase());
    parts.push(params.productType.trim().toUpperCase());
    if (params.purityKarat !== undefined) {
      parts.push(`${params.purityKarat}K`);
    }
    parts.push(params.serialOrCode.trim().toUpperCase());

    const combined = parts.join('-');
    return SKU.create(combined);
  }

  override toString(): string {
    return this.props.value;
  }
}
